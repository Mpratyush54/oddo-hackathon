/**
 * Restore a paid ticket onto club STATE from payment.result when seed/overwrite wiped it.
 * Usage: node scripts/restore-paid-ticket.js pay_TmL3n41rP5IDPQ [clubId]
 */
import { readFile } from 'node:fs/promises';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const paymentId = process.argv[2];
const clubId = process.argv[3] || 'skyline';
if (!paymentId) throw new Error('Usage: node scripts/restore-paid-ticket.js <razorpay_payment_id> [clubId]');

const deployment = JSON.parse(await readFile('AWS_DEPLOYMENT_OUTPUT.json', 'utf8'));
const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: deployment.region }),
  { marshallOptions: { removeUndefinedValues: true } },
);
const table = deployment.DataTable;
const clubPk = `COLLEGE#skyline-campus#CLUB#${clubId}`;

const refund = (
  await doc.send(new GetCommand({ TableName: table, Key: { pk: clubPk, sk: `REFUND#${paymentId}` } }))
).Item;
if (!refund) throw new Error(`Refund REFUND#${paymentId} not found for ${clubId}`);

const payment = (
  await doc.send(new GetCommand({ TableName: table, Key: { pk: refund.paymentPk, sk: refund.paymentSk } }))
).Item;
if (!payment) throw new Error('Payment record not found');
const ticket = payment.result?.ticket;
if (!ticket?.id) throw new Error('payment.result.ticket is missing; cannot restore.');

const state = (await doc.send(new GetCommand({ TableName: table, Key: { pk: clubPk, sk: 'STATE' } }))).Item;
if (!state?.data) throw new Error('Club STATE not found');
const data = structuredClone(state.data);
const already = data.tickets.some((t) => t.id === ticket.id || t.paymentId === paymentId);
if (!already) {
  data.tickets.unshift({ ...ticket });
  const event = data.events.find((e) => e.id === ticket.eventId);
  if (event && ticket.status !== 'Cancelled')
    event.sold = Math.min(event.capacity, Number(event.sold || 0) + 1);
}

await doc.send(
  new PutCommand({
    TableName: table,
    Item: { ...state, data, version: Number(state.version || 1) + 1 },
  }),
);

console.log(
  JSON.stringify(
    {
      restored: !already,
      ticketId: ticket.id,
      paymentId,
      eventId: ticket.eventId,
      matches: data.tickets.filter((t) => t.paymentId === paymentId).length,
      refundStatus: refund.status,
    },
    null,
    2,
  ),
);
