/**
 * Tests for the bipnip agent client: signed requests, the agent's answer lines, a stale clock,
 * what the host says when no agent is there, and the session key kept between loads.
 */

import { getPublicKey, verifyEvent, type Event } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils.js';
import { KIND_WEB_REQUEST, requestLine, signRequest } from '../request';
import { LineSplitter, parseLine } from '../ndjson';
import { AGENT_ITEM, AgentClient, CALL_PATH, KEY_ITEM, type Fetched, type FetchFn } from '..';

jest.mock('../../System', () => ({
  systemClient: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));

const AGENT = 'a'.repeat(64);
const SECRET = new Uint8Array(32).fill(7);

function memory(): {
  getItem: jest.Mock;
  setItem: jest.Mock;
  deleteItem: jest.Mock;
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem: jest.fn(async (key: string) => data.get(key)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    deleteItem: jest.fn((key: string) => {
      data.delete(key);
    }),
  };
}

/** A response whose body arrives in `chunks`. */
function answer(chunks: string[], status = 200): Fetched {
  const encoder = new TextEncoder();
  let next = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () =>
          next < chunks.length
            ? { done: false, value: encoder.encode(chunks[next++]) }
            : { done: true, value: undefined },
      }),
    },
    text: async () => chunks.join(''),
  };
}

/** A host that answers each request with the next of `answers`, and keeps what it was sent. */
function host(answers: Fetched[]): {
  fetch: FetchFn;
  sent: Event[];
  inits: Parameters<FetchFn>[1][];
} {
  const sent: Event[] = [];
  const inits: Parameters<FetchFn>[1][] = [];
  let next = 0;
  const fetch: FetchFn = async (url, init) => {
    expect(url).toBe(CALL_PATH);
    inits.push(init);
    sent.push(JSON.parse(init.body) as Event);
    return answers[next++];
  };
  return { fetch, sent, inits };
}

describe('signRequest', () => {
  it('signs the request line as an event of the web-request kind, for the agent', () => {
    const event = signRequest(
      SECRET,
      'lease.take',
      { order_id: 'x', capacity_sat: 600000 },
      1_800_000_000.9,
      AGENT,
      new Uint8Array(16).fill(1),
    );
    expect(verifyEvent(event)).toBe(true);
    expect(event.kind).toBe(KIND_WEB_REQUEST);
    expect(event.pubkey).toBe(getPublicKey(SECRET));
    expect(event.created_at).toBe(1_800_000_000);
    expect(event.content).toBe(requestLine('lease.take', { order_id: 'x', capacity_sat: 600000 }));
    expect(JSON.parse(event.content)).toEqual({
      v: 1,
      method: 'lease.take',
      params: { order_id: 'x', capacity_sat: 600000 },
    });
    expect(event.tags).toEqual([
      ['nonce', '01'.repeat(16)],
      ['p', AGENT],
    ]);
  });

  it('names no agent before pairing, and two equal requests differ by their nonce', () => {
    const first = signRequest(SECRET, 'pair.status', {}, 1, undefined, new Uint8Array(16).fill(1));
    const second = signRequest(SECRET, 'pair.status', {}, 1, undefined, new Uint8Array(16).fill(2));
    expect(first.tags).toEqual([['nonce', '01'.repeat(16)]]);
    expect(first.id).not.toBe(second.id);
  });
});

describe('LineSplitter', () => {
  it('keeps a line cut in two until it ends, and drops the blank lines of a wait', () => {
    const splitter = new LineSplitter();
    expect(splitter.push('{"status":"wat')).toEqual([]);
    expect(splitter.push('ching"}\n\n{"ok":')).toEqual(['{"status":"watching"}']);
    expect(splitter.push('true}\n')).toEqual(['{"ok":true}']);
    expect(splitter.push('\n')).toEqual([]);
    expect(splitter.push('{"last":1}')).toEqual([]);
    expect(splitter.end()).toEqual(['{"last":1}']);
    expect(splitter.end()).toEqual([]);
  });

  it('reads only JSON objects', () => {
    expect(parseLine('{"ok":true}')).toEqual({ ok: true });
    expect(parseLine('[1]')).toBeUndefined();
    expect(parseLine('7')).toBeUndefined();
    expect(parseLine('{not json')).toBeUndefined();
  });
});

describe('AgentClient', () => {
  it('sends a signed request and reads the status lines and the final answer', async () => {
    const store = memory();
    const { fetch, sent, inits } = host([
      answer([
        '{"status":"started","run":"buyer-0a"}\n{"ok":tr',
        'ue,"result":{"run":"buyer-0a"}}\n',
      ]),
    ]);
    const client = new AgentClient(store, fetch, () => 1_800_000_000);
    const lines: unknown[] = [];
    const result = await client.call('lease.list', {}, (line) => lines.push(line));
    expect(result).toEqual({ ok: true, result: { run: 'buyer-0a' } });
    expect(lines).toEqual([{ status: 'started', run: 'buyer-0a' }]);
    expect(verifyEvent(sent[0])).toBe(true);
    expect(sent[0].created_at).toBe(1_800_000_000);
    expect(JSON.parse(sent[0].content).method).toBe('lease.list');
    expect(inits[0].headers['Content-Type']).toBe('application/json');
    expect(inits[0].credentials).toBe('omit');
  });

  it('learns the agent from a pairing answer, and names it from then on', async () => {
    const store = memory();
    const { fetch, sent } = host([
      answer([
        `{"ok":true,"result":{"paired":false,"pending":true,"code":"1234-5678-9012","agent":"${AGENT}"}}\n`,
      ]),
      answer(['{"ok":true,"result":{}}\n']),
    ]);
    const client = new AgentClient(store, fetch);
    const paired = await client.pair('desk');
    expect(paired.ok && paired.result.code).toBe('1234-5678-9012');
    expect(JSON.parse(sent[0].content).params).toEqual({ label: 'desk' });
    expect(sent[0].tags.some(([name]) => name === 'p')).toBe(false);
    expect(client.agentKey()).toBe(AGENT);
    expect(store.data.get(AGENT_ITEM)).toBe(AGENT);
    await client.call('status');
    expect(sent[1].tags).toContainEqual(['p', AGENT]);
  });

  it('asks once more by the agent clock when its own is off', async () => {
    const { fetch, sent } = host([
      answer(['{"ok":false,"error":{"code":"stale","message":"too far","now":1800000500}}\n']),
      answer(['{"ok":true,"result":{"network":"regtest"}}\n']),
    ]);
    const client = new AgentClient(memory(), fetch, () => 1_800_000_000);
    const result = await client.call('status');
    expect(result).toEqual({ ok: true, result: { network: 'regtest' } });
    expect(sent.map((event) => event.created_at)).toEqual([1_800_000_000, 1_800_000_500]);
    expect(sent[0].id).not.toBe(sent[1].id);
  });

  it('tells a refusal, a parked request, a missing agent and a host error apart', async () => {
    const { fetch } = host([
      answer([
        '{"ok":false,"error":{"code":"needs-approval","message":"parked","approval":"3f2a"}}\n',
      ]),
      answer(['no agent is connected to this host'], 503),
      answer(['cross-site request refused'], 403),
      answer(['{"status":"watching"}\n']),
    ]);
    const client = new AgentClient(memory(), fetch);
    expect(await client.call('lease.take')).toEqual({
      ok: false,
      error: { code: 'needs-approval', message: 'parked', approval: '3f2a', now: undefined },
    });
    const none = await client.call('status');
    expect(!none.ok && none.error.code).toBe('no-agent');
    const host403 = await client.call('status');
    expect(!host403.ok && host403.error).toEqual({
      code: 'host',
      message: 'cross-site request refused',
    });
    const cut = await client.call('status');
    expect(!cut.ok && cut.error.code).toBe('host');
  });

  it('keeps its session key between loads, and starts afresh once forgotten', async () => {
    const store = memory();
    const first = new AgentClient(store, host([]).fetch);
    const key = await first.sessionKey();
    expect(store.data.get(KEY_ITEM)).toMatch(/^[0-9a-f]{64}$/);
    expect(getPublicKey(hexToBytes(store.data.get(KEY_ITEM) as string))).toBe(key);
    const again = new AgentClient(store, host([]).fetch);
    expect(await again.sessionKey()).toBe(key);
    again.forget();
    expect(store.data.has(KEY_ITEM)).toBe(false);
    expect(await again.sessionKey()).not.toBe(key);
  });
});
