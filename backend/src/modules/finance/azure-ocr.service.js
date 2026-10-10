import { z } from 'zod';
import { PDFDocument } from 'pdf-lib';
import { HttpError } from '../../shared/records.js';

const apiVersion = '2024-11-30';
const model = 'prebuilt-invoice';
const fieldNames = {
  InvoiceTotal: 'TOTAL',
  VendorName: 'VENDOR_NAME',
  InvoiceDate: 'INVOICE_RECEIPT_DATE',
  InvoiceId: 'INVOICE_RECEIPT_ID',
  SubTotal: 'SUBTOTAL',
  TotalTax: 'TAX',
  TotalDiscount: 'DISCOUNT',
};
const fieldSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  content: z.string().optional(),
  valueString: z.string().optional(),
  valueDate: z.string().optional(),
  valueCurrency: z
    .object({ amount: z.number().finite(), currencyCode: z.string().optional() })
    .optional(),
});
const responseSchema = z.object({
  status: z.enum(['notStarted', 'running', 'succeeded', 'failed']),
  analyzeResult: z
    .object({
      documents: z.array(z.object({ fields: z.record(z.string(), fieldSchema) })).optional(),
    })
    .optional(),
});

export class AzureOcrService {
  constructor({ env, repo, fetchImpl = fetch }) {
    Object.assign(this, { env, repo, fetchImpl });
  }
  endpoint() {
    if (
      !this.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ||
      this.env.AZURE_DOCUMENT_INTELLIGENCE_TIER !== 'F0'
    )
      throw new HttpError(
        503,
        'Configure Azure Document Intelligence with the F0 free tier before checking receipts.',
      );
    let url;
    try {
      url = new URL(this.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT);
    } catch {}
    if (
      !url ||
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.cognitiveservices.azure.com') ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new HttpError(503, 'Configure the Azure Document Intelligence resource endpoint.');
    return url.origin;
  }
  async start({ bytes, contentType }) {
    const endpoint = this.endpoint();
    if (bytes.length > 4 * 1024 * 1024)
      throw new HttpError(400, 'The free OCR tier accepts files up to 4 MB.');
    let pages = 1;
    if (contentType === 'application/pdf') {
      try {
        pages = (await PDFDocument.load(bytes)).getPageCount();
      } catch {
        throw new HttpError(400, 'Upload a readable, unlocked PDF receipt.');
      }
    }
    if (pages < 1 || pages > 2)
      throw new HttpError(
        400,
        'Free OCR checks up to two pages. Upload a receipt with one or two pages.',
      );
    await this.reservePages(pages);
    const response = await this.fetchImpl(
      `${endpoint}/documentintelligence/documentModels/${model}:analyze?api-version=${apiVersion}`,
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Ocp-Apim-Subscription-Key': this.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64Source: bytes.toString('base64') }),
        signal: AbortSignal.timeout(18000),
      },
    );
    if (response.status === 429)
      throw new HttpError(
        429,
        'The free OCR service is busy or its allowance is exhausted. Retry later.',
      );
    if (response.status !== 202)
      throw new HttpError(
        503,
        'Azure receipt OCR is unavailable. Check the free resource configuration.',
      );
    const location = new URL(response.headers.get('operation-location'));
    const id = z.uuid().parse(location.pathname.split('/').at(-1));
    if (
      location.origin !== endpoint ||
      location.pathname !== `/documentintelligence/documentModels/${model}/analyzeResults/${id}`
    )
      throw new HttpError(503, 'Unexpected OCR operation response.');
    return id;
  }
  async result(jobId) {
    const endpoint = this.endpoint();
    z.uuid().parse(jobId);
    const response = await this.fetchImpl(
      `${endpoint}/documentintelligence/documentModels/${model}/analyzeResults/${jobId}?api-version=${apiVersion}`,
      {
        redirect: 'error',
        headers: { 'Ocp-Apim-Subscription-Key': this.env.AZURE_DOCUMENT_INTELLIGENCE_KEY },
        signal: AbortSignal.timeout(18000),
      },
    );
    if (!response.ok) throw new HttpError(503, 'Azure OCR status is unavailable. Retry later.');
    const result = responseSchema.parse(await response.json());
    if (result.status === 'running' || result.status === 'notStarted')
      return { status: 'IN_PROGRESS', documents: [] };
    if (result.status === 'failed') return { status: 'FAILED', documents: [] };
    const documents = (result.analyzeResult?.documents || []).map((document, index) => ({
      ExpenseIndex: index + 1,
      SummaryFields: Object.entries(fieldNames).flatMap(([source, name]) => {
        const field = document.fields[source];
        if (!field) return [];
        const confidence = (field.confidence || 0) * 100;
        const value = field.valueCurrency
          ? field.valueCurrency.amount.toFixed(2)
          : field.valueDate || field.valueString || field.content || '';
        return [
          {
            Type: { Text: name, Confidence: confidence },
            ValueDetection: { Text: value, Confidence: confidence },
            ...(field.valueCurrency?.currencyCode
              ? { Currency: { Code: field.valueCurrency.currencyCode } }
              : {}),
          },
        ];
      }),
    }));
    return { status: 'SUCCEEDED', documents };
  }
  async reservePages(pages) {
    // API keys cannot identify the SKU. Provision F0 in Azure; this quota adds a
    // conservative 400-page application cap shared across all clubs and users.
    const pk = 'OCR_QUOTA#AZURE_F0',
      sk = new Date().toISOString().slice(0, 7);
    for (let attempt = 0; attempt < 10; attempt++) {
      const prior = await this.repo.get(pk, sk);
      if ((prior?.reservedPages || 0) + pages > 400)
        throw new HttpError(
          429,
          'The monthly free OCR allowance is exhausted. Try again next month.',
        );
      const item = {
        pk,
        sk,
        version: (prior?.version || 0) + 1,
        reservedPages: (prior?.reservedPages || 0) + pages,
      };
      const operation = prior
        ? {
            item,
            condition: '#version = :version',
            names: { '#version': 'version' },
            values: { ':version': prior.version },
          }
        : { item, condition: 'attribute_not_exists(pk)' };
      if (await this.repo.atomic([operation])) return;
    }
    throw new HttpError(429, 'OCR requests are busy. Retry later.');
  }
}
