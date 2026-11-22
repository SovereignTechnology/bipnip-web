// bipnip: one book over the agent's instances: leases (cheapest first) with their sellers' records,
// and rings with slots left. Taking or joining from here is a request to the agent; it waits for the
// operator's approval where the agent runs.

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { agentClient } from '../../services/agent';
import type {
  AgentAnswer,
  Book,
  LeaseOrder,
  LiquidityOrder,
  RingOrder,
} from '../../models/Liquidity.model';
import AnswerNotice from './AnswerNotice';
import {
  blocks,
  leaseFee,
  pricePerMillionPerBlock,
  record,
  rules,
  sats,
  shortKey,
  wholeNumber,
} from './format';

interface Props {
  canTrade: boolean;
  ownNode?: string;
}

interface TakeProps {
  order: LiquidityOrder;
  onClose: () => void;
}

const TakeDialog = ({ order, onClose }: TakeProps): React.JSX.Element => {
  const { t } = useTranslation();
  const lease = order.kind === 'lease' ? order : undefined;
  const [capacity, setCapacity] = useState(
    String(lease?.priced_capacity_sat ?? lease?.min_capacity_sat ?? ''),
  );
  const [feerate, setFeerate] = useState('2');
  const [address, setAddress] = useState('');
  const [answer, setAnswer] = useState<AgentAnswer<unknown>>();
  const [sending, setSending] = useState(false);

  const capacitySat = wholeNumber(capacity);
  const feerateSat = wholeNumber(feerate);
  const capacityOk =
    lease === undefined ||
    (capacitySat !== undefined &&
      capacitySat >= lease.min_capacity_sat &&
      capacitySat <= lease.max_capacity_sat);
  const valid = lease !== undefined ? capacityOk : feerateSat !== undefined && feerateSat > 0;

  const send = (): void => {
    const params: Record<string, unknown> =
      lease !== undefined
        ? { order_id: order.order_id, capacity_sat: capacitySat, instance: order.instance }
        : { order_id: order.order_id, feerate_sat_vb: feerateSat, instance: order.instance };
    if (address.trim() !== '') {
      params.node_address = address.trim();
    }
    setSending(true);
    void agentClient
      .call<unknown>(lease !== undefined ? 'lease.take' : 'ring.join', params)
      .then(setAnswer)
      .finally(() => setSending(false));
  };

  return (
    <Dialog open onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>{lease !== undefined ? t('Take this lease') : t('Join this ring')}</DialogTitle>
      <DialogContent>
        {lease !== undefined ? (
          <>
            <Typography variant='body2'>
              {t('Seller')} {shortKey(lease.seller_node)} · {t('record')}{' '}
              {record(lease.seller_record)}
            </Typography>
            <TextField
              fullWidth
              margin='dense'
              label={t('Capacity, sat')}
              value={capacity}
              error={!capacityOk}
              helperText={`${sats(lease.min_capacity_sat)} – ${sats(lease.max_capacity_sat)}`}
              onChange={(e) => setCapacity(e.target.value)}
            />
            {capacitySat !== undefined && capacityOk && (
              <Typography variant='body2'>
                {t('Whole fee about {{fee}} sat, {{upfront}}% upfront', {
                  fee: sats(leaseFee(lease, capacitySat)),
                  upfront: lease.upfront_percent,
                })}
                {lease.bond_sat > 0 &&
                  ` · ${t('bond {{bond}} sat', { bond: sats(lease.bond_sat) })}`}
              </Typography>
            )}
          </>
        ) : (
          <TextField
            fullWidth
            margin='dense'
            label={t('Funding fee rate, sat/vB')}
            value={feerate}
            error={feerateSat === undefined || feerateSat === 0}
            onChange={(e) => setFeerate(e.target.value)}
          />
        )}
        <TextField
          fullWidth
          margin='dense'
          label={t('Address of your node, host:port (optional)')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Typography variant='body2' color='text.secondary' sx={{ my: 1 }}>
          {t(
            'The numbers here are this page’s. The agent shows you the real ones when you approve.',
          )}
        </Typography>
        <AnswerNotice answer={answer} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Close')}</Button>
        <Button
          variant='contained'
          disabled={!valid || sending || answer !== undefined}
          onClick={send}
        >
          {lease !== undefined ? t('Ask to take') : t('Ask to join')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const BookTab = ({ canTrade, ownNode }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const [book, setBook] = useState<Book>();
  const [problem, setProblem] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [chosen, setChosen] = useState<LiquidityOrder>();

  const load = useCallback((): void => {
    const params: Record<string, unknown> = { records: true };
    const capacitySat = wholeNumber(capacity);
    const maxFeeSat = wholeNumber(maxFee);
    if (capacitySat !== undefined) params.capacity_sat = capacitySat;
    if (maxFeeSat !== undefined) params.max_fee_sat = maxFeeSat;
    setLoading(true);
    void agentClient
      .call<Book>('orders', params)
      .then((answer) => {
        if (answer.ok) {
          setBook(answer.result);
          setProblem(undefined);
        } else {
          setProblem(answer.error.message);
        }
      })
      .finally(() => setLoading(false));
  }, [capacity, maxFee]);

  useEffect(() => {
    load();
  }, []);

  const leases = (book?.orders ?? []).filter((o): o is LeaseOrder => o.kind === 'lease');
  const rings = (book?.orders ?? []).filter((o): o is RingOrder => o.kind === 'ring');
  const takeButton = (order: LiquidityOrder, label: string): React.JSX.Element => (
    <Tooltip title={canTrade ? '' : t('This page was paired to look only')}>
      <span>
        <Button
          size='small'
          variant='outlined'
          disabled={!canTrade}
          onClick={() => setChosen(order)}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', my: 1 }}>
        <TextField
          size='small'
          label={t('Capacity, sat')}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <TextField
          size='small'
          label={t('Most fee, sat')}
          value={maxFee}
          onChange={(e) => setMaxFee(e.target.value)}
        />
        <Button variant='contained' disabled={loading} onClick={load}>
          {loading ? t('Reading…') : t('Refresh')}
        </Button>
      </Box>
      {problem !== undefined && <Alert severity='error'>{problem}</Alert>}
      {book !== undefined &&
        (book.instances_silent.length > 0 ||
          book.relays_down.length > 0 ||
          book.records_failed !== undefined) && (
          <Alert severity='warning' sx={{ my: 1 }}>
            {book.instances_silent.length > 0 &&
              `${t('Instances with nothing on the relays')} ${book.instances_silent.map(shortKey).join(', ')}. `}
            {book.relays_down.length > 0 && `${t('Relays down')} ${book.relays_down.join(', ')}. `}
            {book.records_failed !== undefined &&
              `${t('Records could not be read')} ${book.records_failed}`}
          </Alert>
        )}

      <Typography variant='h6' sx={{ mt: 2 }}>
        {t('Leases')}
      </Typography>
      <Table size='small' id='bipnip-leases'>
        <TableHead>
          <TableRow>
            <TableCell>{t('Price per M per block')}</TableCell>
            <TableCell>{t('Capacity, sat')}</TableCell>
            <TableCell>{t('Blocks')}</TableCell>
            <TableCell>{t('Fee at capacity')}</TableCell>
            <TableCell>{t('Upfront')}</TableCell>
            <TableCell>{t('Bond')}</TableCell>
            <TableCell>{t('Rules')}</TableCell>
            <TableCell>{t('Seller')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {leases.map((order) => (
            <TableRow key={`${order.instance}-${order.order_id}`} data-order={order.order_id}>
              <TableCell>{pricePerMillionPerBlock(order)}</TableCell>
              <TableCell>
                {sats(order.min_capacity_sat)} – {sats(order.max_capacity_sat)}
              </TableCell>
              <TableCell>{blocks(order.duration_blocks)}</TableCell>
              <TableCell>{sats(order.fee_sat)}</TableCell>
              <TableCell>{order.upfront_percent}%</TableCell>
              <TableCell>{order.bond_sat > 0 ? sats(order.bond_sat) : '-'}</TableCell>
              <TableCell>{rules(order.rules)}</TableCell>
              <TableCell>
                {shortKey(order.seller_node)}{' '}
                {order.seller_node === ownNode && <Chip size='small' label={t('yours')} />}
                <Typography variant='caption' sx={{ display: 'block' }} className='bipnip-record'>
                  {record(order.seller_record)}
                  {order.seller_listings !== undefined && order.seller_listings > 1
                    ? ` · ${order.seller_listings} ${t('listed')}`
                    : ''}
                </Typography>
              </TableCell>
              <TableCell>{order.seller_node !== ownNode && takeButton(order, t('Take'))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {book !== undefined && leases.length === 0 && (
        <Typography variant='body2' sx={{ my: 1 }}>
          {t('No lease on the book.')}
        </Typography>
      )}

      <Typography variant='h6' sx={{ mt: 2 }}>
        {t('Rings')}
      </Typography>
      <Table size='small' id='bipnip-rings'>
        <TableHead>
          <TableRow>
            <TableCell>{t('Channel, sat')}</TableCell>
            <TableCell>{t('Members')}</TableCell>
            <TableCell>{t('Time to open')}</TableCell>
            <TableCell>{t('Bond')}</TableCell>
            <TableCell>{t('Rules')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rings.map((order) => (
            <TableRow key={`${order.instance}-${order.order_id}`} data-order={order.order_id}>
              <TableCell>{sats(order.capacity_sat)}</TableCell>
              <TableCell>
                {order.taken} / {order.slots}
              </TableCell>
              <TableCell>{Math.round(order.open_window_secs / 3600)} h</TableCell>
              <TableCell>{order.bond_sat > 0 ? sats(order.bond_sat) : '-'}</TableCell>
              <TableCell>{rules(order.rules)}</TableCell>
              <TableCell>{takeButton(order, t('Join'))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {book !== undefined && rings.length === 0 && (
        <Typography variant='body2' sx={{ my: 1 }}>
          {t('No ring with slots left.')}
        </Typography>
      )}
      {chosen !== undefined && <TakeDialog order={chosen} onClose={() => setChosen(undefined)} />}
    </Box>
  );
};

export default BookTab;
