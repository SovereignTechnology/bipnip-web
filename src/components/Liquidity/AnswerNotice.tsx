// bipnip: what the agent said to a request that starts a run. From a page that is always "parked":
// the operator approves it where the agent runs, and is shown there what it would really do.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Typography } from '@mui/material';
import type { AgentAnswer } from '../../models/Liquidity.model';

interface Props {
  answer: AgentAnswer<unknown> | undefined;
}

const AnswerNotice = ({ answer }: Props): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (answer === undefined) {
    return null;
  }
  if (answer.ok) {
    return <Alert severity='success'>{t('Started.')}</Alert>;
  }
  if (answer.error.code === 'needs-approval') {
    return (
      <Alert severity='info'>
        <Typography variant='body2'>
          {t('Waiting for your approval where the agent runs. There, run')}
        </Typography>
        <Typography
          variant='body2'
          component='pre'
          sx={{ fontFamily: 'monospace', userSelect: 'all', my: 1 }}
        >
          {`bipnip approve ${answer.error.approval ?? ''}`}
        </Typography>
        <Typography variant='body2'>
          {t(
            'It shows what this request would really do before you say yes. Nothing moves until then.',
          )}
        </Typography>
      </Alert>
    );
  }
  return <Alert severity='error'>{answer.error.message}</Alert>;
};

export default AnswerNotice;
