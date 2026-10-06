// Pre-baked demo journeys: recorded agent runs replayed instantly on the site
// (regenerate with `npx tsx scripts/bake-journeys.ts`).
export interface JourneyMeta {
  id: string;
  title: string;
  persona: string;
  fromCity: string;
  toCity: string;
  loves: string[];
}

export const JOURNEYS: JourneyMeta[] = [
  { id: "stockholm-lisbon", title: "Stockholm → Lisbon", persona: "Product designer starting a new job",
    fromCity: "Stockholm", toCity: "Lisbon",
    loves: ["Drop Coffee", "Fotografiska Museum", "Fasching", "Tyge & Sessil", "Bio Rio", "natural wine"] },
  { id: "stockholm-berlin", title: "Stockholm → Berlin", persona: "Erasmus student who lives for music",
    fromCity: "Stockholm", toCity: "Berlin",
    loves: ["Café Pascal", "Trädgården", "Moderna Museet", "Science Fiction Bookstore", "Akkurat", "vintage shopping"] },
  { id: "gothenburg-toronto", title: "Gothenburg → Toronto", persona: "Family on a corporate transfer",
    fromCity: "Gothenburg", toCity: "Toronto",
    loves: ["Da Matteo", "Café Husaren", "Pustervik", "Röda Sten Konsthall", "Feskekôrka", "Nefertiti"] },
];
