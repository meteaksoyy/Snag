import { NextRequest, NextResponse } from 'next/server';
import { BunqClient } from '@/lib/bunq/client';

const API_KEY =
  process.env.BUNQ_API_KEY ||
  'sandbox_c705441ce75878f414420b091a2f8b34524e5549c8e17e1be136508e';

// GET /api/bunq/transactions?count=20&accountId=<optional>
// Returns recent payments for the primary (or specified) account.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const count = searchParams.get('count') ?? '20';
    const accountIdParam = searchParams.get('accountId');

    const client = new BunqClient(API_KEY);
    await client.authenticate();
    const accountId = accountIdParam
      ? Number(accountIdParam)
      : await client.getPrimaryAccountId();

    const resp = await client.get(
      `user/${client.userId}/monetary-account/${accountId}/payment`,
      { count },
    );

    const transactions = resp
      .filter((item) => item.Payment)
      .map((item) => {
        const p = item.Payment as Record<string, unknown>;
        const alias = p.counterparty_alias as Record<string, string> | undefined;
        return {
          id: p.id,
          created: p.created,
          amount: p.amount,
          counterparty: {
            name: alias?.display_name,
            value: alias?.value,
            type: alias?.type,
          },
          description: p.description,
          type: p.type,
        };
      });

    return NextResponse.json({ transactions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
