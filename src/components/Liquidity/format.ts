// bipnip: how the Liquidity tab writes the agent's numbers. Pure, so it is tested apart from the
// components (`__tests__/format.test.ts`).

import type { LeaseOrder, NodeRecord, Rules, Run } from '../../models/Liquidity.model';

/** Blocks in a day, on average. */
export const BLOCKS_PER_DAY = 144;

/** Satoshi with thin spaces between thousands: 1 000 000. */
export function sats(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** A length in blocks, with the days it is about: "4320 blocks (~30 days)". */
export function blocks(value: number): string {
  const days = value / BLOCKS_PER_DAY;
  const about = days >= 1 ? `~${Math.round(days)} d` : `~${Math.round(days * 24)} h`;
  return `${value} (${about})`;
}

/** A node key cut short for a table: the first 8 and the last 4 hex. */
export function shortKey(key: string | null | undefined): string {
  if (key === null || key === undefined || key.length < 16) {
    return key ?? '-';
  }
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

/** An order's rules in a few words; empty when it sets none. */
export function rules(value: Rules | undefined): string {
  const parts: string[] = [];
  if (value?.min_channels !== undefined && value.min_channels > 0) {
    parts.push(`≥ ${value.min_channels} channels`);
  }
  if (value?.min_capacity_sat !== undefined && value.min_capacity_sat > 0) {
    parts.push(`≥ ${sats(value.min_capacity_sat)} sat`);
  }
  return parts.join(', ');
}

/** A node's record in a few words: what was kept, then what went wrong, never a ratio. */
export function record(value: NodeRecord | undefined): string {
  if (value === undefined) {
    return '-';
  }
  if (value.subjects === 0) {
    return 'new';
  }
  const parts = [
    `${value.kept} kept`,
    `${value.counterparties} ${value.counterparties === 1 ? 'peer' : 'peers'}`,
  ];
  if (value.opened > 0) parts.push(`${value.opened} opened`);
  if (value.closed_early > 0) parts.push(`${value.closed_early} closed early`);
  if (value.missing > 0) parts.push(`${value.missing} missing`);
  if (value.unpaid > 0) parts.push(`${value.unpaid} unpaid`);
  if (value.disputed > 0) parts.push(`${value.disputed} disputed`);
  return parts.join(', ');
}

/** A lease's whole fee at `capacity`, as the agent computes it: base + capacity × ppm / 10⁶. */
export function leaseFee(
  order: Pick<LeaseOrder, 'fee_base_sat' | 'fee_ppm'>,
  capacity: number,
): number {
  return order.fee_base_sat + Math.floor((capacity * order.fee_ppm) / 1_000_000);
}

/** The price per million sat of capacity per block, in sat, from the agent's parts per billion. */
export function pricePerMillionPerBlock(order: Pick<LeaseOrder, 'ppb_per_block'>): string {
  if (order.ppb_per_block === undefined) {
    return '-';
  }
  return (order.ppb_per_block / 1000).toFixed(3);
}

/** A whole number typed into a field, or undefined when it is not one (or is negative). */
export function wholeNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** What a run is, in a line: role, state and its main numbers. */
export function runLine(run: Run): string {
  const terms = run.terms;
  const capacity = terms?.capacity_sat ?? run.offered?.max_capacity_sat ?? undefined;
  const parts = [run.role, run.state];
  if (capacity !== undefined) parts.push(`${sats(capacity)} sat`);
  if (terms?.fee_sat !== undefined && terms.fee_sat !== null)
    parts.push(`fee ${sats(terms.fee_sat)}`);
  if (run.waiting_on) parts.push(`waiting on ${run.waiting_on}`);
  return parts.join(' · ');
}

/** True for a run whose last state was reached: nothing more happens to it. */
export function isDone(run: Run): boolean {
  return run.finished;
}

/** Runs by name, newest change last, from the lists and the watch's lines. */
export function mergeRun(
  runs: Record<string, Run>,
  line: Record<string, unknown>,
): Record<string, Run> {
  if (line.status !== 'run' || typeof line.run !== 'string') {
    return runs;
  }
  const { status: _status, ...fields } = line;
  return { ...runs, [line.run]: { ...runs[line.run], ...(fields as unknown as Run) } };
}
