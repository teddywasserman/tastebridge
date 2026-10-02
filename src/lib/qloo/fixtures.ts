// Offline demo catalogue used by the mock Qloo client until a hackathon key is
// configured. Names are real public venues; coordinates are approximate and
// tags are hand-assigned, so mock results are illustrative, not Qloo output.

export const TAG_NAMES: Record<string, string> = {
  // categories (urn:tag:genre:place:*)
  cafe: "Café", restaurant: "Restaurant", wine_bar: "Wine Bar", bar: "Bar", jazz_club: "Jazz Club",
  nightclub: "Nightclub", museum: "Museum", gallery: "Art Gallery", cinema: "Movie Theater",
  bookshop: "Bookstore", market: "Market", park: "Park", beer_bar: "Beer Bar", music_venue: "Music Venue",
  bakery: "Bakery", spa: "Spa", dance_hall: "Dance Hall", beer_garden: "Beer Garden",
  // keywords (urn:tag:keyword:place:*)
  specialty_coffee: "specialty coffee", third_wave: "third wave", roastery: "in-house roastery",
  minimalist: "minimalist interior", pastries: "great pastries", brunch: "brunch", cozy: "cozy",
  photography: "photography", contemporary_art: "contemporary art", waterfront: "waterfront",
  late_night: "open late", live_music: "live music", local_institution: "local institution",
  garden: "garden setting", organic: "organic", natural_wine: "natural wine", small_plates: "small plates",
  rooftop: "rooftop terrace", views: "city views", indie: "indie", arthouse: "arthouse film",
  vintage: "vintage", street_food: "street food", traditional: "traditional cuisine", seafood: "seafood",
  craft_beer: "craft beer", design: "design-led", techno: "techno", electronic: "electronic",
  industrial: "industrial space", jazz: "jazz", comics: "comics & sci-fi", magazines: "independent magazines",
  seasonal: "seasonal menu", cocktails: "cocktails", historic: "historic", fado: "fado", folk: "folk",
  pop: "pop", dance: "dance", architecture: "architecture", cycling: "cycling", wellness: "wellness",
  italian: "Italian", thai: "Thai", scandi: "Scandinavian", patio: "patio", flea_market: "flea market",
  classical: "classical music", vegetarian: "vegetarian-friendly", hiphop: "hip-hop",
};

const CATEGORY_SLUGS = new Set([
  "cafe", "restaurant", "wine_bar", "bar", "jazz_club", "nightclub", "museum", "gallery", "cinema",
  "bookshop", "market", "park", "beer_bar", "music_venue", "bakery", "spa", "dance_hall", "beer_garden",
]);

export function tagUrn(slug: string): string {
  return CATEGORY_SLUGS.has(slug) ? `urn:tag:genre:place:${slug}` : `urn:tag:keyword:place:${slug}`;
}

export function slugFromUrn(urn: string): string {
  return urn.split(":").pop() ?? urn;
}

export interface FixtureEntity {
  id: string;
  name: string;
  type: "urn:entity:place" | "urn:entity:artist";
  city?: string;
  address?: string;
  lat?: number;
  lon?: number;
  tags: string[]; // slugs, first one is the category for places
  popularity: number;
}

type Row = [name: string, address: string, lat: number, lon: number, tags: string];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function hex(s: string): string {
  const a = hash(s).toString(16).padStart(8, "0");
  const b = hash(s + "#").toString(16).padStart(8, "0");
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-a${a.slice(0, 3)}-${b}${a.slice(0, 4)}`.toUpperCase();
}

function places(city: string, rows: Row[]): FixtureEntity[] {
  return rows.map(([name, address, lat, lon, tags]) => ({
    id: hex(`${city}:${name}`), name, type: "urn:entity:place", city, address, lat, lon,
    tags: tags.split(" "), popularity: 0.80 + (hash(name) % 190) / 1000,
  }));
}

export const SOURCE_PLACES: FixtureEntity[] = [
  ...places("Stockholm", [
    ["Drop Coffee", "Wollmar Yxkullsgatan 10, Södermalm", 59.3176, 18.0637, "cafe specialty_coffee third_wave roastery minimalist"],
    ["Café Pascal", "Norrtullsgatan 4, Vasastan", 59.3443, 18.0478, "cafe specialty_coffee brunch cozy pastries"],
    ["Fotografiska", "Stadsgårdshamnen 22, Södermalm", 59.3178, 18.0855, "museum photography contemporary_art waterfront late_night views"],
    ["Fasching", "Kungsgatan 63, Norrmalm", 59.3346, 18.0559, "jazz_club jazz live_music late_night local_institution"],
    ["Rosendals Trädgård", "Rosendalsterrassen 12, Djurgården", 59.3266, 18.1197, "cafe garden organic brunch cozy pastries"],
    ["Tyge & Sessil", "Brahegatan 4, Östermalm", 59.3401, 18.0757, "wine_bar natural_wine small_plates minimalist"],
    ["Mosebacke Etablissement", "Mosebacke torg 3, Södermalm", 59.3184, 18.0738, "music_venue live_music rooftop views local_institution indie"],
    ["Bio Rio", "Hornstulls strand 3, Södermalm", 59.3157, 18.0335, "cinema arthouse indie local_institution cozy"],
    ["Moderna Museet", "Exercisplan 4, Skeppsholmen", 59.3260, 18.0848, "museum contemporary_art design architecture waterfront"],
    ["Hornstulls Marknad", "Hornstulls strand 4, Södermalm", 59.3149, 18.0337, "market vintage street_food waterfront flea_market"],
    ["Pelikan", "Blekingegatan 40, Södermalm", 59.3104, 18.0773, "restaurant traditional local_institution historic beer_bar"],
    ["Snickarbacken 7", "Snickarbacken 7, Norrmalm", 59.3367, 18.0717, "cafe design gallery minimalist brunch"],
    ["Under Bron", "Hammarby Slussväg 2, Södermalm", 59.3196, 18.0817, "nightclub techno electronic late_night industrial"],
    ["Akkurat", "Hornsgatan 18, Södermalm", 59.3203, 18.0656, "beer_bar craft_beer seafood local_institution"],
    ["Science Fiction Bokhandeln", "Västerlånggatan 48, Gamla stan", 59.3240, 18.0711, "bookshop comics indie"],
  ]),
  ...places("Gothenburg", [
    ["Da Matteo", "Vallgatan 5", 57.7056, 11.9673, "cafe specialty_coffee roastery pastries third_wave"],
    ["Café Husaren", "Haga Nygata 28, Haga", 57.6985, 11.9572, "cafe pastries cozy local_institution historic"],
    ["Pustervik", "Järntorgsgatan 12", 57.6995, 11.9530, "music_venue live_music indie late_night bar"],
    ["Röda Sten Konsthall", "Röda Sten 1", 57.6900, 11.9017, "gallery contemporary_art industrial waterfront"],
    ["Bar Centro", "Kyrkogatan 31", 57.7055, 11.9662, "cafe italian local_institution specialty_coffee"],
    ["Feskekôrka", "Fisktorget 4", 57.7015, 11.9577, "market seafood local_institution historic"],
    ["Hagabadet", "Södra Allégatan 3, Haga", 57.6990, 11.9565, "spa wellness historic"],
    ["Hey Jazz Club", "Tredje Långgatan", 57.6982, 11.9441, "jazz_club jazz live_music late_night"],
  ]),
];

export const ARTISTS: FixtureEntity[] = [
  ["Robyn", "pop dance electronic scandi"],
  ["First Aid Kit", "folk indie live_music scandi"],
  ["Miles Davis", "jazz live_music classical"],
  ["Kraftwerk", "electronic techno industrial design"],
  ["Bon Iver", "indie folk cozy"],
  ["Kendrick Lamar", "hiphop live_music"],
  ["Ludovico Einaudi", "classical cozy"],
  ["Fred again..", "electronic dance techno late_night"],
].map(([name, tags]) => ({
  id: hex(`artist:${name}`), name, type: "urn:entity:artist" as const, tags: tags.split(" "),
  popularity: 0.9 + (hash(name) % 90) / 1000,
}));

export const TARGET_PLACES: FixtureEntity[] = [
  ...places("Lisbon", [
    ["Fábrica Coffee Roasters", "Rua das Portas de Santo Antão 136", 38.7175, -9.1418, "cafe specialty_coffee roastery third_wave minimalist"],
    ["Hello, Kristof", "Rua do Poço dos Negros 103", 38.7110, -9.1500, "cafe specialty_coffee magazines minimalist design"],
    ["Copenhagen Coffee Lab", "Rua Nova da Piedade 10", 38.7135, -9.1520, "cafe specialty_coffee scandi pastries brunch third_wave"],
    ["Dear Breakfast", "Rua das Gaivotas 17", 38.7085, -9.1495, "cafe brunch cozy pastries"],
    ["Comoba", "Rua de São Paulo 112", 38.7075, -9.1460, "cafe brunch organic vegetarian cozy"],
    ["Prado", "Travessa das Pedras Negras 2", 38.7105, -9.1345, "restaurant seasonal natural_wine minimalist organic"],
    ["Senhor Uva", "Rua de Santo Amaro 1", 38.7140, -9.1585, "wine_bar natural_wine small_plates vegetarian minimalist"],
    ["Taberna da Rua das Flores", "Rua das Flores 103", 38.7105, -9.1438, "restaurant traditional small_plates local_institution cozy"],
    ["Cervejaria Ramiro", "Avenida Almirante Reis 1", 38.7206, -9.1356, "restaurant seafood beer_bar local_institution late_night"],
    ["Hot Clube de Portugal", "Praça da Alegria 48", 38.7190, -9.1440, "jazz_club jazz live_music late_night local_institution"],
    ["Musicbox Lisboa", "Rua Nova do Carvalho 24", 38.7068, -9.1440, "music_venue live_music indie late_night electronic"],
    ["Lux Frágil", "Avenida Infante D. Henrique", 38.7145, -9.1225, "nightclub techno electronic waterfront late_night rooftop"],
    ["Galeria Zé dos Bois", "Rua da Barroca 59", 38.7120, -9.1453, "music_venue live_music contemporary_art indie rooftop"],
    ["MAAT", "Avenida Brasília, Belém", 38.6960, -9.1940, "museum contemporary_art design architecture waterfront"],
    ["Museu Calouste Gulbenkian", "Avenida de Berna 45A", 38.7372, -9.1545, "museum garden classical architecture"],
    ["Cinemateca Portuguesa", "Rua Barata Salgueiro 39", 38.7205, -9.1470, "cinema arthouse indie local_institution"],
    ["Cinema Ideal", "Rua do Loreto 15", 38.7108, -9.1455, "cinema arthouse indie cozy"],
    ["Ler Devagar", "LX Factory, Rua Rodrigues de Faria 103", 38.7034, -9.1786, "bookshop design industrial indie"],
    ["LX Factory", "Rua Rodrigues de Faria 103", 38.7036, -9.1782, "market vintage street_food design industrial"],
    ["Feira da Ladra", "Campo de Santa Clara", 38.7150, -9.1255, "market flea_market vintage local_institution"],
    ["Park Bar", "Calçada do Combro 58", 38.7110, -9.1475, "bar rooftop views cocktails"],
    ["Duque Brewpub", "Calçada do Duque 49", 38.7145, -9.1415, "beer_bar craft_beer cozy"],
    ["Time Out Market", "Avenida 24 de Julho 49", 38.7068, -9.1458, "market street_food seafood"],
    ["Jardim da Estrela", "Praça da Estrela", 38.7137, -9.1597, "park garden cozy"],
    ["Tasca do Chico", "Rua do Diário de Notícias 39", 38.7128, -9.1452, "bar fado live_music traditional late_night local_institution"],
    ["Arquivo Municipal Fotográfico", "Rua da Palma 246", 38.7195, -9.1365, "gallery photography historic"],
    ["Manteigaria", "Rua do Loreto 2", 38.7106, -9.1445, "bakery pastries local_institution traditional"],
    ["Kiosk & Miradouro de Santa Catarina", "Rua de Santa Catarina", 38.7096, -9.1475, "bar views waterfront"],
  ]),
  ...places("Berlin", [
    ["The Barn", "Auguststraße 58, Mitte", 52.5276, 13.3986, "cafe specialty_coffee roastery third_wave minimalist"],
    ["Bonanza Coffee Roasters", "Oderberger Straße 35", 52.5390, 13.4070, "cafe specialty_coffee roastery minimalist third_wave"],
    ["Five Elephant", "Reichenberger Straße 101", 52.4966, 13.4396, "cafe specialty_coffee pastries cozy"],
    ["Father Carpenter", "Münzstraße 21", 52.5250, 13.4080, "cafe brunch specialty_coffee design"],
    ["Café Einstein Stammhaus", "Kurfürstenstraße 58", 52.5020, 13.3550, "cafe pastries local_institution historic"],
    ["Markthalle Neun", "Eisenbahnstraße 42/43", 52.5020, 13.4310, "market street_food local_institution craft_beer"],
    ["Lode & Stijn", "Lausitzer Straße 25", 52.4980, 13.4290, "restaurant seasonal minimalist natural_wine small_plates"],
    ["Freundschaft", "Mittelstraße 1", 52.5170, 13.3870, "wine_bar natural_wine small_plates"],
    ["Mustafa's Gemüse Kebap", "Mehringdamm 32", 52.4936, 13.3880, "restaurant street_food late_night local_institution"],
    ["Prater Garten", "Kastanienallee 7-9", 52.5398, 13.4105, "beer_garden local_institution garden craft_beer historic"],
    ["A-Trane", "Pestalozzistraße 105", 52.5060, 13.3170, "jazz_club jazz live_music late_night"],
    ["b-flat", "Dircksenstraße 40", 52.5230, 13.4080, "jazz_club jazz live_music local_institution"],
    ["Berghain", "Am Wriezener Bahnhof", 52.5111, 13.4430, "nightclub techno electronic late_night industrial"],
    ["Kater Blau", "Holzmarktstraße 25", 52.5130, 13.4250, "nightclub techno electronic waterfront garden"],
    ["Clärchens Ballhaus", "Auguststraße 24", 52.5267, 13.3968, "dance_hall live_music local_institution garden historic"],
    ["Hamburger Bahnhof", "Invalidenstraße 50-51", 52.5285, 13.3720, "museum contemporary_art industrial"],
    ["C/O Berlin", "Hardenbergstraße 22-24", 52.5060, 13.3330, "gallery photography contemporary_art"],
    ["Neue Nationalgalerie", "Potsdamer Straße 50", 52.5070, 13.3670, "museum contemporary_art architecture design"],
    ["Babylon", "Rosa-Luxemburg-Straße 30", 52.5260, 13.4110, "cinema arthouse indie local_institution"],
    ["Kino International", "Karl-Marx-Allee 33", 52.5200, 13.4230, "cinema architecture local_institution"],
    ["Dussmann das KulturKaufhaus", "Friedrichstraße 90", 52.5180, 13.3890, "bookshop design classical"],
    ["Do You Read Me?!", "Auguststraße 28", 52.5260, 13.4010, "bookshop magazines design indie"],
    ["Klunkerkranich", "Karl-Marx-Straße 66", 52.4810, 13.4330, "bar rooftop views live_music garden"],
    ["Flohmarkt im Mauerpark", "Bernauer Straße 63-64", 52.5430, 13.4020, "market flea_market vintage street_food"],
    ["Tempelhofer Feld", "Tempelhofer Damm", 52.4730, 13.4040, "park cycling"],
    ["BRLO Brwhouse", "Schöneberger Straße 16", 52.4990, 13.3740, "beer_garden craft_beer industrial"],
    ["Comic Combo Berlin", "Wilmersdorfer Straße 61", 52.5070, 13.3060, "bookshop comics"],
    ["Stadtbad Neukölln", "Ganghoferstraße 3", 52.4807, 13.4357, "spa wellness historic architecture"],
  ]),
  ...places("Toronto", [
    ["Pilot Coffee Roasters", "Tankhouse Lane, Distillery District", 43.6503, -79.3596, "cafe specialty_coffee roastery industrial third_wave"],
    ["Sam James Coffee Bar", "297 Harbord Street", 43.6620, -79.4030, "cafe specialty_coffee third_wave minimalist"],
    ["Dineen Coffee Co.", "140 Yonge Street", 43.6505, -79.3790, "cafe historic pastries local_institution"],
    ["Forno Cultura", "609 King Street West", 43.6440, -79.4000, "bakery pastries italian cafe"],
    ["Bar Raval", "505 College Street", 43.6560, -79.4090, "wine_bar small_plates cocktails late_night"],
    ["Grey Gardens", "199 Augusta Avenue", 43.6545, -79.4010, "restaurant natural_wine seasonal small_plates"],
    ["Bar Isabel", "797 College Street", 43.6555, -79.4200, "restaurant small_plates late_night"],
    ["Pai Northern Thai Kitchen", "18 Duncan Street", 43.6475, -79.3880, "restaurant thai street_food"],
    ["The Rex Hotel Jazz & Blues Bar", "194 Queen Street West", 43.6505, -79.3880, "jazz_club jazz live_music local_institution late_night"],
    ["Horseshoe Tavern", "370 Queen Street West", 43.6490, -79.3960, "music_venue live_music indie bar local_institution"],
    ["The Drake Hotel", "1150 Queen Street West", 43.6430, -79.4250, "music_venue live_music design rooftop cocktails"],
    ["Art Gallery of Ontario", "317 Dundas Street West", 43.6536, -79.3925, "museum contemporary_art architecture design"],
    ["Museum of Contemporary Art Toronto", "158 Sterling Road", 43.6530, -79.4440, "museum contemporary_art industrial"],
    ["Stephen Bulger Gallery", "1356 Dundas Street West", 43.6490, -79.4260, "gallery photography"],
    ["TIFF Lightbox", "350 King Street West", 43.6465, -79.3900, "cinema arthouse indie"],
    ["Paradise Theatre", "1006 Bloor Street West", 43.6610, -79.4310, "cinema arthouse cocktails local_institution historic"],
    ["Type Books", "883 Queen Street West", 43.6460, -79.4120, "bookshop design indie"],
    ["Kensington Market", "Augusta Avenue & Baldwin Street", 43.6545, -79.4005, "market vintage street_food flea_market"],
    ["St. Lawrence Market", "93 Front Street East", 43.6487, -79.3715, "market seafood local_institution historic"],
    ["Trinity Bellwoods Park", "790 Queen Street West", 43.6475, -79.4140, "park garden"],
    ["Bellwoods Brewery", "124 Ossington Avenue", 43.6470, -79.4200, "beer_bar craft_beer patio"],
    ["Allan Gardens Conservatory", "160 Gerrard Street East", 43.6620, -79.3740, "park garden historic"],
    ["Toronto Island Park", "Centre Island", 43.6200, -79.3780, "park waterfront cycling"],
    ["Café Diplomatico", "594 College Street", 43.6550, -79.4140, "cafe patio italian local_institution"],
    ["Cold Tea", "60 Kensington Avenue", 43.6540, -79.4000, "bar cocktails late_night indie"],
    ["BarChef", "472 Queen Street West", 43.6480, -79.4010, "bar cocktails"],
    ["Comicshop: The Beguiling", "319 College Street", 43.6575, -79.4020, "bookshop comics indie"],
    ["CODA", "794 Bathurst Street", 43.6650, -79.4120, "nightclub techno electronic late_night"],
    ["Body Blitz Spa", "497 King Street East", 43.6540, -79.3570, "spa wellness"],
  ]),
];

export const ALL_FIXTURES: FixtureEntity[] = [...SOURCE_PLACES, ...ARTISTS, ...TARGET_PLACES];

export { hash as fixtureHash };
