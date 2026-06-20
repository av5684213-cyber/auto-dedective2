import { NextResponse } from 'next/server';
import { getAllAdapterInfo, getRegisteredSources } from '@/lib/adapters/registry';

// ── GET Handler: Get adapter info ──────────────────────────────────────

export async function GET() {
  try {
    const [adapterInfo, registeredSources] = await Promise.all([
      getAllAdapterInfo(),
      Promise.resolve(getRegisteredSources()),
    ]);

    return NextResponse.json({
      adapters: adapterInfo,
      registeredSources,
    });
  } catch (error) {
    console.error('[API /admin/adapters] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get adapter info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
