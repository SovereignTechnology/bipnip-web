// bipnip: the page's way to its own agent (`bipnip/docs/agent-api.md`, "The web door").
//
// The page holds a session key of its own and signs every request with it; its host passes the
// request to the agent unread (`POST /agent/call`), and the agent checks the signature, the session
// the operator paired and its scope. Nothing the agent holds (its mnemonic, its node's credentials)
// ever reaches this page, and nothing this page asks for moves money until the operator approves it
// where the agent runs.
//
// The session key is kept through `systemClient` (localStorage on the web): a page served over plain
// HTTP on a private network has no WebCrypto to keep a key it cannot read out. A copy of it is
// useful only to someone who can reach the host, and only as far as the session's scope; the
// operator ends a session with `bipnip revoke`, or the page with `end()`.

import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { systemClient } from '../System';
import type { AgentAnswer, AgentError, PairStatus } from '../../models/Liquidity.model';
import { signRequest } from './request';
import { LineSplitter, parseLine } from './ndjson';

/** Where the session key is kept. */
export const KEY_ITEM = 'bipnip_session_key';
/** Where the agent's key is kept, once a pairing answer named it. */
export const AGENT_ITEM = 'bipnip_agent';
/** The host's route to the agent. */
export const CALL_PATH = '/agent/call';

/** What the client keeps things in (`systemClient`). */
export interface KeyStore {
  getItem: (key: string) => Promise<string | undefined>;
  setItem: (key: string, value: string) => void;
  deleteItem: (key: string) => void;
}

/** The part of a fetch response the client reads. */
export interface Fetched {
  ok: boolean;
  status: number;
  body: { getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } } | null;
  text: () => Promise<string>;
}

/** How a request reaches the host. */
export type FetchFn = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    credentials: 'omit';
    cache: 'no-store';
    signal?: AbortSignal;
  },
) => Promise<Fetched>;

/** A status line: something the agent says before its final answer, or while watching. */
export type StatusLine = Record<string, unknown>;

const HEX64 = /^[0-9a-f]{64}$/;

function failure(code: AgentError['code'], message: string): { ok: false; error: AgentError } {
  return { ok: false, error: { code, message } };
}

/** The final line, as an answer. */
function answerOf<T>(line: Record<string, unknown>): AgentAnswer<T> {
  if (line.ok === true) {
    return { ok: true, result: line.result as T };
  }
  const error = (line.error ?? {}) as Record<string, unknown>;
  return {
    ok: false,
    error: {
      code: (typeof error.code === 'string' ? error.code : 'internal') as AgentError['code'],
      message: typeof error.message === 'string' ? error.message : '',
      approval: typeof error.approval === 'string' ? error.approval : undefined,
      now: typeof error.now === 'number' ? error.now : undefined,
    },
  };
}

export class AgentClient {
  private key: Uint8Array | undefined;
  private agent: string | undefined;
  /** The agent's clock minus this page's, in seconds, learned from a `stale` answer. */
  private offset = 0;

  constructor(
    private readonly store: KeyStore,
    private readonly fetchFn: FetchFn,
    private readonly clock: () => number = () => Date.now() / 1000,
    private readonly random: (bytes: number) => Uint8Array = (bytes) =>
      crypto.getRandomValues(new Uint8Array(bytes)),
  ) {}

  /** Takes up the kept session key (or makes one) and the agent's key, if known. */
  async load(): Promise<void> {
    if (this.key !== undefined) {
      return;
    }
    const kept = (await this.store.getItem(KEY_ITEM)) ?? '';
    if (HEX64.test(kept)) {
      this.key = hexToBytes(kept);
    } else {
      this.key = generateSecretKey();
      this.store.setItem(KEY_ITEM, bytesToHex(this.key));
    }
    const agent = (await this.store.getItem(AGENT_ITEM)) ?? '';
    this.agent = HEX64.test(agent) ? agent : undefined;
  }

  /** This page's session key (public, 64 hex): what the operator sees in `bipnip sessions`. */
  async sessionKey(): Promise<string> {
    await this.load();
    return getPublicKey(this.key as Uint8Array);
  }

  /** The agent's key, once a pairing answer named it. */
  agentKey(): string | undefined {
    return this.agent;
  }

  private learnAgent(result: unknown): void {
    const agent = (result as { agent?: unknown } | undefined)?.agent;
    if (typeof agent === 'string' && HEX64.test(agent) && agent !== this.agent) {
      this.agent = agent;
      this.store.setItem(AGENT_ITEM, agent);
    }
  }

  /**
   * Sends one request and resolves with the agent's final answer; status lines on the way go to
   * `onLine`. A request the agent finds dated too far from its own clock is sent once more, dated by
   * the agent's clock.
   */
  async call<T>(
    method: string,
    params: Record<string, unknown> = {},
    onLine?: (line: StatusLine) => void,
    signal?: AbortSignal,
  ): Promise<AgentAnswer<T>> {
    await this.load();
    const first = await this.send<T>(method, params, onLine, signal);
    if (!first.ok && first.error.code === 'stale' && first.error.now !== undefined) {
      this.offset = first.error.now - this.clock();
      return await this.send<T>(method, params, onLine, signal);
    }
    return first;
  }

  private async send<T>(
    method: string,
    params: Record<string, unknown>,
    onLine: ((line: StatusLine) => void) | undefined,
    signal: AbortSignal | undefined,
  ): Promise<AgentAnswer<T>> {
    const event = signRequest(
      this.key as Uint8Array,
      method,
      params,
      this.clock() + this.offset,
      this.agent,
      this.random(16),
    );
    let response: Fetched;
    try {
      response = await this.fetchFn(CALL_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        credentials: 'omit',
        cache: 'no-store',
        signal,
      });
    } catch {
      return failure('no-agent', 'the host could not be reached');
    }
    if (!response.ok || response.body === null) {
      const text = await response.text().catch(() => '');
      return failure(
        response.status === 503 ? 'no-agent' : 'host',
        text !== '' ? text : `the host answered ${response.status}`,
      );
    }
    let final: Record<string, unknown> | undefined;
    const take = (lines: string[]): void => {
      for (const text of lines) {
        const line = parseLine(text);
        if (line === undefined) {
          continue;
        }
        if ('ok' in line) {
          final = line;
        } else {
          onLine?.(line);
        }
      }
    };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const splitter = new LineSplitter();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        take(splitter.push(decoder.decode(value, { stream: true })));
      }
    } catch {
      // Aborted (a watch that was stopped), or the connection broke.
    }
    take(splitter.push(decoder.decode()));
    take(splitter.end());
    if (final === undefined) {
      return failure('host', 'the answer ended before the agent finished it');
    }
    const answer = answerOf<T>(final);
    if (answer.ok) {
      this.learnAgent(answer.result);
    }
    return answer;
  }

  /**
   * Follows the agent's runs (or one of them): every change goes to `onLine` until `stop()`. The
   * returned promise settles when the watch ends: stopped, refused, or the agent went away.
   */
  watch(
    onLine: (line: StatusLine) => void,
    run?: string,
  ): { stop: () => void; done: Promise<AgentAnswer<never>> } {
    const controller = new AbortController();
    const done = this.call<never>('watch', run !== undefined ? { run } : {}, onLine, controller.signal);
    return { stop: () => controller.abort(), done };
  }

  /** Asks to be paired (the operator must have opened pairing); the answer has the code to show. */
  async pair(label: string): Promise<AgentAnswer<PairStatus>> {
    return await this.call<PairStatus>('pair.request', label !== '' ? { label } : {});
  }

  /** Where this page stands with the agent. */
  async pairStatus(): Promise<AgentAnswer<PairStatus>> {
    return await this.call<PairStatus>('pair.status');
  }

  /** Ends this page's session at the agent, then forgets its key: a later pairing starts afresh. */
  async end(): Promise<AgentAnswer<unknown>> {
    const answer = await this.call<unknown>('pair.end');
    this.forget();
    return answer;
  }

  /** Forgets the session key and the agent's key. */
  forget(): void {
    this.store.deleteItem(KEY_ITEM);
    this.store.deleteItem(AGENT_ITEM);
    this.key = undefined;
    this.agent = undefined;
    this.offset = 0;
  }
}

/** The page's agent client. */
export const agentClient = new AgentClient(systemClient, async (url, init) => await fetch(url, init));
