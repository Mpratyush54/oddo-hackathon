import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { AzureOcrService } from '../../src/modules/finance/azure-ocr.service.js';
import { MemoryRepository } from '../../src/database/repositories/memory.repository.js';
import { analyzeReceipt } from '../../src/modules/finance/receipt-analysis.js';

const endpoint = 'https://skyline-qa.cognitiveservices.azure.com';
const id = '11111111-1111-4111-8111-111111111111';
const env = {
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: endpoint,
  AZURE_DOCUMENT_INTELLIGENCE_KEY: 'fake-test-key',
  AZURE_DOCUMENT_INTELLIGENCE_TIER: 'F0',
};
const bytes = Buffer.from('test-only image bytes');
test('Azure F0 sends private bytes, validates operation origin and normalizes invoice fields', async () => {
  const repo = new MemoryRepository(),
    requests = [];
  const ocr = new AzureOcrService({
    env,
    repo,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (options.method === 'POST')
        return new Response(null, {
          status: 202,
          headers: {
            'operation-location': `${endpoint}/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/${id}?api-version=2024-11-30`,
          },
        });
      return Response.json({
        status: 'succeeded',
        analyzeResult: {
          documents: [
            {
              fields: {
                VendorName: { valueString: 'QA Supplies', confidence: 0.99 },
                InvoiceDate: { valueDate: '2026-10-01', confidence: 0.99 },
                InvoiceId: { valueString: 'QA-001', confidence: 0.99 },
                InvoiceTotal: {
                  valueCurrency: { amount: 123.45, currencyCode: 'INR' },
                  confidence: 0.99,
                },
              },
            },
          ],
        },
      });
    },
  });
  assert.equal(await ocr.start({ bytes, contentType: 'image/png' }), id);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    base64Source: bytes.toString('base64'),
  });
  assert.equal(requests[0].options.redirect, 'error');
  const result = await ocr.result(id);
  assert.equal(result.status, 'SUCCEEDED');
  assert.deepEqual(analyzeReceipt(result.documents, 12345).issues, []);
  assert.equal(
    (await repo.get('OCR_QUOTA#AZURE_F0', new Date().toISOString().slice(0, 7))).reservedPages,
    1,
  );
});
test('paid tiers, missing configuration, unsafe endpoints and oversized or truncated PDFs never call Azure', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    throw Error('should not run');
  };
  for (const settings of [
    { ...env, AZURE_DOCUMENT_INTELLIGENCE_TIER: 'S0' },
    { ...env, AZURE_DOCUMENT_INTELLIGENCE_KEY: '' },
    { ...env, AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: 'https://example.com' },
  ])
    await assert.rejects(
      new AzureOcrService({ env: settings, repo: new MemoryRepository(), fetchImpl }).start({
        bytes,
        contentType: 'image/png',
      }),
    );
  const ocr = new AzureOcrService({ env, repo: new MemoryRepository(), fetchImpl });
  await assert.rejects(
    ocr.start({ bytes: Buffer.alloc(4 * 1024 * 1024 + 1), contentType: 'image/png' }),
  );
  const pdf = await PDFDocument.create();
  for (let page = 0; page < 3; page++) pdf.addPage();
  await assert.rejects(
    ocr.start({ bytes: Buffer.from(await pdf.save()), contentType: 'application/pdf' }),
    /two pages/,
  );
  assert.equal(calls, 0);
});
test('monthly quota is atomic across concurrent requests and leaves room below F0 allowance', async () => {
  const repo = new MemoryRepository(),
    month = new Date().toISOString().slice(0, 7);
  await repo.put({ pk: 'OCR_QUOTA#AZURE_F0', sk: month, version: 1, reservedPages: 399 });
  const ocr = new AzureOcrService({ env, repo });
  const results = await Promise.allSettled([ocr.reservePages(1), ocr.reservePages(1)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await repo.get('OCR_QUOTA#AZURE_F0', month)).reservedPages, 400);
});
test('unexpected operation hosts and malformed provider responses fail closed', async () => {
  const ocr = new AzureOcrService({
    env,
    repo: new MemoryRepository(),
    fetchImpl: async () =>
      new Response(null, {
        status: 202,
        headers: {
          'operation-location': `https://example.com/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/${id}`,
        },
      }),
  });
  await assert.rejects(ocr.start({ bytes, contentType: 'image/png' }), /Unexpected OCR/);
  ocr.fetchImpl = async () =>
    Response.json({
      status: 'succeeded',
      analyzeResult: { documents: [{ fields: { InvoiceTotal: { confidence: 9 } } }] },
    });
  await assert.rejects(ocr.result(id));
});
