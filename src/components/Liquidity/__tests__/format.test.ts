/**
 * Tests for the Liquidity tab's number writing (bipnip).
 */

import {
  blocks,
  leaseFee,
  mergeRun,
  pricePerMillionPerBlock,
  record,
  rules,
  runLine,
  sats,
  shortKey,
  wholeNumber,
} from '../format';
import type { Run } from '../../../models/Liquidity.model';

describe('Liquidity numbers', () => {
  it('writes satoshi, blocks and keys for a table', () => {
    expect(sats(1_000_000)).toBe('1 000 000');
    expect(sats(999)).toBe('999');
    expect(sats(null)).toBe('-');
    expect(blocks(4320)).toBe('4320 (~30 d)');
    expect(blocks(6)).toBe('6 (~1 h)');
    expect(shortKey('02'.repeat(33))).toBe('02020202…0202');
    expect(shortKey(undefined)).toBe('-');
  });

  it('prices a lease as the agent does', () => {
    expect(leaseFee({ fee_base_sat: 1000, fee_ppm: 2500 }, 1_000_000)).toBe(3500);
    expect(leaseFee({ fee_base_sat: 0, fee_ppm: 1 }, 999_999)).toBe(0);
    expect(pricePerMillionPerBlock({ ppb_per_block: 1234 })).toBe('1.234');
    expect(pricePerMillionPerBlock({})).toBe('-');
  });

  it('says rules and records in words, and never folds a record into a ratio', () => {
    expect(rules(undefined)).toBe('');
    expect(rules({ min_channels: 5, min_capacity_sat: 2_000_000 })).toBe('≥ 5 channels, ≥ 2 000 000 sat');
    const empty = {
      kept: 0, opened: 0, missing: 0, closed_early: 0, disputed: 0, unpaid: 0, counterparties: 0, subjects: 0,
    };
    expect(record(undefined)).toBe('-');
    expect(record(empty)).toBe('new');
    expect(record({ ...empty, kept: 3, counterparties: 2, closed_early: 1, subjects: 4 })).toBe(
      '3 kept, 2 peers, 1 closed early',
    );
  });

  it('reads only whole numbers from a field', () => {
    expect(wholeNumber(' 600000 ')).toBe(600000);
    expect(wholeNumber('6e5')).toBeUndefined();
    expect(wholeNumber('-1')).toBeUndefined();
    expect(wholeNumber('1.5')).toBeUndefined();
    expect(wholeNumber('')).toBeUndefined();
    expect(wholeNumber('99999999999999999999')).toBeUndefined();
  });

  it('keeps runs by name as the watch tells their changes', () => {
    const first: Run = {
      run: 'buyer-0a', role: 'buyer', state: 'taking', finished: false, watching: false, mine: true,
    };
    let runs: Record<string, Run> = { [first.run]: first };
    runs = mergeRun(runs, { status: 'watching' });
    expect(runs).toEqual({ [first.run]: first });
    runs = mergeRun(runs, { status: 'run', run: 'buyer-0a', role: 'buyer', state: 'active', finished: false, watching: true });
    expect(runs['buyer-0a'].state).toBe('active');
    expect(runs['buyer-0a'].mine).toBe(true);
    expect(runLine({ ...runs['buyer-0a'], terms: { capacity_sat: 600000, fee_sat: 2500 } })).toBe(
      'buyer · active · 600 000 sat · fee 2 500',
    );
  });
});
