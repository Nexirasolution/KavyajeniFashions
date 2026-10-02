// Save in place of your existing sweep route (the file you pasted).
import { NextResponse } from 'next/server';
import { releaseExpiredOrders } from '@/lib/releaseExpiredOrders';

export const dynamic = 'force-dynamic';

// Safety net: catches orders where BOTH the client callback and the webhook
// failed to fire (e.g. tab closed AND webhook delivery failed), and releases
// the stock of unpaid orders once their 10-minute payment window has passed.
// Schedule this to run EVERY MINUTE so stock comes back close to the 10-minute mark.
async function handle(req) {
  // Fail closed if CRON_SECRET isn't configured (otherwise "Bearer undefined" would pass).
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await releaseExpiredOrders();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Order sweep failed:', err);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}

// POST for your existing scheduler; GET because Vercel Cron sends GET requests.
export const POST = handle;
export const GET = handle;