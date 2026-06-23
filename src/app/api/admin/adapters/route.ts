import { NextResponse } from 'next/server';
import { getAllAdapterInfo, getRegisteredSources } from '@/lib/adapters/registry';
import { getAllAdapterStatuses } from '@/lib/adapters';

// ── GET Handler ────────────────────────────────────────────────────────
//
// Auth: protected by middleware (ADMIN_TOKEN bearer).

export async function GET() {
  try {
    const [adapterInfo, registeredSources] = await Promise.all([
      getAllAdapterInfo(),
      Promise.resolve(getRegisteredSources()),
    ]);

    const statuses = getAllAdapterStatuses();
    const counts = {
      active: statuses.filter((s) => s.status === 'active').length,
      blocked: statuses.filter((s) => s.status === 'blocked').length,
      planned: statuses.filter((s) => s.status === 'planned').length,
      unreachable: statuses.filter((s) => s.status === 'unreachable').length,
      total: statuses.length,
    };

    return NextResponse.json({
      adapters: statuses,
      registeredSources,
      counts,
      adapterInfo,
    });
  } catch (error) {
    console.error('[API /admin/adapters] Error:', error);
    return NextResponse.json({ error: 'Failed to get adapter info' }, { status: 500 });
  }
}
