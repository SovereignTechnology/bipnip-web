// bipnip: a page's request to its agent, signed with the page's session key
// (`bipnip/docs/decisions/0011-key-roles-pairing-and-session-keys.md`).
//
// A request is a Nostr event of kind 24735 that is never published: the page's host passes it to
// the agent unread, and the agent checks it. Its content is an ordinary request line; a `p` tag
// names the agent (left out only before pairing, when the page does not know the agent yet); a
// `nonce` tag keeps two equal requests apart, since the agent takes each one once.

import { finalizeEvent, type Event } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';

/** The kind of a page's request event. */
export const KIND_WEB_REQUEST = 24735;

/** The request line the agent reads, exactly as it goes into the event. */
export function requestLine(method: string, params: Record<string, unknown> = {}): string {
  return JSON.stringify({ v: 1, method, params });
}

/**
 * A request signed with `sessionKey`, made at `createdAt` (unix seconds, the agent's clock as far as
 * this page knows it), for `agent` (its key, 64 hex) when known. `nonce` is 16 random bytes.
 */
export function signRequest(
  sessionKey: Uint8Array,
  method: string,
  params: Record<string, unknown>,
  createdAt: number,
  agent: string | undefined,
  nonce: Uint8Array,
): Event {
  const tags: string[][] = [['nonce', bytesToHex(nonce)]];
  if (agent !== undefined) {
    tags.push(['p', agent]);
  }
  return finalizeEvent(
    {
      kind: KIND_WEB_REQUEST,
      created_at: Math.floor(createdAt),
      tags,
      content: requestLine(method, params),
    },
    sessionKey,
  );
}
