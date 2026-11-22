// bipnip: the Liquidity tab. It talks only to the page's own host, which passes its requests to the
// operator's bipnip agent; nothing it asks for moves money until the operator approves it where
// the agent runs. It needs no robot and leaves the RoboSats screens as they are.

import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Chip, CircularProgress, Paper, Tab, Tabs, Typography } from '@mui/material';
import { AppContext, type UseAppStoreType } from '../../contexts/AppContext';
import PairPanel from '../../components/Liquidity/PairPanel';
import BookTab from '../../components/Liquidity/BookTab';
import MakeTab from '../../components/Liquidity/MakeTab';
import RunsTab from '../../components/Liquidity/RunsTab';
import { useAgent } from '../../components/Liquidity/useAgent';

type View = 'book' | 'make' | 'runs';

const LiquidityPage = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { windowSize, navbarHeight } = useContext<UseAppStoreType>(AppContext);
  const { view, askToPair, disconnect } = useAgent();
  const [tab, setTab] = useState<View>('book');
  const maxHeight = (windowSize.height - navbarHeight) * 0.85 - 3;
  const canTrade = view.pair?.scope === 'trade';
  const status = view.status;

  return (
    <Paper
      elevation={12}
      id='bipnip-liquidity'
      data-phase={view.phase}
      sx={{
        padding: '0.8em',
        width: 'min(64em, 96vw)',
        maxHeight: `${maxHeight}em`,
        overflow: 'auto',
      }}
    >
      {view.phase === 'loading' && <CircularProgress />}
      {(view.phase === 'no-agent' || view.phase === 'unpaired' || view.phase === 'pending') && (
        <PairPanel view={view} onAsk={askToPair} />
      )}
      {view.phase === 'paired' && (
        <>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant='h6'>{t('Liquidity')}</Typography>
            {status !== undefined && (
              <>
                <Chip size='small' label={status.network} />
                <Chip
                  size='small'
                  color={status.node.synced === true ? 'success' : 'warning'}
                  label={
                    status.node.synced === true
                      ? t('node synced, block {{height}}', { height: status.node.block_height })
                      : t('node not synced')
                  }
                />
                <Chip
                  size='small'
                  label={t('{{count}} instances', { count: status.instances.length })}
                />
              </>
            )}
            <Chip
              size='small'
              color={canTrade ? 'primary' : 'default'}
              label={`${view.pair?.label ?? ''} · ${canTrade ? t('may ask to trade') : t('looks only')}`}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Button size='small' onClick={() => void disconnect()}>
              {t('Disconnect')}
            </Button>
          </Box>
          <Tabs value={tab} onChange={(_e, next: View) => setTab(next)} sx={{ mb: 1 }}>
            <Tab value='book' label={t('Book')} />
            <Tab value='make' label={t('Make')} />
            <Tab value='runs' label={t('My runs')} />
          </Tabs>
          {tab === 'book' && <BookTab canTrade={canTrade} ownNode={status?.node.pubkey} />}
          {tab === 'make' && <MakeTab canTrade={canTrade} />}
          {tab === 'runs' && <RunsTab canTrade={canTrade} />}
        </>
      )}
    </Paper>
  );
};

export default LiquidityPage;
