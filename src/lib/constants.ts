import { SourcePlatform } from './types';

export const SOURCE_PLATFORMS: SourcePlatform[] = [
  // Aktif kaynaklar — gerçek scraping ile veri çekilen platformlar
  { name: 'letgo', displayName: 'Letgo', baseUrl: 'https://www.letgo.com', color: '#ff6f00', icon: '📱' },
  // Yakında eklenecek — Playwright entegrasyonu gerektiren SPA siteler
  { name: 'sahibinden', displayName: 'Sahibinden.com', baseUrl: 'https://www.sahibinden.com', color: '#1a73e8', icon: '🏠' },
  { name: 'arabam', displayName: 'Arabam.com', baseUrl: 'https://www.arabam.com', color: '#e53935', icon: '🚗' },
  { name: 'vavacars', displayName: 'VavaCars', baseUrl: 'https://www.vavacars.com', color: '#6c3fc5', icon: '⚡' },
  { name: 'otokoc', displayName: 'Otokoç', baseUrl: 'https://www.otokoc.com.tr', color: '#1565c0', icon: '🏢' },
  { name: 'garenta', displayName: 'Garenta', baseUrl: 'https://www.garenta.com.tr', color: '#00695c', icon: '🛡️' },
  { name: 'sixt', displayName: 'Sixt', baseUrl: 'https://www.sixt.com.tr', color: '#ff6d00', icon: '🟠' },
  { name: 'pertdunyasi', displayName: 'Pert Dünyası', baseUrl: 'https://www.pertdunyasi.com', color: '#455a64', icon: '🔧' },
];

export const TURKISH_MAKES = [
  'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Toyota', 'Honda', 'Hyundai',
  'Ford', 'Renault', 'Fiat', 'Peugeot', 'Opel', 'Citroen', 'Volvo', 'Mazda',
  'Nissan', 'Kia', 'Skoda', 'Seat', 'Suzuki', 'Mitsubishi', 'Chevrolet',
  'Alfa Romeo', 'Mini', 'Jeep', 'Land Rover', 'Lexus', 'Infiniti', 'Dacia',
  'Tofaş'
];

export const TURKISH_CITIES = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya',
  'Gaziantep', 'Mersin', 'Diyarbakır', 'Kayseri', 'Eskişehir', 'Samsun',
  'Denizli', 'Malatya', 'Trabzon', 'Erzurum', 'Muğla', 'Aydın', 'Balıkesir'
];

export const FUEL_TYPES = ['Benzin', 'Dizel', 'LPG', 'Hybrid', 'Elektrik', 'Benzin + LPG'];
export const TRANSMISSIONS = ['Otomatik', 'Manuel', 'Yarı Otomatik'];
export const BODY_TYPES = ['Sedan', 'Hatchback', 'SUV', 'Station', 'Coupe', 'Cabrio', 'MPV', 'Pickup'];
export const SELLER_TYPES = ['Galeri', 'Sahibinden', 'Yetkili Bayi'];

export const DEAL_TAG_CONFIG: Record<string, { color: string; bgColor: string; icon: string }> = {
  'Harika Fırsat': { color: '#ffffff', bgColor: '#16a34a', icon: '🔥' },
  'İyi Fiyat': { color: '#ffffff', bgColor: '#65a30d', icon: '👍' },
  'Piyasa Fiyatı': { color: '#1f2937', bgColor: '#e5e7eb', icon: '📊' },
  'Piyasa Üstü': { color: '#ffffff', bgColor: '#ea580c', icon: '📈' },
  'Pahalı': { color: '#ffffff', bgColor: '#dc2626', icon: '💰' },
  'Değerlendirilemedi': { color: '#6b7280', bgColor: '#f3f4f6', icon: '❓' },
};

export const MAKE_MODELS: Record<string, string[]> = {
  'BMW': ['3 Serisi', '5 Serisi', '1 Serisi', 'X5', 'X3', 'X1', '4 Serisi', '7 Serisi', 'X6', '2 Serisi'],
  'Mercedes-Benz': ['C Serisi', 'E Serisi', 'A Serisi', 'GLC', 'GLA', 'CLA', 'GLB', 'S Serisi', 'GLE', 'B Serisi'],
  'Audi': ['A3', 'A4', 'A5', 'A6', 'Q5', 'Q3', 'Q7', 'A1', 'Q2', 'A7'],
  'Volkswagen': ['Golf', 'Passat', 'Tiguan', 'Polo', 'Jetta', 'T-Roc', 'Touareg', 'Caddy', 'Transporter', 'Arteon'],
  'Toyota': ['Corolla', 'Camry', 'RAV4', 'Yaris', 'Land Cruiser', 'C-HR', 'Highlander', 'Prius', 'Hilux', 'Auris'],
  'Honda': ['Civic', 'CR-V', 'Accord', 'HR-V', 'Jazz', 'City', 'Odyssey', 'Pilot', 'WR-V', 'Legend'],
  'Hyundai': ['Tucson', 'i20', 'i30', 'Santa Fe', 'Kona', 'Elantra', 'Accent', 'Bayon', 'Staria', 'Creta'],
  'Ford': ['Focus', 'Kuga', 'Fiesta', 'Puma', 'Ranger', 'EcoSport', 'Explorer', 'Mustang', 'Tourneo', 'Transit'],
  'Renault': ['Megane', 'Clio', 'Captur', 'Kadjar', 'Symbol', 'Fluence', 'Duster', 'Talisman', 'Kangoo', 'Scenic'],
  'Fiat': ['Egea', '500', 'Panda', 'Doblo', '500X', 'Tipo', 'Ducato', 'Punto', 'Linea', 'Qubo'],
  'Peugeot': ['3008', '2008', '308', '508', '208', '5008', 'Rifter', 'Partner', '108', '408'],
  'Opel': ['Astra', 'Corsa', 'Mokka', 'Crossland', 'Grandland', 'Insignia', 'Zafira', 'Combo', 'Karl', 'Adam'],
  'Citroen': ['C3', 'C4', 'C5 Aircross', 'C5 X', 'C3 Aircross', 'Berlingo', 'Jumpy', 'C-Elysee', 'DS3', 'DS5'],
  'Volvo': ['XC60', 'XC90', 'S60', 'V60', 'V40', 'XC40', 'S90', 'V90', 'C30', 'V50'],
  'Mazda': ['CX-5', '3', 'CX-3', '6', 'MX-5', 'CX-30', 'CX-9', '2', 'CX-50', 'BT-50'],
  'Nissan': ['Qashqai', 'Juke', 'X-Trail', 'Micra', 'Navara', 'Leaf', 'Kicks', 'Patrol', 'Note', '370Z'],
  'Kia': ['Sportage', 'Ceed', 'Sorento', 'Picanto', 'Rio', 'Stonic', 'Seltos', 'Carnival', 'Niro', 'EV6'],
  'Skoda': ['Octavia', 'Superb', 'Kodiaq', 'Karoq', 'Fabia', 'Rapid', 'Scala', 'Kamiq', 'Yeti', 'Roomster'],
  'Seat': ['Leon', 'Ibiza', 'Ateca', 'Arona', 'Tarraco', 'Alhambra', 'Mii', 'Toledo', 'Altea', 'Cordoba'],
  'Suzuki': ['Vitara', 'Swift', 'Jimny', 'Baleno', 'S-Cross', 'Ignis', 'Alto', 'SX4', 'Celerio', 'Ertiga'],
  'Mitsubishi': ['Outlander', 'ASX', 'L200', 'Pajero', 'Eclipse Cross', 'Space Star', 'Colt', 'Lancer', 'Shogun', 'Mirage'],
  'Chevrolet': ['Cruze', 'Aveo', 'Spark', 'Trax', 'Equinox', 'Orlando', 'Captiva', 'Malibu', 'Camaro', 'Silverado'],
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Giulietta', 'Mito', '159', '156', 'Brera', '4C', 'Tonale', 'GT'],
  'Mini': ['Cooper', 'Countryman', 'Clubman', 'Paceman', 'Coupe', 'Roadster', 'Convertible', 'John Cooper Works', 'One', 'Electric'],
  'Jeep': ['Compass', 'Cherokee', 'Wrangler', 'Grand Cherokee', 'Renegade', 'Gladiator', 'Commander', 'Patriot', 'Liberty', 'Avenger'],
  'Land Rover': ['Range Rover', 'Discovery', 'Evoque', 'Sport', 'Defender', 'Velar', 'Freelander', 'Range Rover Classic', 'Discovery Sport', 'Series'],
  'Lexus': ['RX', 'ES', 'NX', 'IS', 'UX', 'LS', 'LC', 'GX', 'LX', 'HS'],
  'Infiniti': ['Q50', 'QX50', 'Q60', 'QX60', 'Q30', 'QX70', 'Q70', 'QX80', 'QX30', 'Q40'],
  'Dacia': ['Duster', 'Sandero', 'Logan', 'Lodgy', 'Dokker', 'Spring', 'Jogger', 'Solenza', 'Nova', 'Supernova'],
  'Tofaş': ['Şahin', 'Doğan', 'Kartal', 'Murat 131', 'Slxia'],
};

export const ISTANBUL_DISTRICTS = ['Kadıköy', 'Beşiktaş', 'Üsküdar', 'Bakırköy', 'Şişli', 'Ataşehir', 'Beyoğlu', 'Sarıyer', 'Maltepe', 'Kartal', 'Pendik', 'Beykoz', 'Zeytinburnu', 'Başakşehir', 'Bahçelievler', 'Bağcılar', 'Esenler', 'Sultangazi', 'Eyüpsultan', 'Silivri'];
export const ANKARA_DISTRICTS = ['Çankaya', 'Keçiören', 'Mamak', 'Etimesgut', 'Yenimahalle', 'Sincan', 'Altındağ', 'Pursaklar', 'Gölbaşı', 'Polatlı'];
export const IZMIR_DISTRICTS = ['Karşıyaka', 'Bornova', 'Konak', 'Buca', 'Çiğli', 'Gaziemir', 'Bayraklı', 'Narlıdere', 'Balçova', 'Karaburun'];

export const COLORS_TR = ['Beyaz', 'Siyah', 'Gri', 'Kırmızı', 'Mavi', 'Bordo', 'Gümüş', 'Lacivert', 'Yeşil', 'Turuncu', 'Bej', 'Kahverengi', 'Mor', 'Sarı', 'Bordo'];
