// bipnip: offering liquidity for lease, or proposing a ring. Either is a request to the agent that
// waits for the operator's approval where the agent runs.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { agentClient } from '../../services/agent';
import type { AgentAnswer } from '../../models/Liquidity.model';
import AnswerNotice from './AnswerNotice';
import { wholeNumber } from './format';

interface Field {
  key: string;
  label: string;
  initial: string;
  required: boolean;
}

const LEASE_FIELDS: Field[] = [
  { key: 'min_capacity_sat', label: 'Smallest channel, sat', initial: '500000', required: true },
  { key: 'max_capacity_sat', label: 'Largest channel, sat', initial: '2000000', required: true },
  { key: 'duration_blocks', label: 'Length, blocks', initial: '4320', required: true },
  { key: 'fee_base_sat', label: 'Base fee, sat', initial: '0', required: true },
  { key: 'fee_ppm', label: 'Fee, ppm of capacity', initial: '2500', required: true },
  { key: 'feerate_sat_vb', label: 'Funding fee rate, sat/vB', initial: '2', required: true },
  { key: 'upfront_percent', label: 'Paid upfront, %', initial: '100', required: true },
  { key: 'bond_sat', label: 'Buyer bond, sat', initial: '0', required: false },
  { key: 'min_buyer_channels', label: 'Buyer has at least, channels', initial: '', required: false },
  { key: 'min_buyer_capacity_sat', label: 'Buyer has at least, sat', initial: '', required: false },
];

const RING_FIELDS: Field[] = [
  { key: 'capacity_sat', label: 'Each channel, sat', initial: '1000000', required: true },
  { key: 'slots', label: 'Members, you included', initial: '3', required: true },
  { key: 'feerate_sat_vb', label: 'Funding fee rate, sat/vB', initial: '2', required: true },
  { key: 'open_window_secs', label: 'Time to open, seconds', initial: '172800', required: true },
  { key: 'bond_sat', label: 'Bond per member, sat', initial: '0', required: false },
  { key: 'min_channels', label: 'Members have at least, channels', initial: '', required: false },
  { key: 'min_capacity_sat', label: 'Members have at least, sat', initial: '', required: false },
];

const initial = (fields: Field[]): Record<string, string> =>
  Object.fromEntries(fields.map((field) => [field.key, field.initial]));

interface Props {
  canTrade: boolean;
}

const MakeTab = ({ canTrade }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'lease' | 'ring'>('lease');
  const fields = kind === 'lease' ? LEASE_FIELDS : RING_FIELDS;
  const [values, setValues] = useState<Record<string, string>>(initial(LEASE_FIELDS));
  const [isPrivate, setPrivate] = useState(false);
  const [answer, setAnswer] = useState<AgentAnswer<unknown>>();
  const [sending, setSending] = useState(false);

  // Every number is read as a whole number before it is sent; an empty optional field is left out.
  const params: Record<string, unknown> = {};
  let valid = true;
  for (const field of fields) {
    const text = values[field.key] ?? '';
    if (text.trim() === '' && !field.required) {
      continue;
    }
    const value = wholeNumber(text);
    if (value === undefined) {
      valid = false;
    } else {
      params[field.key] = value;
    }
  }
  if (isPrivate) {
    params.announce = false;
  }

  const switchKind = (next: 'lease' | 'ring' | null): void => {
    if (next === null) return;
    setKind(next);
    setValues(initial(next === 'lease' ? LEASE_FIELDS : RING_FIELDS));
    setAnswer(undefined);
  };

  const send = (): void => {
    setSending(true);
    void agentClient
      .call<unknown>(kind === 'lease' ? 'lease.offer' : 'ring.create', params)
      .then(setAnswer)
      .finally(() => setSending(false));
  };

  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        size='small'
        value={kind}
        onChange={(_e, next: 'lease' | 'ring' | null) => switchKind(next)}
        sx={{ my: 1 }}
      >
        <ToggleButton value='lease'>{t('Offer a lease')}</ToggleButton>
        <ToggleButton value='ring'>{t('Propose a ring')}</ToggleButton>
      </ToggleButtonGroup>
      <Grid container spacing={1}>
        {fields.map((field) => {
          const text = values[field.key] ?? '';
          const bad = !(text.trim() === '' && !field.required) && wholeNumber(text) === undefined;
          return (
            <Grid key={`${kind}-${field.key}`} size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size='small'
                name={field.key}
                label={t(field.label)}
                value={text}
                error={bad}
                onChange={(e) => {
                  setValues({ ...values, [field.key]: e.target.value });
                  setAnswer(undefined);
                }}
              />
            </Grid>
          );
        })}
      </Grid>
      <FormControlLabel
        control={<Checkbox checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />}
        label={t('Unannounced channel')}
      />
      <Typography variant='body2' color='text.secondary' sx={{ my: 1 }}>
        {t('Nothing is offered until you approve it where the agent runs.')}
      </Typography>
      <Button
        variant='contained'
        disabled={!canTrade || !valid || sending}
        onClick={send}
        sx={{ mb: 1 }}
      >
        {kind === 'lease' ? t('Ask to offer') : t('Ask to propose')}
      </Button>
      {!canTrade && (
        <Typography variant='body2'>{t('This page was paired to look only')}</Typography>
      )}
      <AnswerNotice answer={answer} />
    </Box>
  );
};

export default MakeTab;
