import { NextRequest, NextResponse } from 'next/server';
import { BunqClient } from '@/lib/bunq/client';

const API_KEY =
  process.env.BUNQ_API_KEY ||
  'sandbox_c705441ce75878f414420b091a2f8b34524e5549c8e17e1be136508e';

// POST /api/bunq/fund
// Body: { amount? }  — defaults to "500.00"
// Requests test money from sugardaddy@bunq.com (sandbox only, max EUR 500).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const amount: string = (body as { amount?: string }).amount ?? '500.00';

    const client = new BunqClient(API_KEY);
    await client.authenticate();
    const accountId = await client.getPrimaryAccountId();

    const resp = await client.post(
      `user/${client.userId}/monetary-account/${accountId}/request-inquiry`,
      {
        amount_inquired: { value: amount, currency: 'EUR' },
        counterparty_alias: {
          type: 'EMAIL',
          value: 'sugardaddy@bunq.com',
          name: 'Sugar Daddy',
        },
        description: 'Hackathon test funds',
        allow_bunqme: false,
      },
    );

    const requestId = (resp[0] as Record<string, Record<string, unknown>>)?.Id?.id;
    return NextResponse.json({ success: true, requestId, amount });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
