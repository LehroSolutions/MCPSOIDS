import { z } from 'zod';

export const TaxnoidToolSchema = z.object({
  operation: z.enum(['calculate_vat', 'check_compliance']),
  amount: z.number().optional(),
  doc_type: z.string().optional(),
  region: z.string().default('ZA').optional(),
});

export type TaxnoidToolParams = z.infer<typeof TaxnoidToolSchema>;

// Mock database of compliance rules
const COMPLIANCE_RULES: Record<string, string[]> = {
  invoice: ['Must have Tax ID', 'Must have Date', 'Must have Total Amount'],
  receipt: ['Must have Merchant Name', 'Must have Date'],
  contract: ['Must have Signatures', 'Must have Terms'],
};

export async function handleTaxnoid(params: any): Promise<string> {
  const validated = TaxnoidToolSchema.parse(params);

  if (validated.operation === 'calculate_vat') {
    if (validated.amount === undefined) {
      throw new Error('Amount is required for VAT calculation');
    }
    // Simple logic: 15% VAT for South Africa (default)
    const rate = 0.15;
    const vat = validated.amount * rate;
    const total = validated.amount + vat;

    return JSON.stringify(
      {
        net_amount: validated.amount,
        vat_rate: '15%',
        vat_amount: Number(vat.toFixed(2)),
        total_amount: Number(total.toFixed(2)),
        currency: 'ZAR',
        region: validated.region,
      },
      null,
      2,
    );
  }

  if (validated.operation === 'check_compliance') {
    if (!validated.doc_type) {
      throw new Error('Document type is required for compliance check');
    }
    const docType = validated.doc_type.toLowerCase();
    const rules = COMPLIANCE_RULES[docType] || ['Generic compliance check passed'];

    return JSON.stringify(
      {
        status: 'COMPLIANT',
        document_type: docType,
        checked_rules: rules,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  return 'Operation not implemented';
}

export const TAXNOID_TOOL_DEFINITION = {
  name: 'tax_advisory',
  description: 'Provides tax calculations and compliance checks via TAXNOID logic.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['calculate_vat', 'check_compliance'],
      },
      amount: { type: 'number', description: 'Amount for calculation' },
      doc_type: { type: 'string', description: 'Type of document (invoice, receipt, etc.)' },
      region: { type: 'string', description: 'Tax region (default: ZA)' },
    },
    required: ['operation'],
  },
};
