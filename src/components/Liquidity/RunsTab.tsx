// bipnip: the agent's runs, as they change, and this page's requests that wait for approval.

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import { agentClient } from '../../services/agent';
import type { Parked, Run } from '../../models/Liquidity.model';
import { mergeRun, runLine, sats } from './format';

interface Props {
  canTrade: boolean;
}

const RunsTab = ({ canTrade }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [parked, setParked] = useState<Parked[]>([]);
  const [problem, setProblem] = useState<string>();

  const load = useCallback(async (): Promise<void> => {
    const [leases, rings, approvals] = await Promise.all([
      agentClient.call<{ runs: Run[] }>('lease.list'),
      agentClient.call<{ runs: Run[] }>('ring.list'),
      agentClient.call<{ approvals: Parked[] }>('approvals'),
    ]);
    const all: Record<string, Run> = {};
    for (const answer of [leases, rings]) {
      if (answer.ok) {
        for (const run of answer.result.runs) all[run.run] = run;
      } else {
        setProblem(answer.error.message);
      }
    }
    setRuns(all);
    if (approvals.ok) setParked(approvals.result.approvals);
  }, []);

  useEffect(() => {
    void load();
    // Every change of every run, while this tab is open.
    const watch = agentClient.watch((line) => {
      setRuns((before) => mergeRun(before, line));
      if (line.status === 'problem' && typeof line.problem === 'string') {
        setProblem(`${String(line.run)}: ${line.problem}`);
      }
    });
    void watch.done.then((answer) => {
      if (!answer.ok && answer.error.code !== 'host') setProblem(answer.error.message);
    });
    return () => watch.stop();
  }, [load]);

  const cancel = (run: Run): void => {
    void agentClient
      .call<Run>(run.role === 'member' ? 'ring.cancel' : 'lease.cancel', { run: run.run })
      .then((answer) => {
        if (answer.ok) {
          setRuns((before) => ({ ...before, [run.run]: { ...before[run.run], ...answer.result } }));
        } else {
          setProblem(answer.error.message);
        }
      });
  };

  const list = Object.values(runs).sort((a, b) => Number(a.finished) - Number(b.finished));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size='small' onClick={() => void load()}>
          {t('Refresh')}
        </Button>
      </Box>
      {problem !== undefined && (
        <Alert severity='warning' onClose={() => setProblem(undefined)} sx={{ my: 1 }}>
          {problem}
        </Alert>
      )}
      {parked.length > 0 && (
        <>
          <Typography variant='h6'>{t('Waiting for your approval')}</Typography>
          {parked.map((request) => (
            <Card key={request.approval} variant='outlined' sx={{ my: 1 }} className='bipnip-parked'>
              <CardContent>
                <Typography variant='body2'>
                  {request.method} · {t('fee up to')} {sats(request.ask.fee_sat)} ·{' '}
                  {t('channel up to')} {sats(request.ask.capacity_sat)} · {t('bond')}{' '}
                  {sats(request.ask.bond_sat)}
                </Typography>
                <Typography
                  variant='body2'
                  component='pre'
                  sx={{ fontFamily: 'monospace', userSelect: 'all', mt: 1 }}
                >
                  {`bipnip approve ${request.approval}`}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </>
      )}
      <Typography variant='h6'>{t('Runs')}</Typography>
      {list.length === 0 && <Typography variant='body2'>{t('No run yet.')}</Typography>}
      {list.map((run) => (
        <Card
          key={run.run}
          variant='outlined'
          sx={{ my: 1, opacity: run.finished ? 0.6 : 1 }}
          className='bipnip-run'
          data-run={run.run}
          data-state={run.state}
        >
          <CardContent>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant='body1'>{runLine(run)}</Typography>
              {run.mine === true && <Chip size='small' label={t('asked here')} />}
              {run.watching && <Chip size='small' label={t('watched to its end')} />}
              {run.halted !== undefined && <Chip size='small' color='error' label={t('halted')} />}
            </Box>
            {run.channel !== undefined && run.channel !== null && (
              <Typography variant='caption' display='block'>
                {t('channel')} {run.channel}
              </Typography>
            )}
            {run.terms?.ends_at_height !== undefined && run.terms.ends_at_height !== null && (
              <Typography variant='caption' display='block'>
                {t('ends at block')} {run.terms.ends_at_height}
              </Typography>
            )}
            {canTrade && run.mine === true && !run.finished && !run.watching && (
              <Button size='small' color='warning' onClick={() => cancel(run)}>
                {t('Cancel')}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default RunsTab;
