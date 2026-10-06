// Cities TasteBridge knows how to lay out on a map. Neighbourhood centroids are
// used to aggregate Qloo heatmap cells into human-readable areas.

export interface Neighbourhood {
  name: string;
  lat: number;
  lon: number;
  vibe: string;
}

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
  zoom: number;
  /** true when the offline demo fixtures include places for this city */
  demo: boolean;
  neighbourhoods: Neighbourhood[];
}

const n = (name: string, lat: number, lon: number, vibe: string): Neighbourhood => ({ name, lat, lon, vibe });

export const TARGET_CITIES: City[] = [
  {
    name: "Lisbon", country: "Portugal", lat: 38.7139, lon: -9.1450, zoom: 12.6, demo: true,
    neighbourhoods: [
      n("Príncipe Real", 38.7170, -9.1490, "leafy squares, design shops, wine bars"),
      n("Chiado", 38.7107, -9.1420, "bookshops, theatres, old cafés"),
      n("Bairro Alto", 38.7130, -9.1460, "narrow streets, bars, late nights"),
      n("Baixa", 38.7115, -9.1375, "grid streets, landmarks, central"),
      n("Alfama", 38.7120, -9.1300, "fado, viewpoints, village feel"),
      n("Cais do Sodré", 38.7068, -9.1445, "riverside, nightlife, markets"),
      n("Santos & Madragoa", 38.7085, -9.1530, "design district, quiet lanes"),
      n("Estrela", 38.7137, -9.1597, "gardens, family-friendly, calm"),
      n("Alcântara", 38.7035, -9.1785, "industrial, LX Factory, creative"),
      n("Graça", 38.7170, -9.1300, "hilltop, local, miradouros"),
      n("Intendente & Anjos", 38.7210, -9.1355, "multicultural, up-and-coming"),
      n("Avenidas Novas", 38.7370, -9.1500, "museums, modern blocks, parks"),
      n("Belém", 38.6965, -9.2000, "river, museums, monuments"),
    ],
  },
  {
    name: "Berlin", country: "Germany", lat: 52.5130, lon: 13.4050, zoom: 11.6, demo: true,
    neighbourhoods: [
      n("Mitte", 52.5250, 13.4000, "galleries, cafés, central"),
      n("Prenzlauer Berg", 52.5390, 13.4180, "cafés, families, leafy streets"),
      n("Kreuzberg", 52.4990, 13.4030, "nightlife, food, canal"),
      n("Neukölln", 52.4810, 13.4350, "young, bars, international"),
      n("Friedrichshain", 52.5120, 13.4500, "clubs, students, street art"),
      n("Schöneberg", 52.4840, 13.3530, "relaxed, cafés, markets"),
      n("Charlottenburg", 52.5050, 13.3100, "classic, jazz, elegant"),
      n("Tiergarten & Moabit", 52.5200, 13.3550, "parks, museums, quiet"),
      n("Wedding", 52.5500, 13.3650, "affordable, diverse, emerging"),
    ],
  },
  {
    name: "Toronto", country: "Canada", lat: 43.6510, lon: -79.3950, zoom: 12.3, demo: true,
    neighbourhoods: [
      n("Kensington Market", 43.6545, -79.4005, "vintage, street food, bohemian"),
      n("Queen West", 43.6470, -79.4060, "galleries, shops, nightlife"),
      n("Trinity Bellwoods & Ossington", 43.6480, -79.4200, "park life, bars, cafés"),
      n("Little Italy", 43.6550, -79.4140, "patios, late dinners"),
      n("The Annex", 43.6680, -79.4050, "students, bookshops, cafés"),
      n("Downtown Core", 43.6480, -79.3850, "theatres, jazz, central"),
      n("Distillery & Corktown", 43.6510, -79.3600, "historic, roasters, galleries"),
      n("Leslieville", 43.6640, -79.3320, "brunch, families, calm"),
      n("Junction Triangle", 43.6560, -79.4450, "arts, industrial, emerging"),
      n("St. Lawrence", 43.6490, -79.3720, "markets, old town"),
    ],
  },
  {
    name: "Amsterdam", country: "Netherlands", lat: 52.3700, lon: 4.8950, zoom: 12.4, demo: false,
    neighbourhoods: [
      n("Jordaan", 52.3760, 4.8820, "canals, cafés, galleries"),
      n("De Pijp", 52.3540, 4.8930, "markets, food, young"),
      n("Oud-West", 52.3660, 4.8700, "foodhallen, locals"),
      n("Oost", 52.3600, 4.9250, "parks, multicultural"),
      n("Noord", 52.3900, 4.9150, "creative, industrial"),
      n("Centrum", 52.3730, 4.8930, "historic, busy"),
    ],
  },
  {
    name: "Barcelona", country: "Spain", lat: 41.3890, lon: 2.1650, zoom: 12.4, demo: false,
    neighbourhoods: [
      n("Gràcia", 41.4030, 2.1560, "plazas, indie, local"),
      n("El Born", 41.3850, 2.1820, "boutiques, bars"),
      n("Eixample", 41.3920, 2.1620, "modernisme, dining"),
      n("Poblenou", 41.4000, 2.2000, "creative, beach"),
      n("Raval", 41.3800, 2.1680, "art, multicultural"),
      n("Sant Antoni", 41.3780, 2.1610, "market, vermouth"),
    ],
  },
  {
    name: "London", country: "United Kingdom", lat: 51.5100, lon: -0.1100, zoom: 11.4, demo: false,
    neighbourhoods: [
      n("Shoreditch", 51.5260, -0.0780, "creative, nightlife"),
      n("Hackney", 51.5450, -0.0550, "markets, young"),
      n("Peckham", 51.4730, -0.0690, "rooftops, arts"),
      n("Soho", 51.5135, -0.1340, "theatre, dining"),
      n("Brixton", 51.4620, -0.1150, "music, food"),
      n("Islington", 51.5380, -0.1030, "pubs, theatres"),
      n("Notting Hill", 51.5110, -0.2050, "markets, pastel streets"),
    ],
  },
  {
    name: "New York", country: "United States", lat: 40.7200, lon: -73.9800, zoom: 11.6, demo: false,
    neighbourhoods: [
      n("West Village", 40.7340, -74.0030, "jazz, cafés"),
      n("East Village", 40.7265, -73.9815, "bars, music"),
      n("Williamsburg", 40.7140, -73.9610, "indie, coffee"),
      n("Lower East Side", 40.7150, -73.9840, "nightlife, galleries"),
      n("Harlem", 40.8110, -73.9460, "jazz, soul food"),
      n("Greenpoint", 40.7300, -73.9540, "quiet, cafés"),
      n("Chelsea", 40.7465, -74.0010, "galleries, High Line"),
    ],
  },
  {
    name: "Copenhagen", country: "Denmark", lat: 55.6780, lon: 12.5700, zoom: 12.4, demo: false,
    neighbourhoods: [
      n("Nørrebro", 55.6940, 12.5480, "diverse, cafés"),
      n("Vesterbro", 55.6680, 12.5450, "meatpacking, bars"),
      n("Christianshavn", 55.6730, 12.5940, "canals, food"),
      n("Østerbro", 55.7060, 12.5780, "family, parks"),
      n("Indre By", 55.6800, 12.5800, "historic, shopping"),
    ],
  },
];

export const SOURCE_CITIES = ["Stockholm", "Gothenburg", "Malmö", "Oslo", "Helsinki", "Copenhagen", "Other"];

/** Centres of the home cities, used to bias Qloo /search toward the right "Drop Coffee". */
const HOME_CENTRES: Record<string, { lat: number; lon: number }> = {
  stockholm: { lat: 59.3293, lon: 18.0686 },
  gothenburg: { lat: 57.7089, lon: 11.9746 },
  "göteborg": { lat: 57.7089, lon: 11.9746 },
  "malmö": { lat: 55.605, lon: 13.0038 },
  malmo: { lat: 55.605, lon: 13.0038 },
  oslo: { lat: 59.9139, lon: 10.7522 },
  helsinki: { lat: 60.1699, lon: 24.9384 },
};

export function cityCentre(name?: string): { lat: number; lon: number } | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  const t = TARGET_CITIES.find((c) => c.name.toLowerCase() === key);
  return t ? { lat: t.lat, lon: t.lon } : HOME_CENTRES[key];
}

export function getCity(name: string): City | undefined {
  return TARGET_CITIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestNeighbourhood(city: City, lat: number, lon: number): { hood: Neighbourhood; km: number } {
  let best = city.neighbourhoods[0];
  let bestKm = Infinity;
  for (const h of city.neighbourhoods) {
    const km = haversineKm(lat, lon, h.lat, h.lon);
    if (km < bestKm) { best = h; bestKm = km; }
  }
  return { hood: best, km: bestKm };
}
