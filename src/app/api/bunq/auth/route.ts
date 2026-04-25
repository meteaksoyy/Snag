import { NextResponse } from 'next/server';
import { BunqClient } from '@/lib/bunq/client';

const API_KEY =
  process.env.BUNQ_API_KEY ||
  'sandbox_c705441ce75878f414420b091a2f8b34524e5549c8e17e1be136508e';

// POST /api/bunq/auth
// Runs the 3-step bunq auth flow (installation → device-server → session-server)
// and caches the session in bunq_context.json. Safe to call repeatedly.
export async function POST() {
  try {
    const client = new BunqClient(API_KEY);
    await client.authenticate();
    return NextResponse.json({
      success: true,
      userId: client.userId,
      sessionActive: !!client.sessionToken,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
