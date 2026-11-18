// bipnip: where this page stands with its agent, kept up to date for the Liquidity tab.

import { useCallback, useEffect, useState } from 'react';
import { agentClient } from '../../services/agent';
import type { AgentStatus, PairStatus } from '../../models/Liquidity.model';

export type Phase = 'loading' | 'no-agent' | 'unpaired' | 'pending' | 'paired';

export interface AgentView {
  phase: Phase;
  pair?: PairStatus;
  status?: AgentStatus;
  /** What went wrong last, as the agent or the host said it. */
  problem?: string;
}

/** How often a page that waits to be paired asks whether it is, in ms. */
const PAIR_POLL_MS = 3000;

export function useAgent(): {
  view: AgentView;
  refresh: () => Promise<void>;
  askToPair: (label: string) => Promise<void>;
  disconnect: () => Promise<void>;
} {
  const [view, setView] = useState<AgentView>({ phase: 'loading' });

  const refresh = useCallback(async (): Promise<void> => {
    const pair = await agentClient.pairStatus();
    if (!pair.ok) {
      setView({
        phase: pair.error.code === 'no-agent' ? 'no-agent' : 'unpaired',
        problem: pair.error.message,
      });
      return;
    }
    if (!pair.result.paired) {
      setView({ phase: pair.result.pending ? 'pending' : 'unpaired', pair: pair.result });
      return;
    }
    const status = await agentClient.call<AgentStatus>('status');
    setView({
      phase: status.ok || status.error.code !== 'unpaired' ? 'paired' : 'unpaired',
      pair: pair.result,
      status: status.ok ? status.result : undefined,
      problem: status.ok ? undefined : status.error.message,
    });
  }, []);

  const askToPair = useCallback(async (label: string): Promise<void> => {
    const answer = await agentClient.pair(label);
    if (!answer.ok) {
      setView((before) => ({ ...before, phase: 'unpaired', problem: answer.error.message }));
      return;
    }
    if (answer.result.paired) {
      await refresh();
    } else {
      setView({ phase: 'pending', pair: answer.result });
    }
  }, [refresh]);

  const disconnect = useCallback(async (): Promise<void> => {
    await agentClient.end();
    setView({ phase: 'unpaired' });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // While the page waits for the operator to type its code, it asks now and then.
  useEffect(() => {
    if (view.phase !== 'pending') {
      return;
    }
    const timer = setInterval(() => {
      void refresh();
    }, PAIR_POLL_MS);
    return () => clearInterval(timer);
  }, [view.phase, refresh]);

  return { view, refresh, askToPair, disconnect };
}
