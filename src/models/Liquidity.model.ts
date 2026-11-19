// bipnip: what the agent answers about liquidity (`bipnip/docs/agent-api.md`), as the Liquidity tab
// reads it. The agent is the source of truth: these are its words, not this page's; amounts are
// whole satoshi unless a name ends in `_msat`.

/** Rules an order asks its takers or members to meet (absent: none). */
export interface Rules {
  min_channels?: number;
  min_capacity_sat?: number;
}

/** A node's record, counted from signed outcomes. */
export interface NodeRecord {
  kept: number;
  opened: number;
  missing: number;
  closed_early: number;
  disputed: number;
  unpaid: number;
  counterparties: number;
  subjects: number;
}

/** Liquidity offered for lease, on one instance's book. */
export interface LeaseOrder {
  kind: 'lease';
  instance: string;
  order_id: string;
  seller_node: string;
  min_capacity_sat: number;
  max_capacity_sat: number;
  duration_blocks: number;
  fee_base_sat: number;
  fee_ppm: number;
  upfront_percent: number;
  min_confirmations: number;
  announce: boolean;
  bond_sat: number;
  rules?: Rules;
  expires_at: number;
  priced_capacity_sat?: number;
  fee_sat?: number;
  ppb_per_block?: number;
  seller_listings?: number;
  seller_record?: NodeRecord;
}

/** A ring with slots left. */
export interface RingOrder {
  kind: 'ring';
  instance: string;
  order_id: string;
  capacity_sat: number;
  slots: number;
  taken: number;
  announce: boolean;
  open_window_secs: number;
  bond_sat: number;
  rules?: Rules;
  expires_at: number;
}

export type LiquidityOrder = LeaseOrder | RingOrder;

/** One book over the agent's instances. */
export interface Book {
  orders: LiquidityOrder[];
  instances_silent: string[];
  relays_down: string[];
  records_failed?: string;
}

/** A lease's numbers. */
export interface LeaseTerms {
  capacity_sat: number;
  fee_sat: number | null;
  upfront_sat: number | null;
  duration_blocks: number;
  announce: boolean;
  peer: string;
  ends_at_height: number | null;
}

/** A run of the agent's, as a page is shown it. */
export interface Run {
  run: string;
  role: 'seller' | 'buyer' | 'member';
  order_id?: string;
  state: string;
  finished: boolean;
  watching: boolean;
  under_way?: boolean;
  halted?: string;
  lease?: string | null;
  ring?: string | null;
  channel?: string | null;
  bond?: string;
  owed_bond?: string;
  waiting_on?: string | null;
  offered?: {
    min_capacity_sat: number;
    max_capacity_sat: number;
    duration_blocks: number;
    fee_base_sat: number;
    fee_ppm: number;
    upfront_percent: number;
    bond_sat: number;
    announce: boolean;
    rules?: Rules;
    expires_at: number;
  };
  terms?: Partial<LeaseTerms> & {
    bond_sat?: number;
    open_window_secs?: number;
    members?: number | null;
  };
  /** True for a run this page asked for. */
  mine?: boolean;
  /** The parked request it was approved from. */
  approval?: string;
}

/** A request of this page's that waits for the operator. */
export interface Parked {
  approval: string;
  at: number;
  method: string;
  params: Record<string, unknown>;
  ask: { fee_sat: number; capacity_sat: number; bond_sat: number; peer: string | null };
  over: string[];
}

/** The agent, as a page is told about it. */
export interface AgentStatus {
  version: string;
  network: string;
  identity: string;
  node: {
    pubkey?: string;
    network?: string;
    block_height?: number;
    synced?: boolean;
    error?: string;
  };
  instances: Array<{ pubkey: string; pow: number }>;
  instances_not_ready: string[];
  runs: { under_way: number; watching: number; halted: number; by_state: Record<string, number> };
  approvals: number;
}

/** Where this page stands with the agent. */
export interface PairStatus {
  paired: boolean;
  pending?: boolean;
  code?: string | null;
  open?: boolean;
  label?: string;
  scope?: 'read' | 'trade';
  expires_at?: number;
  agent: string;
}

/** Why the agent said no. */
export type AgentErrorCode =
  | 'bad-request'
  | 'not-found'
  | 'refused'
  | 'needs-approval'
  | 'busy'
  | 'node'
  | 'relay'
  | 'internal'
  | 'unpaired'
  | 'stale'
  // Said by this page or its host, not by the agent:
  | 'no-agent'
  | 'host';

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  /** For `needs-approval`: the parked request's name. */
  approval?: string;
  /** For `stale`: the agent's time, unix seconds. */
  now?: number;
}

/** The final answer to a request. */
export type AgentAnswer<T> = { ok: true; result: T } | { ok: false; error: AgentError };

/** The whole fee per sat of capacity per block, in parts per billion, shown per million. */
export function pricePerMillionPerBlock(order: LeaseOrder): number | undefined {
  return order.ppb_per_block === undefined ? undefined : order.ppb_per_block / 1000;
}
