import { NextResponse } from 'next/server';
import { Scheduler, getSchedulerStatus } from '@/lib/services/scheduler';

// ── GET Handler: Get scheduler status ──────────────────────────────────

export async function GET() {
  try {
    const status = getSchedulerStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('[API /admin/scheduler] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ── POST Handler: Start/stop scheduler or trigger manual pipeline ──────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action: string = body.action || 'trigger';

    switch (action) {
      case 'start': {
        const intervalMs: number | undefined = body.intervalMs;
        const scheduler = Scheduler.getInstance(undefined, intervalMs);
        scheduler.start();
        return NextResponse.json({ success: true, message: 'Scheduler started' });
      }

      case 'stop': {
        const scheduler = Scheduler.getInstance();
        scheduler.stop();
        return NextResponse.json({ success: true, message: 'Scheduler stopped' });
      }

      case 'trigger': {
        const scheduler = Scheduler.getInstance();
        const result = await scheduler.runPipeline();
        return NextResponse.json({ success: true, result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use 'start', 'stop', or 'trigger'.` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[API /admin/scheduler] POST Error:', error);
    return NextResponse.json(
      { error: 'Scheduler operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
