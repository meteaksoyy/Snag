import { NextRequest, NextResponse } from 'next/server';
import { BunqClient } from '@/lib/bunq/client';

const API_KEY =
  process.env.BUNQ_API_KEY ||
  'sandbox_c705441ce75878f414420b091a2f8b34524e5549c8e17e1be136508e';

// POST /api/bunq/pay
// Body: { recipientEmail, recipientName?, amount, currency?, description }
// Sends a payment from the primary account to the given email address.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      recipientEmail,
      recipientName,
      amount,
      currency = 'EUR',
      description,
    } = body as {
      recipientEmail: string;
      recipientName?: string;
      amount: string | number;
      currency?: string;
      description: string;
    };

    if (!recipientEmail || !amount || !description) {
      return NextResponse.json(
        { error: 'recipientEmail, amount, and description are required' },
        { status: 400 },
      );
    }

    const client = new BunqClient(API_KEY);
    await client.authenticate();
    const accountId = await client.getPrimaryAccountId();

    const resp = await client.post(
      `user/${client.userId}/monetary-account/${accountId}/payment`,
      {
        amount: { value: Number(amount).toFixed(2), currency },
        counterparty_alias: {
          type: 'EMAIL',
          value: recipientEmail,
          name: recipientName ?? recipientEmail,
        },
        description,
      },
    );

    const paymentId = (resp[0] as Record<string, Record<string, unknown>>)?.Id?.id;
    return NextResponse.json({ success: true, paymentId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
