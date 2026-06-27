import { NextRequest, NextResponse } from 'next/server';
import { runMonitorCycle } from '@/lib/news-monitor';

// Protégé par un secret header — appelé par n8n ou un cron Cloudflare
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-monitor-secret');
  if (secret !== process.env.MONITOR_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const newEvents = await runMonitorCycle(75);
    return NextResponse.json({ success: true, newEvents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Appelé par Vercel Cron ou Cloudflare Cron (GET)
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MONITOR_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const newEvents = await runMonitorCycle(75);
  return NextResponse.json({ success: true, newEvents });
}
