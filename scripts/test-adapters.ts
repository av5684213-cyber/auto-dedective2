import { ALL_ADAPTERS } from '../src/lib/adapters/index';

async function testAll() {
  const results: {name: string; real: boolean; error?: string; count: number; durMs: number}[] = [];
  
  for (const adapter of ALL_ADAPTERS) {
    const start = Date.now();
    try {
      const result = await adapter.search({});
      const durMs = Date.now() - start;
      const isReal = result.success && result.durationMs < 25000;
      results.push({ name: adapter.sourceName, real: isReal, error: result.error, count: result.listings.length, durMs });
    } catch (error: any) {
      const durMs = Date.now() - start;
      results.push({ name: adapter.sourceName, real: false, error: error.message, count: 0, durMs });
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║            ARACIKIYAS - SCRAPING ADAPTER TEST SONUÇLARI                ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║ Kaynak           │ Gerçek   │ Fallback │ Süre  │ İlan │ Hata          ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  
  for (const r of results) {
    const realStr = r.real ? "✅ OK  " : "❌ FAIL";
    const fbStr = r.real ? "  —   " : "✅ MOCK";
    const durStr = `${(r.durMs/1000).toFixed(1)}s`.padStart(5);
    const countStr = r.count.toString().padStart(4);
    const errStr = r.error ? r.error.substring(0, 20) : "—".padEnd(20);
    console.log(`║ ${r.name.padEnd(17)}│ ${realStr} │ ${fbStr} │ ${durStr} │ ${countStr} │ ${errStr}║`);
  }

  console.log("╚══════════════════════════════════════════════════════════════════════════╝");
  
  const totalReal = results.filter(r => r.real).length;
  const totalMock = results.filter(r => !r.real).length;
  const totalListings = results.reduce((s, r) => s + r.count, 0);
  console.log(`\nÖZET: ${results.length} kaynak → ${totalReal} gerçek, ${totalMock} fallback (mock) → Toplam ${totalListings} ilan\n`);
}

testAll().catch(console.error);
