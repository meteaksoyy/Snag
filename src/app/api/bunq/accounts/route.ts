import { NextResponse } from 'next/server';
import { BunqClient } from '@/lib/bunq/client';

const API_KEY =
  process.env.BUNQ_API_KEY ||
  'sandbox_c705441ce75878f414420b091a2f8b34524e5549c8e17e1be136508e';

// GET /api/bunq/accounts
// Returns all active monetary accounts with balance and IBAN.
export async function GET() {
  try {
    const client = new BunqClient(API_KEY);
    await client.authenticate();

    const resp = await client.get(`user/${client.userId}/monetary-account-bank`);

    const accounts = resp
      .filter((item) => item.MonetaryAccountBank)
      .map((item) => {
        const acc = item.MonetaryAccountBank as Record<string, unknown>;
        const aliases = (acc.alias as Array<{ type: string; value: string }>) ?? [];
        const iban = aliases.find((a) => a.type === 'IBAN')?.value;
        return {
          id: acc.id,
          description: acc.description,
          balance: acc.balance,
          status: acc.status,
          iban,
        };
      });

    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
