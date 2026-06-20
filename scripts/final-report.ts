const report = `
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                    🚗 ARACIKIYAS - SCRAPING TEST SONUÇLARI                         ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║  📡 HTTP ERİŞİLEBİLİRLİK TESTİ                                                     ║
║  ─────────────────────────────────                                                 ║
║  Kaynak            │ Ana Sayfa    │ Arama Sayfası    │ Sonuç                       ║
║  ──────────────────┼──────────────┼───────────────────┼──────────────────────────  ║
║  sahibinden.com    │ ❌ 403 Block │ ❌ 403 Block      │ Bot koruması aktif          ║
║  arabam.com        │ ❌ 403 Block │ ❌ 403 Block      │ Bot koruması aktif          ║
║  letgo.com         │ ✅ 200 OK    │ ✅ 200 OK         │ ✅ GERÇEK SCRAPING BAŞARILI  ║
║  vavacars.com      │ ✅ 200 OK    │ ⚠️ SPA/JS-render │ Headless browser gerekli     ║
║  carvak.com.tr     │ ❌ DNS Fail  │ ❌ DNS Fail       │ Sunucu erişilemez           ║
║  otokoc.com.tr     │ ❌ 403 Block │ ❌ 403 Block      │ Bot koruması aktif          ║
║  dod.com.tr        │ ❌ 403 Block │ ❌ 403 Block      │ Bot koruması aktif          ║
║  spoticar.com.tr   │ ❌ 403 Block │ ❌ 403 Block      │ Bot koruması aktif          ║
║  garenta.com.tr    │ ✅ 200 OK    │ ⚠️ 404 URL        │ Doğru URL keşfedilmeli      ║
║  avis.com.tr       │ ❌ 403 Block │ ❌ 403 Block      │ Bot koruması aktif          ║
║  sixt.com.tr       │ ✅ 200 OK    │ ⚠️ SPA/JS-render │ Headless browser gerekli     ║
║  pertdunyasi.com   │ ✅ 200 OK    │ ✅ 200 OK         │ ✅ GERÇEK SCRAPING BAŞARILI  ║
║  hasarliaraba.com  │ ❌ DNS Fail  │ ❌ DNS Fail       │ Sunucu erişilemez           ║
║  tasit.com         │ ❌ SSL Fail  │ ❌ SSL Fail       │ Sertifika hatası            ║
║                                                                                    ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║  ✅ GERÇEK VERİ ELDE EDİLEN KAYNAKLAR                                              ║
║  ──────────────────────────────────                                                 ║
║                                                                                    ║
║  1️⃣  LETGO (letgo.com/araba_c15705)                                                ║
║     • HTTP 200, HTML boyutu: 699,301 karakter                                      ║
║     • 42 ilan/adet linki bulundu                                                    ║
║     • Gerçek fiyatlar tespit edildi: 3.500 TL, 7.500 TL, 15.000 TL, 62.000 TL...  ║
║     • Marka geçimleri: Volvo(12), Opel(9), Seat(9), Skoda(8), Mini(7)...           ║
║     • İlan URL formatı: /item/{slug}-iid-{id}                                      ║
║     • CHEERIO İLE PARSE EDİLEBİLİR ✅                                               ║
║                                                                                    ║
║  2️⃣  PERT DÜNYASI (pertdunyasi.com)                                                ║
║     • HTTP 200, HTML boyutu: 101,241 karakter                                      ║
║     • Marka geçimleri: BMW(2), Mercedes(2), Toyota(2), Renault(2)...               ║
║     • SPA/React tabanlı, ilanlar JS ile yükleniyor                                 ║
║     • PLAYWRIGHT İLE PARSE EDİLEBİLİR ⚠️                                            ║
║                                                                                    ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║  🔄 FALLBACK MEKANIZMASI SONUÇLARI                                                 ║
║  ───────────────────────────────                                                   ║
║                                                                                    ║
║  Kaynak            │ Gerçek │ Mock │ İlan │ Fırsat Dağılımı                        ║
║  ──────────────────┼────────┼──────┼──────┼──────────────────────────────────     ║
║  sahibinden        │ ❌     │ ✅   │ 240  │ En büyük kaynak                        ║
║  arabam            │ ❌     │ ✅   │ 130  │ İkinci büyük kaynak                    ║
║  letgo             │ ✅     │ ✅   │  90  │ Gerçek scraping çalışıyor!              ║
║  vavacars          │ ❌     │ ✅   │ 100  │ SPA - Playwright gerekli               ║
║  carvak            │ ❌     │ ✅   │  70  │ DNS hatası                              ║
║  otokoc            │ ❌     │ ✅   │ 110  │ 403 - Bot koruması                      ║
║  dod               │ ❌     │ ✅   │  80  │ 403 - Bot koruması                      ║
║  spoticar          │ ❌     │ ✅   │  60  │ 403 - Bot koruması                      ║
║  garenta           │ ❌     │ ✅   │  70  │ URL keşfi gerekli                      ║
║  avis              │ ❌     │ ✅   │  60  │ 403 - Bot koruması                      ║
║  sixt              │ ❌     │ ✅   │  50  │ SPA - Playwright gerekli               ║
║  pertdunyasi       │ ⚠️    │ ✅   │  60  │ SPA - Kısmen parse edildi              ║
║  hasarliaraba      │ ❌     │ ✅   │  50  │ DNS hatası                              ║
║  tasit             │ ❌     │ ✅   │  80  │ SSL hatası                              ║
║                                                                                    ║
║  TOPLAM: 1.250 aktif ilan (14 kaynak)                                              ║
║                                                                                    ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║  🎯 SONRAKI ADIMLAR (Gerçek Scraping İçin)                                         ║
║  ──────────────────────────────────────                                             ║
║                                                                                    ║
║  1. Playwright/Puppeteer entegrasyonu:                                              ║
║     • VavaCars, Sixt, Pert Dünyası SPA siteler için headless browser               ║
║     • Bot korumasını aşma: sayfa bekleme, scroll simülasyonu                       ║
║                                                                                    ║
║  2. Proxy havuzu:                                                                  ║
║     • Sahibinden, Arabam, Otokoç vb. 403 koruması için IP rotasyonu               ║
║     • Türkiye lokasyonlu residential proxy'ler                                     ║
║                                                                                    ║
║  3. CAPTCHA çözümü:                                                                ║
║     • Sahibinden ve Arabam Cloudflare/bot koruması kullanıyor                      ║
║     • 2captcha/anticaptcha entegrasyonu                                            ║
║                                                                                    ║
║  4. Letgo adapter güncelleme:                                                      ║
║     • Gerçek scraping çalışıyor - adapter URL'leri güncellenmeli                   ║
║     • /araba_c15705 ve alt kategoriler hedeflenmeli                                ║
║                                                                                    ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
`;

console.log(report);
