import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildDemoData, mergeDemoData, demoCollections, topUpDemoData } from './lib/demo-data.js';
import { ownerAws, ownerRepository, ownerCredentials } from './lib/aws-owner.js';
import { hashPassword } from '../backend/src/modules/auth/password.js';
import {
  clubKey,
  timestamp,
  recordId,
  dateToday,
  MAX_CLUB_DATA_BYTES,
} from '../backend/src/shared/records.js';
import { parseDatabaseRecord } from '../backend/src/database/schemas/index.js';

export async function seedDemoData({
  repo,
  base,
  demo,
  apply = false,
  receiptUploader,
  topUp = false,
}) {
  if (topUp) {
    const current = Object.fromEntries(
      await Promise.all(
        base.organizations.map(async (club) => [
          club.id,
          (await repo.get(clubKey(club.id), 'STATE')).data,
        ]),
      ),
    );
    demo = topUpDemoData(current, demo);
  }
  for (const row of demo.records) {
    if (!(
      row.id?.startsWith('DEMO-') ||
      row.id?.startsWith('RECEIPT-DEMO-') ||
      row.pk.startsWith('USER#DEMO-')
    ))
      throw new Error('Non-demo record in seed plan.');
    parseDatabaseRecord(row);
  }
  const sizes = {},
    counts = Object.fromEntries(demoCollections.map((c) => [c, 0]));
  const before = {};
  for (const club of base.organizations) {
    const current = await repo.get(clubKey(club.id), 'STATE');
    if (!current) throw new Error(`Club ${club.id} has not been initialized.`);
    before[club.id] = current;
    const data = mergeDemoData(current.data, demo.clubs[club.id]);
    parseDatabaseRecord({ ...current, data });
    sizes[club.id] = Buffer.byteLength(JSON.stringify(data));
    if (sizes[club.id] > MAX_CLUB_DATA_BYTES - 20000)
      throw new Error(
        `Club ${club.id} would exceed the safe seed size (${sizes[club.id]} bytes). No writes have been made.`,
      );
    for (const c of demoCollections) counts[c] += demo.clubs[club.id][c].length;
  }
  if (!apply) return { apply: false, sizes, counts, databaseRecords: demo.records.length };
  await mkdir('.aws-build', { recursive: true });
  await writeFile(`.aws-build/demo-backup-${Date.now()}.json`, JSON.stringify(before));
  let created = 0;
  // Only demo namespaces are accepted, and existing records are never overwritten.
  for (let start = 0; start < demo.records.length; start += 10) {
    const batch = demo.records.slice(start, start + 10);
    const inserted = await Promise.all(
      batch.map(async (row) => {
        if (row.sk.startsWith('RECEIPT#') && receiptUploader && !(await repo.get(row.pk, row.sk)))
          await receiptUploader(row);
        return repo.put(row, true);
      }),
    );
    created += inserted.filter(Boolean).length;
  }
  for (const club of base.organizations) {
    let committed = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await repo.get(clubKey(club.id), 'STATE');
      const data = mergeDemoData(current.data, demo.clubs[club.id]);
      if (Buffer.byteLength(JSON.stringify(data)) > MAX_CLUB_DATA_BYTES - 20000)
        throw new Error('Club grew during seeding; rerun after archiving old records.');
      if (demoCollections.every((c) => (data[c]?.length || 0) === (current.data[c]?.length || 0))) {
        committed = true;
        break;
      }
      const audit = {
        pk: clubKey(club.id),
        sk: `AUDIT#${timestamp()}#${recordId('AUD')}`,
        actor: 'SYSTEM',
        action: 'demo.seed',
        date: timestamp(),
        detail: 'Added linked demo data; messaging preferences disabled.',
      };
      if (
        await repo.atomic([
          {
            item: { ...current, data, version: current.version + 1 },
            condition: '#version = :version',
            names: { '#version': 'version' },
            values: { ':version': current.version },
          },
          { item: audit, condition: 'attribute_not_exists(pk)' },
        ])
      ) {
        committed = true;
        break;
      }
    }
    if (!committed)
      throw new Error(`Concurrent changes prevented seeding ${club.id}; safely rerun.`);
  }
  return { apply: true, sizes, counts, createdRecords: created };
}
export async function demoReceiptPdf(record) {
  const document = await PDFDocument.create(),
    font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595, 842]);
  const lines = [
    'SKYLINE DEMO RECEIPT - NOT A REAL INVOICE',
    record.extracted.vendor,
    'Invoice: ' + record.extracted.invoiceNumber,
    'Date: ' + record.extracted.dateText,
    'Sample amount: INR ' + (record.claimedAmount / 100).toFixed(2),
    'This document is generated for testing the review interface.',
    'No purchase, payment or OCR verification took place.',
  ];
  for (let i = 0; i < lines.length; i++)
    page.drawText(lines[i], {
      x: 40,
      y: 780 - i * 35,
      size: i === 0 ? 14 : 11,
      font,
      color: rgb(0.1, 0.25, 0.22),
    });
  return Buffer.from(await document.save());
}
async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const base = JSON.parse(await readFile(resolve(root, 'backend/data/seed.json'), 'utf8'));
  const region = process.env.AWS_REGION || 'ap-south-1',
    stack = process.env.AWS_STACK_NAME || 'skyline-campus-api';
  const deployed = await ownerAws(
    ['cloudformation', 'describe-stacks', '--stack-name', stack],
    region,
  );
  const outputs = Object.fromEntries(
    deployed.Stacks[0].Outputs.map((o) => [o.OutputKey, o.OutputValue]),
  );
  const repo = ownerRepository(outputs.DataTable, region);
  const passwordHash = await hashPassword(randomBytes(48).toString('base64url'));
  const demo = buildDemoData({
    organizations: base.organizations,
    today: dateToday(),
    passwordHash,
  });
  const s3 = new S3Client({ region, credentials: ownerCredentials(region) });
  const receiptUploader = async (record) => {
    const bytes = await demoReceiptPdf(record);
    record.contentHash = createHash('sha256').update(bytes).digest('hex');
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: outputs.ReceiptsBucket,
          Key: record.receiptKey,
          Body: bytes,
          ContentType: 'application/pdf',
          IfNoneMatch: '*',
        }),
      );
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 412) throw error;
    }
  };
  const result = await seedDemoData({
    repo,
    base,
    demo,
    apply: process.argv.includes('--apply'),
    topUp: process.argv.includes('--top-up'),
    receiptUploader,
  });
  console.log(JSON.stringify(result));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.name + ': ' + error.message);
    process.exitCode = 1;
  });
