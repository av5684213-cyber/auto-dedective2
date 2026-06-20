import { ALL_ADAPTERS } from '../src/lib/adapters/index';

async function quickTest() {
  console.log("\n🔍 ARACIKIYAS - Hızlı Adapter Test\n");
  console.log("Kaynak            │ Gerçek  │ İlan │ Hata");
  console.log("──────────────────┼─────────┼──────┼──────────────────────");

  for (const adapter of ALL_ADAPTERS) {
    try {
      // Use scrape() which has built-in timeout + fallback
      const result = await Promise.race([
        adapter.scrape({}),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 35000))
      ]);
      const isReal = result.durationMs < 25000 && result.success;
      const realStr = isReal ? "✅ OK " : "❌FAIL";
      const errStr = result.error ? result.error.substring(0, 25) : "";
      console.log(`${adapter.sourceName.padEnd(18)}│ ${realStr} │ ${result.listings.length.toString().padStart(4)} │ ${errStr}`);
    } catch (error: any) {
      console.log(`${adapter.sourceName.padEnd(18)}│ ❌ERR  │    0 │ ${error.message.substring(0, 25)}`);
    }
  }
  
  console.log("──────────────────┴─────────┴──────┴──────────────────────");
}

quickTest();
