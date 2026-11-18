// bipnip: pairing this page with the agent. The operator opens pairing where the agent runs, the
// page asks and is given a code, and the operator types that code there. Typing it is the check
// that this page, and no other, is the one being paired.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import type { AgentView } from './useAgent';

interface Props {
  view: AgentView;
  onAsk: (label: string) => Promise<void>;
}

const Command = ({ text }: { text: string }): React.JSX.Element => (
  <Typography
    variant='body2'
    component='pre'
    sx={{ fontFamily: 'monospace', userSelect: 'all', my: 1, whiteSpace: 'pre-wrap' }}
  >
    {text}
  </Typography>
);

const PairPanel = ({ view, onAsk }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const [label, setLabel] = useState('web page');
  const [asking, setAsking] = useState(false);

  if (view.phase === 'no-agent') {
    return (
      <Alert severity='warning'>
        {t('No agent is connected to this host. Start bipnip-webhost with --agent-socket.')}
        {view.problem !== undefined && <Typography variant='body2'>{view.problem}</Typography>}
      </Alert>
    );
  }

  if (view.phase === 'pending' && view.pair?.code) {
    return (
      <Box>
        <Typography variant='h6'>{t('Pair this page')}</Typography>
        <Typography variant='body2'>{t('Where the agent runs, type this code')}</Typography>
        <Typography
          id='bipnip-pair-code'
          variant='h4'
          sx={{ fontFamily: 'monospace', letterSpacing: '0.1em', my: 2, userSelect: 'all' }}
        >
          {view.pair.code}
        </Typography>
        <Command text={`bipnip pair approve ${view.pair.code} --scope trade`} />
        <Typography variant='body2' color='text.secondary'>
          {t(
            'Leave out --scope trade to let this page only look. This page waits until the code is typed.',
          )}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant='h6'>{t('Pair this page with your agent')}</Typography>
      <Typography variant='body2'>{t('First, where the agent runs')}</Typography>
      <Command text='bipnip pair open' />
      <Typography variant='body2'>{t('Then ask from here, within a few minutes.')}</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', my: 2 }}>
        <TextField
          size='small'
          label={t('Name of this page')}
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 32))}
        />
        <Button
          variant='contained'
          disabled={asking}
          onClick={() => {
            setAsking(true);
            void onAsk(label).finally(() => setAsking(false));
          }}
        >
          {t('Ask to pair')}
        </Button>
      </Box>
      {view.problem !== undefined && <Alert severity='info'>{view.problem}</Alert>}
    </Box>
  );
};

export default PairPanel;
