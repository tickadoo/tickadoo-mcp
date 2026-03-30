export const TRAVEL_TIP_TOPICS = [
  "transport",
  "money",
  "safety",
  "culture",
  "food",
  "weather",
  "language",
  "connectivity",
] as const;

export type TravelTipTopic = (typeof TRAVEL_TIP_TOPICS)[number];
export type TravelTipImportance = "essential" | "helpful" | "nice_to_know";

export type TravelTipsPayload = {
  city: string;
  tips: Array<{
    topic: TravelTipTopic;
    tip: string;
    importance: TravelTipImportance;
  }>;
  emergency: {
    police: string;
    ambulance: string;
    tourist_helpline: string;
  };
  quick_phrases: Array<{
    local: string;
    english: string;
  }>;
};

type TravelTipsCitySeed = {
  name: string;
  slug: string;
  aliases?: string[];
  emergency: TravelTipsPayload["emergency"];
  quick_phrases: TravelTipsPayload["quick_phrases"];
  topics: Record<TravelTipTopic, string>;
};

const TOPIC_IMPORTANCE: Record<TravelTipTopic, TravelTipImportance> = {
  transport: "essential",
  money: "essential",
  safety: "essential",
  culture: "helpful",
  food: "helpful",
  weather: "nice_to_know",
  language: "helpful",
  connectivity: "nice_to_know",
};

const TOPIC_LABELS: Record<TravelTipTopic, string> = {
  transport: "Transport",
  money: "Money",
  safety: "Safety",
  culture: "Culture",
  food: "Food",
  weather: "Weather",
  language: "Language",
  connectivity: "Connectivity",
};

const TRAVEL_TIPS_CITIES: TravelTipsCitySeed[] = [
  {
    name: "London",
    slug: "london",
    emergency: { police: "999", ambulance: "999", tourist_helpline: "101" },
    quick_phrases: [
      { local: "Cheers", english: "Thanks" },
      { local: "Where is the Tube?", english: "Where is the subway?" },
      { local: "Mind the gap", english: "Watch the train-platform gap" },
    ],
    topics: {
      transport: "Use the same contactless card or phone all day so TfL can cap your fares automatically, and stand on the right on escalators.",
      money: "Cards are accepted almost everywhere; for restaurants, tip around 10% only if service is not already included.",
      safety: "Late-night central London is busy but phone snatches happen, so keep your device off the curb side and use licensed cabs or booked minicabs only.",
      culture: "Queue properly, keep train conversations low-key, and do not stop dead at the top of escalators.",
      food: "Book Sunday roasts and top pubs ahead, and remember many pub kitchens stop serving earlier than the bar closes.",
      weather: "Carry a light waterproof layer year-round because London weather can flip from bright to rainy in under an hour.",
      language: "Locals say 'cheers' for thanks and 'sorted' for all set, so those phrases help you blend in quickly.",
      connectivity: "eSIM setup is easy, but deep Tube lines still lose signal, so save maps and tickets before you head underground.",
    },
  },
  {
    name: "Paris",
    slug: "paris",
    emergency: { police: "17", ambulance: "15", tourist_helpline: "112" },
    quick_phrases: [
      { local: "Bonjour", english: "Hello" },
      { local: "S'il vous plait", english: "Please" },
      { local: "L'addition, s'il vous plait", english: "The bill, please" },
    ],
    topics: {
      transport: "A Navigo Easy pass keeps metro and bus travel simple; validate every ride and avoid peak-hour platform crushes if you have luggage.",
      money: "Service is already included in restaurant bills, so locals usually leave only small change rather than a big extra tip.",
      safety: "Watch for bracelet petitions, clipboard distractions, and phone snatches around major sights and metro exits.",
      culture: "Start every interaction with 'bonjour' before asking a question because skipping the greeting feels abrupt in Paris.",
      food: "Fixed-price lunch menus often beat dinner value, and the best neighborhood bistros usually fill after 8 p.m.",
      weather: "August can be quiet because many independents close for holidays, while shoulder seasons are the sweet spot for walking.",
      language: "A polite opener in French matters more than perfect grammar, and locals usually switch to English once you make the effort.",
      connectivity: "eSIM coverage is strong, but public Wi-Fi can be inconsistent, so offline metro maps are worth downloading.",
    },
  },
  {
    name: "New York",
    slug: "new-york",
    aliases: ["new york city", "nyc"],
    emergency: { police: "911", ambulance: "911", tourist_helpline: "311" },
    quick_phrases: [
      { local: "Downtown", english: "Toward lower Manhattan / southbound" },
      { local: "To go", english: "Takeaway" },
      { local: "Subway", english: "Metro / underground" },
    ],
    topics: {
      transport: "Tap the same card or phone on OMNY for the subway and buses, and double-check whether your train is local or express before boarding.",
      money: "Add sales tax and a restaurant tip of roughly 18% to 20% in your head because menu prices do not include either.",
      safety: "Avoid empty subway cars late at night and keep your phone zipped away in busy stations and on crowded sidewalks.",
      culture: "Move with purpose, keep to the right on sidewalks, and do not stop in the middle of foot traffic to check directions.",
      food: "Top brunches, bagel counters, and new-wave pizza spots build lines early, so an earlier meal usually pays off.",
      weather: "Summer means aggressive air-conditioning and winter wind tunnels, so indoor and outdoor temperature swings can be extreme on the same day.",
      language: "Directional terms like uptown, downtown, and crosstown are more useful than neighborhood names when asking for subway help.",
      connectivity: "Coverage is excellent above ground, but tunnels still drop signal, so save your return route before entering the subway.",
    },
  },
  {
    name: "Tokyo",
    slug: "tokyo",
    emergency: { police: "110", ambulance: "119", tourist_helpline: "+81 50 3816 2787" },
    quick_phrases: [
      { local: "Sumimasen", english: "Excuse me / sorry" },
      { local: "Arigato gozaimasu", english: "Thank you very much" },
      { local: "Eki wa doko desu ka?", english: "Where is the station?" },
    ],
    topics: {
      transport: "Load up a Suica or Pasmo card right away, and remember that missing the last train can turn a cheap trip home into an expensive taxi ride.",
      money: "Cards are improving fast, but smaller ramen shops, temples, and old-school bars still reward having cash on hand; tipping is not expected.",
      safety: "Tokyo is very safe overall, but avoid being lured into upstairs bars in nightlife districts where surprise cover charges are common.",
      culture: "Queue precisely, keep voices low on trains, and hold onto your trash until you find a proper bin because public bins are scarce.",
      food: "Department-store food halls are an easy high-quality backup, while the best sushi, tempura, and yakiniku spots often need reservations.",
      weather: "June is rainy season and midsummer is humid enough to slow down sightseeing, so start outdoor plans early.",
      language: "Showing a destination written in Japanese often works better than reading out a romanized address.",
      connectivity: "An eSIM or pocket Wi-Fi is almost essential for mapping complex stations and translating menus on the fly.",
    },
  },
  {
    name: "Rome",
    slug: "rome",
    emergency: { police: "112", ambulance: "118", tourist_helpline: "060608" },
    quick_phrases: [
      { local: "Buongiorno", english: "Good morning / hello" },
      { local: "Il conto, per favore", english: "The bill, please" },
      { local: "Dov'e la metro?", english: "Where is the metro?" },
    ],
    topics: {
      transport: "Tap on for buses and metro, wear shoes that handle cobblestones well, and expect walking routes to take longer than the map suggests.",
      money: "Coffee is usually cheaper standing at the bar than sitting at a table, and modest round-up tips are more normal than big percentages.",
      safety: "Guard your phone and wallet around Termini, Metro Line A, and the busiest monument approaches where pickpockets work the crowds.",
      culture: "Cover shoulders and knees in churches, and do not expect locals to eat dinner especially early by northern European standards.",
      food: "Tourist-heavy menus near major monuments often disappoint, so one street away usually means better carbonara, cacio e pepe, and prices.",
      weather: "Summer heat around ruins is draining, so do outdoor archaeology early and save churches or long lunches for midday.",
      language: "Asking for 'il conto' instead of waiting for the bill helps because staff usually do not rush diners out.",
      connectivity: "Coverage is good, but stone buildings and underground archaeology sites can weaken signal quickly.",
    },
  },
  {
    name: "Barcelona",
    slug: "barcelona",
    emergency: { police: "112", ambulance: "112", tourist_helpline: "010" },
    quick_phrases: [
      { local: "Bon dia", english: "Good day" },
      { local: "La cuenta, por favor", english: "The bill, please" },
      { local: "Gracias", english: "Thank you" },
    ],
    topics: {
      transport: "A T-casual ticket is usually the easiest value pass, and using the metro beats taxis whenever traffic thickens near the center.",
      money: "Round-up tips are normal, but always check whether a terrace fee, bread charge, or cover has already been added.",
      safety: "Pickpocketing is the citys biggest travel nuisance, especially on Las Ramblas, the beach, and crowded metro interchanges.",
      culture: "Meals run later than many visitors expect, and a quick 'bon dia' or 'hola' goes down well before switching to English.",
      food: "Menu del dia lunches are often the best deal in town, while the strongest tapas bars usually sit just off the headline sightseeing streets.",
      weather: "Sun exposure adds up fast near the waterfront, so carry water and sunscreen even outside peak summer.",
      language: "You will hear both Catalan and Spanish, and using either politely is appreciated.",
      connectivity: "Offline maps help in the Gothic Quarter where narrow lanes can make live navigation feel jumpy.",
    },
  },
  {
    name: "Amsterdam",
    slug: "amsterdam",
    emergency: { police: "112", ambulance: "112", tourist_helpline: "14020" },
    quick_phrases: [
      { local: "Dank je wel", english: "Thank you" },
      { local: "Alstublieft", english: "Please / here you go" },
      { local: "Waar is het station?", english: "Where is the station?" },
    ],
    topics: {
      transport: "OVpay or an OV-chipkaart makes trams easy, but the first rule of Amsterdam is to stay out of bike lanes unless you are actually cycling.",
      money: "Cards work almost everywhere, though some smaller spots still prefer debit over premium foreign credit cards.",
      safety: "Watch for bikes, wet canal edges, and opportunistic street sellers because those bother visitors more often than violent crime does.",
      culture: "Dutch directness is normal rather than rude, and quiet residential canal streets are treated respectfully after dark.",
      food: "Reserve standout Indonesian, modern Dutch, and canal-side dinner spots ahead, especially on weekends.",
      weather: "Wind can turn a mild day cold very quickly, so layers beat a heavy single coat for most of the year.",
      language: "English is common, but a quick 'dank je wel' is still appreciated.",
      connectivity: "Signal is good, though canal turns and bridges can make walking routes less direct than they look on the map.",
    },
  },
  {
    name: "Lisbon",
    slug: "lisbon",
    emergency: { police: "112", ambulance: "112", tourist_helpline: "112" },
    quick_phrases: [
      { local: "Bom dia", english: "Good morning" },
      { local: "Obrigado / Obrigada", english: "Thank you" },
      { local: "Onde fica o metro?", english: "Where is the metro?" },
    ],
    topics: {
      transport: "A Viva Viagem card keeps metro, tram, and ferry rides simple, and the famous old trams are best very early if you want breathing room.",
      money: "Cards are widely accepted, but small bakeries and kiosks still reward carrying a little cash; tips are usually modest.",
      safety: "Tram 28 and the busiest Baixa viewpoints are classic pickpocket zones, so keep bags zipped and in front of you.",
      culture: "The city is hillier than it looks, dinner often starts late, and patience matters when old lifts or trams run on their own rhythm.",
      food: "Warm pasteis de nata are best earlier in the day, and the strongest casual seafood and petisco spots sit outside the busiest postcard lanes.",
      weather: "The sun and hills together tire people out fast, so plan shaded breaks into any day that includes Alfama or Bairro Alto.",
      language: "A quick Portuguese greeting helps a lot, and visitors usually find 'obrigado' is the first word that gets a smile.",
      connectivity: "Coverage is good, but steep lanes and stone buildings can make live navigation lag, so save your route when climbing.",
    },
  },
  {
    name: "Berlin",
    slug: "berlin",
    emergency: { police: "110", ambulance: "112", tourist_helpline: "115" },
    quick_phrases: [
      { local: "Guten Tag", english: "Good day / hello" },
      { local: "Danke", english: "Thank you" },
      { local: "Die Rechnung, bitte", english: "The bill, please" },
    ],
    topics: {
      transport: "Buy the correct AB or ABC ticket and validate it when required because inspectors often work without uniforms and fines are immediate.",
      money: "Card use has improved, but cash still saves awkward moments at Spatis, kebab counters, and older bars.",
      safety: "Berlin is straightforward overall, but keep your phone close in club queues, packed stations, and late-night transit hubs.",
      culture: "Many shops close on Sundays, bottle deposits matter, and quiet residential stairwells are treated seriously.",
      food: "Do not sleep on Turkish, Vietnamese, and bakery culture; the best weekend brunches and natural-wine spots need bookings.",
      weather: "Shoulder-season evenings cool off fast even after warm afternoons, so always keep one extra layer in your bag.",
      language: "Basic words like 'danke' and 'bitte' go a long way even though tourist-facing staff usually speak strong English.",
      connectivity: "Expect some dead zones in clubs, basements, and older U-Bahn tunnels, so set meet-up spots ahead of time.",
    },
  },
  {
    name: "Prague",
    slug: "prague",
    emergency: { police: "158", ambulance: "155", tourist_helpline: "112" },
    quick_phrases: [
      { local: "Dobry den", english: "Good day / hello" },
      { local: "Dekuji", english: "Thank you" },
      { local: "Prosim", english: "Please / you are welcome" },
    ],
    topics: {
      transport: "A short Prague transport pass is usually simpler than single rides, and paper tickets must be validated once before first use.",
      money: "Pay in Czech koruna when terminals ask, and skip street exchange booths with flashy rate signs near the tourist core.",
      safety: "Taxi issues are rarer than before, but using an app still avoids awkward pricing around stations and nightlife areas.",
      culture: "Old Town is the postcard version of Prague, while neighborhoods like Karlin and Vinohrady feel more local and relaxed.",
      food: "Lunch specials outside the center often deliver better Czech food and better value than dinner on the main squares.",
      weather: "Winter cobbles get slick and river winds cut through quickly, so good shoes matter more than visitors expect.",
      language: "Learning 'dobry den' gets you off to a strong start even if the rest of the conversation happens in English.",
      connectivity: "Coverage is reliable, but vaulted cellars and thicker historic interiors can drop signal without warning.",
    },
  },
  {
    name: "Vienna",
    slug: "vienna",
    emergency: { police: "133", ambulance: "144", tourist_helpline: "112" },
    quick_phrases: [
      { local: "Gruss Gott", english: "Hello" },
      { local: "Danke", english: "Thank you" },
      { local: "Die Rechnung, bitte", english: "The bill, please" },
    ],
    topics: {
      transport: "A 24-hour or 48-hour transit pass is easy value, and proof-of-payment checks on the U-Bahn are common.",
      money: "Cards are common in the center, but carrying a little cash still helps at market stalls and older cafes.",
      safety: "Vienna is calm by big-city standards, though station areas and crowded holiday markets still reward basic awareness.",
      culture: "Coffeehouse service is deliberately unhurried, so settle in rather than expecting fast table turns.",
      food: "Book top schnitzel rooms and wine taverns in advance, and remember that many strong heuriger experiences sit slightly outside the center.",
      weather: "Winter damp cold feels sharper than the raw temperature suggests, especially when you are standing outdoors between palace stops.",
      language: "A warm greeting and a simple 'danke' do a lot even though tourist-facing staff usually speak strong English.",
      connectivity: "Public Wi-Fi is widespread, but palace walls and museum basements can weaken signal more than expected.",
    },
  },
  {
    name: "Budapest",
    slug: "budapest",
    emergency: { police: "107", ambulance: "104", tourist_helpline: "112" },
    quick_phrases: [
      { local: "Szia", english: "Hi / hello" },
      { local: "Koszonom", english: "Thank you" },
      { local: "Beszel angolul?", english: "Do you speak English?" },
    ],
    topics: {
      transport: "BudapestGO is the easiest way to manage metro, tram, and bus tickets, and onboard validation still matters.",
      money: "Choose Hungarian forint at the terminal rather than dynamic euro conversion if you want the better exchange rate.",
      safety: "Party-quarter overcharging and bar-tab traps still catch visitors, so check menus and receipts before ordering rounds.",
      culture: "Thermal baths have their own rhythm, and bringing flip-flops plus respecting the quieter pool areas makes the experience smoother.",
      food: "Look beyond the riverfront for stronger goulash, bakeries, and wine bars, and use lunch menus where possible.",
      weather: "River winds in winter and tram heat in summer both feel stronger than the forecast suggests.",
      language: "Even one Hungarian phrase shows goodwill because the language feels intimidating to most visitors.",
      connectivity: "Coverage is solid, but some older metro stations and basement bars still drop signal.",
    },
  },
  {
    name: "Dublin",
    slug: "dublin",
    emergency: { police: "999", ambulance: "999", tourist_helpline: "112" },
    quick_phrases: [
      { local: "What's the craic?", english: "How is it going?" },
      { local: "Cheers", english: "Thanks" },
      { local: "Grand", english: "All good / fine" },
    ],
    topics: {
      transport: "A Leap Visitor Card is handy if you are using buses from the airport plus the Luas and suburban rail over a couple of days.",
      money: "Cards are standard, and table-service tipping is modest rather than automatic.",
      safety: "Temple Bar is lively but not subtle, so late-night phone awareness matters more there than in most daytime sightseeing areas.",
      culture: "Pub music sessions are for listening first and joining second, and locals appreciate genuine conversation over performative Irishness.",
      food: "Book popular brunches and Sunday lunch spots because kitchens often run in clear service windows rather than all-day mode.",
      weather: "Windy rain beats umbrellas quickly, so a waterproof shell works better than anything delicate.",
      language: "Visitors hear mostly English, but slang like craic and grand turns up often and usually means the mood is positive.",
      connectivity: "Coverage is reliable, though older pubs and stone interiors can weaken indoor signal slightly.",
    },
  },
  {
    name: "Edinburgh",
    slug: "edinburgh",
    emergency: { police: "999", ambulance: "999", tourist_helpline: "101" },
    quick_phrases: [
      { local: "Cheers", english: "Thanks" },
      { local: "Wee", english: "Small" },
      { local: "Close", english: "Narrow alley or lane" },
    ],
    topics: {
      transport: "Contactless on buses and trams is easiest, but remember the Old Town is much steeper than it looks on a flat map.",
      money: "Cards are almost universal, and tipping is modest unless you are sitting down for full table service.",
      safety: "Wet stone stairways and closes are a more common problem than crime, so prioritize grip and dry feet on rainy days.",
      culture: "Festival season in August transforms pricing, crowds, and availability, so prebooking matters much more than at other times of year.",
      food: "Strong brunch, whisky, and modern Scottish spots sit outside the most obvious Royal Mile tourist strip, especially in Stockbridge and Leith.",
      weather: "Wind on exposed viewpoints can feel far colder than the forecast, so pack one extra layer even on pleasant-looking days.",
      language: "You will hear words like wee and aye often, and they simply mean small and yes.",
      connectivity: "Stone buildings can kill signal quickly, so download walking directions before ducking through the closes.",
    },
  },
  {
    name: "Dubai",
    slug: "dubai",
    emergency: { police: "999", ambulance: "998", tourist_helpline: "901" },
    quick_phrases: [
      { local: "Marhaba", english: "Hello" },
      { local: "Shukran", english: "Thank you" },
      { local: "Kam al-hisab?", english: "How much is the bill?" },
    ],
    topics: {
      transport: "The Metro plus short taxi hops is usually faster than walking any real distance, especially in the hotter months.",
      money: "Cards are standard everywhere, and service charges are often already built into hotel or upscale restaurant bills.",
      safety: "Dubai feels extremely safe, but local laws around intoxication, public arguments, and public affection are stricter than many visitors expect.",
      culture: "Dress more modestly in malls, old districts, and mosques than you might at a beach club or hotel pool.",
      food: "Book Friday and Saturday brunches in advance, and look to Karama, Deira, and JLT for stronger casual food value.",
      weather: "From late spring onward, heat can make even short outdoor walks exhausting, so indoor timing becomes part of the itinerary.",
      language: "English is common, but a simple 'shukran' lands well with taxi drivers and service staff.",
      connectivity: "Airport tourist SIMs are easy to set up, though some international calling apps remain restricted.",
    },
  },
  {
    name: "Singapore",
    slug: "singapore",
    emergency: { police: "999", ambulance: "995", tourist_helpline: "999" },
    quick_phrases: [
      { local: "Can", english: "Yes / that works" },
      { local: "Chope", english: "Reserve a seat with a tissue packet" },
      { local: "Lah", english: "A casual local tone softener" },
    ],
    topics: {
      transport: "Any contactless bank card usually works on the MRT and buses, making airport-to-city transfers especially painless.",
      money: "Cards are normal in malls and restaurants, but hawker centers and smaller stalls still sometimes favor cash or local wallet apps.",
      safety: "The city is very safe, but regulations around vaping, littering, and food or drinks on transit are enforced more seriously than in most destinations.",
      culture: "Queue neatly, return trays where requested in hawker centers, and do not assume air-conditioned indoor etiquette matches outdoor informality.",
      food: "Go early for famous hawker stalls because the best dishes sell out, and weekday lunches can be easier than weekend waits.",
      weather: "Short tropical downpours are normal, so a compact umbrella matters as much as sunscreen.",
      language: "English works everywhere, but hearing can, lah, and chope helps local conversations make more sense.",
      connectivity: "eSIMs are easy, data is fast, and public Wi-Fi is decent once you are signed in, so staying connected is simple.",
    },
  },
  {
    name: "Bangkok",
    slug: "bangkok",
    emergency: { police: "191", ambulance: "1669", tourist_helpline: "1155" },
    quick_phrases: [
      { local: "Sawasdee krub / ka", english: "Hello" },
      { local: "Khop khun krub / ka", english: "Thank you" },
      { local: "Mai phet", english: "Not spicy" },
    ],
    topics: {
      transport: "Use the BTS, MRT, river boats, and Grab to avoid road traffic that can turn short car rides into long delays.",
      money: "Street food, markets, and smaller shops still run smoother with cash, while tipping is lighter than in North America.",
      safety: "Say no to gem detours, suspiciously cheap tuk-tuk tours, and strangers who insist a major sight is closed today.",
      culture: "Temple visits require modest dress, and pointing feet toward shrines or sacred images is considered disrespectful.",
      food: "Follow local queues for street food, and if you want less heat, say so before the dish is cooked rather than afterward.",
      weather: "Bangkok heat drains energy quickly, so outdoor temples are far better early or late than in the middle of the day.",
      language: "Adding krub or ka to basic phrases makes them sound more polite immediately.",
      connectivity: "Airport SIMs are cheap and excellent value, which makes ride-hailing and translation much easier.",
    },
  },
  {
    name: "Hong Kong",
    slug: "hong-kong",
    emergency: { police: "999", ambulance: "999", tourist_helpline: "1823" },
    quick_phrases: [
      { local: "Neih hou", english: "Hello" },
      { local: "M goi", english: "Thanks / excuse me" },
      { local: "Dor je", english: "Thank you for a favor or gift" },
    ],
    topics: {
      transport: "An Octopus card is the citys superpower because it works on MTR, ferries, trams, buses, and even convenience-store top-ups.",
      money: "Cards are common, but cash still helps in older cha chaan tengs, taxis, and some neighborhood bakeries.",
      safety: "Hong Kong is low-friction for visitors, though wet pavements, steep stairs, and late typhoon warnings can catch people out.",
      culture: "Queues move fast, tables turn quickly, and no-nonsense service is normal rather than unfriendly.",
      food: "Dim sum is often best value at lunch, roast meat counters sell out earlier than tourists expect, and neighborhood tea cafes reward wandering.",
      weather: "Humidity stays intense for much of the year, and typhoon or rain alerts can change ferry and hiking plans quickly.",
      language: "English signage is strong, but a little Cantonese courtesy phrase often gets a warmer response.",
      connectivity: "Mobile data is strong, though underground malls and steep mid-level routes can make live GPS less intuitive than it seems.",
    },
  },
  {
    name: "Istanbul",
    slug: "istanbul",
    emergency: { police: "112", ambulance: "112", tourist_helpline: "153" },
    quick_phrases: [
      { local: "Merhaba", english: "Hello" },
      { local: "Tesekkurler", english: "Thank you" },
      { local: "Hesap lutfen", english: "The bill, please" },
    ],
    topics: {
      transport: "Get an Istanbulkart early because ferries, trams, metro lines, and buses together are far more useful than taxis alone.",
      money: "Carry some cash for smaller spots and expect moderate tipping, especially in restaurants and for helpful service.",
      safety: "Use official taxis or apps, confirm the meter is on, and keep an eye on your belongings in the busiest bazaars and tram corridors.",
      culture: "Mosque visits mean modest dress and shoe removal, and tea invitations are common but still worth reading with normal big-city caution.",
      food: "Do not limit yourself to kebabs; Turkish breakfast, meze, and seafood on the Bosphorus are where many visitors remember the city best.",
      weather: "The hills plus summer heat make walking more tiring than the map implies, so build ferry legs or shade breaks into your day.",
      language: "Even a basic 'merhaba' and 'tesekkurler' goes a long way because visitors often rely on English alone.",
      connectivity: "Data is useful here because hillside neighborhoods and ferry changes can complicate directions quickly.",
    },
  },
  {
    name: "Sydney",
    slug: "sydney",
    emergency: { police: "000", ambulance: "000", tourist_helpline: "131 444" },
    quick_phrases: [
      { local: "No worries", english: "Its fine / you are welcome" },
      { local: "Arvo", english: "Afternoon" },
      { local: "Takeaway", english: "To go" },
    ],
    topics: {
      transport: "Tap on with any contactless card for the Opal network, and use ferries whenever possible because they are transport and sightseeing at once.",
      money: "Cards are ubiquitous, and tipping is rare outside genuinely standout service or higher-end dining.",
      safety: "At the beach, the lifesaving flags matter more than confidence, so swim only between the red and yellow markers.",
      culture: "Cafe culture starts early, and locals are more likely to meet for breakfast, coffee, or an early drink than for a very late dinner.",
      food: "Reserve popular harbor-view brunches and weekend seafood spots ahead, because the best tables go early rather than late.",
      weather: "The sun is harsher than many visitors expect, so daily sunscreen matters even when the breeze feels cool.",
      language: "Australian English is easy overall, but terms like arvo and no worries turn up constantly.",
      connectivity: "Coverage is strong, but long coastal walks drain batteries fast, so portable power is worth carrying.",
    },
  },
];

const CITY_ALIAS_MAP = new Map<string, TravelTipsCitySeed>();

for (const city of TRAVEL_TIPS_CITIES) {
  for (const alias of [city.name, city.slug, ...(city.aliases ?? [])]) {
    CITY_ALIAS_MAP.set(slugify(alias), city);
  }
}

export const SUPPORTED_TRAVEL_TIP_CITIES = TRAVEL_TIPS_CITIES.map(city => ({
  name: city.name,
  slug: city.slug,
}));

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTravelTipTopic(value: string | null | undefined): TravelTipTopic | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return TRAVEL_TIP_TOPICS.includes(normalized as TravelTipTopic)
    ? normalized as TravelTipTopic
    : null;
}

export function resolveTravelTipsCity(city: string): TravelTipsCitySeed | null {
  return CITY_ALIAS_MAP.get(slugify(city)) ?? null;
}

export function buildTravelTipsPayload(
  city: string,
  topic?: TravelTipTopic | null,
): TravelTipsPayload | null {
  const matchedCity = resolveTravelTipsCity(city);
  if (!matchedCity) {
    return null;
  }

  const selectedTopics = topic ? [topic] : TRAVEL_TIP_TOPICS;

  return {
    city: matchedCity.name,
    tips: selectedTopics.map(entry => ({
      topic: entry,
      tip: matchedCity.topics[entry],
      importance: TOPIC_IMPORTANCE[entry],
    })),
    emergency: matchedCity.emergency,
    quick_phrases: matchedCity.quick_phrases,
  };
}

export function formatTravelTips(payload: TravelTipsPayload): string {
  return [
    `${payload.city} travel tips`,
    "",
    "Local insider advice:",
    ...payload.tips.map((tip, index) => `${index + 1}. [${TOPIC_LABELS[tip.topic]} | ${tip.importance}] ${tip.tip}`),
    "",
    `Emergency numbers: police ${payload.emergency.police} | ambulance ${payload.emergency.ambulance} | tourist helpline ${payload.emergency.tourist_helpline}`,
    "",
    "Quick phrases:",
    ...payload.quick_phrases.map(phrase => `- ${phrase.local} — ${phrase.english}`),
  ].join("\n");
}
