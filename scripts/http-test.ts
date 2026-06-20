const ADAPTERS = [
  { name: 'sahibinden',  url: 'https://www.sahibinden.com' },
  { name: 'arabam',      url: 'https://www.arabam.com' },
  { name: 'letgo',       url: 'https://www.letgo.com' },
  { name: 'vavacars',    url: 'https://www.vavacars.com' },
  { name: 'carvak',      url: 'https://www.carvak.com.tr' },
  { name: 'otokoc',      url: 'https://www.otokoc.com.tr' },
  { name: 'dod',         url: 'https://www.dod.com.tr' },
  { name: 'spoticar',    url: 'https://www.spoticar.com.tr' },
  { name: 'garenta',     url: 'https://www.garenta.com.tr' },
  { name: 'avis',        url: 'https://www.avis.com.tr' },
  { name: 'sixt',        url: 'https://www.sixt.com.tr' },
  { name: 'pertdunyasi', url: 'https://www.pertdunyasi.com' },
  { name: 'hasarliaraba',url: 'https://www.hasarliaraba.com' },
  { name: 'tasit',       url: 'https://www.tasit.com' },
];

async function testHttp() {
  console.log("\n🌐 HTTP Erişilebilirlik Testi\n");
  console.log("Kaynak            │ URL                              │ Durum       │ Yanıt");
  console.log("──────────────────┼──────────────────────────────────┼─────────────┼─────────────");

  for (const a of ADAPTERS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(a.url, { signal: controller.signal, redirect: 'follow' });
      clearTimeout(timer);
      const statusStr = res.ok ? "✅ Erişilebilir" : "❌ Erişilemez ";
      const httpCode = `${res.status} ${res.statusText}`;
      console.log(`${a.name.padEnd(18)}│ ${a.url.padEnd(33)}│ ${statusStr} │ ${httpCode}`);
    } catch (err: any) {
      let reason = err.message.substring(0, 30);
      if (err.name === 'AbortError') reason = 'Timeout (8s)';
      console.log(`${a.name.padEnd(18)}│ ${a.url.padEnd(33)}│ ❌ Bağlantı Hatası │ ${reason}`);
    }
  }
  console.log("──────────────────┴──────────────────────────────────┴─────────────┴─────────────\n");
}

testHttp();
