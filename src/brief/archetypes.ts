/**
 * Business archetypes: how each kind of business responds to each driver, and what to look for
 * on the map around it.
 *
 * Driver weights are -1..1. The sign says which way the signal moves demand (or, for farms and
 * livestock, the day's working conditions); the size says how strongly. These are transparent
 * rules of thumb written down so they can be argued with, not fitted to sales data. The brief
 * shows every weight next to its signal.
 */
import type { ArchetypeId, DriverId } from './types'

export type AnchorKey =
  | 'schools'
  | 'colleges'
  | 'hospitals'
  | 'worship'
  | 'mosques'
  | 'temples'
  | 'churches'
  | 'busStops'
  | 'busStations'
  | 'rail'
  | 'markets'
  | 'banks'
  | 'govt'
  | 'fuel'
  | 'lodging'
  | 'attractions'
  | 'cinemas'
  | 'parks'
  | 'offices'
  | 'shops'
  | 'eateries'
  | 'buildings'
  | 'mainRoads'
  | 'roads'
  | 'industrial'
  | 'farmland'
  | 'water'
  | 'agriSupply'
  | 'vets'

export interface AnchorSpec {
  key: AnchorKey
  label: string
  filters: string[]
  radiusM: number
  elements?: 'nwr' | 'way' | 'node'
}

/** Every place feature the brief counts, for every business. One Overpass request. */
export const ANCHORS: AnchorSpec[] = [
  { key: 'schools', label: 'Schools within 1 km', filters: ['["amenity"="school"]'], radiusM: 1000 },
  { key: 'colleges', label: 'Colleges and universities within 2 km', filters: ['["amenity"~"^(college|university)$"]'], radiusM: 2000 },
  { key: 'hospitals', label: 'Hospitals, clinics and doctors within 1 km', filters: ['["amenity"~"^(hospital|clinic|doctors)$"]'], radiusM: 1000 },
  { key: 'worship', label: 'Places of worship within 1 km', filters: ['["amenity"="place_of_worship"]'], radiusM: 1000 },
  { key: 'mosques', label: 'Mosques and dargahs within 1 km', filters: ['["amenity"="place_of_worship"]["religion"="muslim"]'], radiusM: 1000 },
  { key: 'temples', label: 'Temples within 1 km', filters: ['["amenity"="place_of_worship"]["religion"="hindu"]'], radiusM: 1000 },
  { key: 'churches', label: 'Churches within 1 km', filters: ['["amenity"="place_of_worship"]["religion"="christian"]'], radiusM: 1000 },
  { key: 'busStops', label: 'Bus stops within 500 m', filters: ['["highway"="bus_stop"]', '["public_transport"="platform"]["bus"="yes"]'], radiusM: 500 },
  { key: 'busStations', label: 'Bus stands within 2 km', filters: ['["amenity"="bus_station"]'], radiusM: 2000 },
  { key: 'rail', label: 'Railway stations within 2 km', filters: ['["railway"~"^(station|halt)$"]'], radiusM: 2000 },
  { key: 'markets', label: 'Marketplaces within 1 km', filters: ['["amenity"="marketplace"]'], radiusM: 1000 },
  { key: 'banks', label: 'Banks and ATMs within 1 km', filters: ['["amenity"~"^(bank|atm)$"]'], radiusM: 1000 },
  { key: 'govt', label: 'Government offices, courts, police and post offices within 1 km', filters: ['["office"="government"]', '["amenity"~"^(townhall|courthouse|police|post_office)$"]'], radiusM: 1000 },
  { key: 'fuel', label: 'Fuel stations within 1 km', filters: ['["amenity"="fuel"]'], radiusM: 1000 },
  { key: 'lodging', label: 'Hotels, lodges and guest houses within 1 km', filters: ['["tourism"~"^(hotel|guest_house|hostel|motel)$"]'], radiusM: 1000 },
  { key: 'attractions', label: 'Attractions, museums and heritage sites within 2 km', filters: ['["tourism"~"^(attraction|museum|viewpoint)$"]', '["historic"~"^(monument|fort|tomb|memorial|ruins|castle)$"]'], radiusM: 2000 },
  { key: 'cinemas', label: 'Cinemas within 2 km', filters: ['["amenity"="cinema"]'], radiusM: 2000 },
  { key: 'parks', label: 'Parks and playgrounds within 1 km', filters: ['["leisure"~"^(park|playground|stadium|sports_centre)$"]'], radiusM: 1000 },
  { key: 'offices', label: 'Offices within 1 km', filters: ['["office"]'], radiusM: 1000 },
  { key: 'shops', label: 'Shops of any kind within 500 m', filters: ['["shop"]'], radiusM: 500 },
  { key: 'eateries', label: 'Restaurants, cafes and fast food within 500 m', filters: ['["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]'], radiusM: 500 },
  { key: 'buildings', label: 'Mapped buildings within 500 m', filters: ['["building"]'], radiusM: 500, elements: 'way' },
  { key: 'mainRoads', label: 'Main-road segments (trunk, primary, secondary) within 300 m', filters: ['["highway"~"^(trunk|primary|secondary)$"]'], radiusM: 300, elements: 'way' },
  { key: 'roads', label: 'Road segments of any kind within 500 m', filters: ['["highway"]'], radiusM: 500, elements: 'way' },
  { key: 'industrial', label: 'Industrial areas within 2 km', filters: ['["landuse"="industrial"]'], radiusM: 2000, elements: 'way' },
  { key: 'farmland', label: 'Mapped farmland and orchard plots within 2 km', filters: ['["landuse"~"^(farmland|orchard|plantation)$"]'], radiusM: 2000, elements: 'way' },
  { key: 'water', label: 'Lakes, tanks and reservoirs within 2 km', filters: ['["natural"="water"]', '["landuse"="reservoir"]'], radiusM: 2000 },
  { key: 'agriSupply', label: 'Agri-input shops within 5 km', filters: ['["shop"~"^(agrarian|farm|garden_centre)$"]'], radiusM: 5000 },
  { key: 'vets', label: 'Veterinary clinics within 5 km', filters: ['["amenity"="veterinary"]'], radiusM: 5000 },
]

type Weights = Record<DriverId, number>

export interface Traits {
  sellsHot?: boolean
  sellsCold?: boolean
  perishable?: boolean
  outdoorStall?: boolean
  food?: boolean
  livestock?: 'dairy' | 'poultry'
  farm?: boolean
  needsPower?: boolean
  serviceAppointments?: boolean
}

export interface Archetype {
  id: ArchetypeId
  label: string
  keywords: string[]
  weights: Weights
  competitorFilters: string[]
  competitorLabel: string
  /** How much each anchor brings this business's customers (0..1). Missing = 0. */
  anchors: Partial<Record<AnchorKey, number>>
  traits: Traits
}

const W = (w: Partial<Weights>): Weights => ({
  heat: 0,
  rain: 0,
  outdoor_comfort: 0,
  air_quality: 0,
  festival: 0,
  weekend_holiday: 0,
  payday: 0,
  religious_gathering: 0,
  climate_anomaly: 0,
  field_conditions: 0,
  market_day: 0,
  // Events the city's news channels announce for that day (gatherings up, bandhs and closures
  // down). Most shops and stalls feel them; producers barely do.
  local_events: 0.5,
  ...w,
})

const FOOT_TRAFFIC: Partial<Record<AnchorKey, number>> = {
  busStops: 0.8,
  busStations: 1,
  rail: 0.8,
  markets: 1,
  schools: 0.5,
  colleges: 0.8,
  hospitals: 0.7,
  worship: 0.6,
  govt: 0.6,
  banks: 0.5,
  offices: 0.5,
  mainRoads: 0.8,
  shops: 0.6,
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'cafe_tea',
    label: 'Tea, coffee and snacks stall',
    keywords: ['tea', 'chai', 'coffee', 'cafe', 'café', 'tea stall', 'tapri', 'ಟೀ', 'ಚಹಾ', 'ಕಾಫಿ', 'chaha'],
    weights: W({ heat: -0.5, rain: -0.1, outdoor_comfort: 0.5, air_quality: 0.2, festival: 0.3, weekend_holiday: 0.2, payday: 0.2, religious_gathering: 0.8, climate_anomaly: -0.2, market_day: 0.6 }),
    competitorFilters: ['["amenity"="cafe"]', '["shop"~"^(tea|coffee)$"]'],
    competitorLabel: 'cafes and tea or coffee shops',
    anchors: { ...FOOT_TRAFFIC, colleges: 1, hospitals: 0.9, offices: 0.8 },
    traits: { sellsHot: true, food: true, outdoorStall: true },
  },
  {
    id: 'cold_beverages',
    label: 'Lassi, juice, buttermilk and ice cream',
    keywords: ['lassi', 'juice', 'sugarcane juice', 'ice cream', 'icecream', 'soda', 'buttermilk', 'majjige', 'cool drink', 'cool drinks', 'kulfi', 'gola', 'milkshake', 'falooda', 'ಲಸ್ಸಿ', 'ಜ್ಯೂಸ್', 'ಮಜ್ಜಿಗೆ', 'nimbu', 'lime soda', 'tender coconut', 'coconut water', 'sharbat'],
    weights: W({ heat: 1, rain: -0.7, outdoor_comfort: 0.2, air_quality: 0.2, festival: 0.4, weekend_holiday: 0.5, payday: 0.3, religious_gathering: 0.9, climate_anomaly: 0.6, market_day: 0.7 }),
    competitorFilters: ['["amenity"="ice_cream"]', '["shop"~"^(ice_cream|beverages)$"]', '["cuisine"~"juice|ice_cream|lassi"]'],
    competitorLabel: 'juice, ice cream and beverage shops',
    anchors: { ...FOOT_TRAFFIC, colleges: 1, parks: 0.7, attractions: 0.7 },
    traits: { sellsCold: true, food: true, perishable: true, outdoorStall: true, needsPower: true },
  },
  {
    id: 'street_food',
    label: 'Street food cart or stall',
    keywords: ['chaat', 'pani puri', 'panipuri', 'gobi', 'gobi manchurian', 'bhel', 'vada pav', 'street food', 'cart', 'pushcart', 'bajji', 'bhaji', 'egg rice', 'momos', 'pakoda', 'ಬಜ್ಜಿ', 'ಗೋಬಿ', 'masala puri', 'stall'],
    weights: W({ heat: -0.4, rain: -0.9, outdoor_comfort: 0.8, air_quality: 0.4, festival: 0.6, weekend_holiday: 0.6, payday: 0.4, religious_gathering: 1, climate_anomaly: -0.1, market_day: 0.8 }),
    competitorFilters: ['["amenity"~"^(fast_food|food_court)$"]'],
    competitorLabel: 'fast-food places and food courts',
    anchors: { ...FOOT_TRAFFIC, colleges: 1, parks: 0.8, cinemas: 0.7 },
    traits: { food: true, perishable: true, outdoorStall: true },
  },
  {
    id: 'restaurant_meals',
    label: 'Restaurant, mess or meals hotel',
    keywords: ['restaurant', 'hotel', 'mess', 'dhaba', 'meals', 'biryani', 'khanavali', 'darshini', 'canteen', 'tiffin', 'tiffin center', 'eatery', 'dosa', 'idli', 'ಹೋಟೆಲ್', 'ಖಾನಾವಳಿ', 'udupi'],
    weights: W({ heat: -0.2, rain: -0.4, outdoor_comfort: 0.4, air_quality: 0.2, festival: 0.5, weekend_holiday: 0.7, payday: 0.6, religious_gathering: 0.7, market_day: 0.4 }),
    competitorFilters: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'],
    competitorLabel: 'restaurants and eateries',
    anchors: { ...FOOT_TRAFFIC, offices: 0.9, lodging: 0.8, hospitals: 0.8 },
    traits: { food: true, perishable: true },
  },
  {
    id: 'sweets_bakery',
    label: 'Sweets shop or bakery',
    keywords: ['bakery', 'sweets', 'sweet shop', 'mithai', 'cake', 'bread', 'confectionery', 'ಬೇಕರಿ', 'ಸಿಹಿ', 'iyengar bakery', 'khova', 'pedha', 'dharwad pedha'],
    weights: W({ heat: -0.2, rain: -0.3, outdoor_comfort: 0.2, air_quality: 0.1, festival: 1, weekend_holiday: 0.4, payday: 0.5, religious_gathering: 0.7, market_day: 0.4 }),
    competitorFilters: ['["shop"~"^(bakery|confectionery|pastry)$"]'],
    competitorLabel: 'bakeries and sweet shops',
    anchors: { ...FOOT_TRAFFIC, temples: 0.8, schools: 0.7 },
    traits: { food: true, perishable: true },
  },
  {
    id: 'kirana',
    label: 'Kirana or grocery store',
    keywords: ['kirana', 'grocery', 'groceries', 'provision', 'provisions', 'general store', 'department store', 'ದಿನಸಿ', 'kiryana', 'supermarket'],
    weights: W({ rain: -0.2, outdoor_comfort: 0.1, festival: 0.6, weekend_holiday: 0.1, payday: 0.9, religious_gathering: 0.3, market_day: 0.3 }),
    competitorFilters: ['["shop"~"^(convenience|supermarket|general|grocery|variety_store)$"]'],
    competitorLabel: 'grocery, convenience and general stores',
    anchors: { buildings: 1, roads: 0.4, schools: 0.4, busStops: 0.4, markets: 0.5, mainRoads: 0.4 },
    traits: {},
  },
  {
    id: 'fruit_vegetable',
    label: 'Fruit or vegetable vendor',
    keywords: ['vegetable', 'vegetables', 'sabzi', 'sabji', 'fruit', 'fruits', 'tarkari', 'ತರಕಾರಿ', 'ಹಣ್ಣು', 'greengrocer', 'banana', 'mango seller'],
    weights: W({ heat: -0.6, rain: -0.6, outdoor_comfort: 0.4, air_quality: 0.1, festival: 0.6, weekend_holiday: 0.4, payday: 0.4, religious_gathering: 0.5, climate_anomaly: -0.3, market_day: 1 }),
    competitorFilters: ['["shop"="greengrocer"]', '["amenity"="marketplace"]'],
    competitorLabel: 'greengrocers and marketplaces',
    anchors: { buildings: 0.9, markets: 1, busStops: 0.6, mainRoads: 0.6, temples: 0.4 },
    traits: { perishable: true, outdoorStall: true, food: true },
  },
  {
    id: 'clothing',
    label: 'Clothing, saree or footwear shop',
    keywords: ['clothes', 'clothing', 'garments', 'garment', 'saree', 'sarees', 'textile', 'textiles', 'cloth', 'readymade', 'footwear', 'shoes', 'ಬಟ್ಟೆ', 'ಸೀರೆ', 'kurta', 'dress'],
    weights: W({ heat: -0.3, rain: -0.6, outdoor_comfort: 0.5, air_quality: 0.2, festival: 1, weekend_holiday: 0.7, payday: 0.9, religious_gathering: 0.5, market_day: 0.6 }),
    competitorFilters: ['["shop"~"^(clothes|fabric|boutique|shoes|bag)$"]'],
    competitorLabel: 'clothing, fabric and footwear shops',
    anchors: { ...FOOT_TRAFFIC, shops: 1, markets: 1 },
    traits: {},
  },
  {
    id: 'tailoring',
    label: 'Tailoring or boutique',
    keywords: ['tailor', 'tailoring', 'stitching', 'boutique', 'darji', 'blouse', 'embroidery', 'ಟೈಲರ್', 'alteration'],
    weights: W({ heat: -0.1, rain: -0.2, outdoor_comfort: 0.2, festival: 0.9, weekend_holiday: 0.2, payday: 0.4, religious_gathering: 0.3, market_day: 0.3 }),
    competitorFilters: ['["shop"~"^(tailor|sewing)$"]', '["craft"="tailor"]'],
    competitorLabel: 'tailors',
    anchors: { buildings: 0.8, shops: 0.7, markets: 0.6, schools: 0.4, colleges: 0.5 },
    traits: { serviceAppointments: true, needsPower: true },
  },
  {
    id: 'flowers_puja',
    label: 'Flowers, garlands and puja items',
    keywords: ['flower', 'flowers', 'puja', 'pooja', 'garland', 'garlands', 'hoovu', 'ಹೂವು', 'ಹೂ', 'agarbatti', 'incense', 'camphor', 'marigold', 'jasmine', 'mallige'],
    weights: W({ heat: -0.6, rain: -0.4, outdoor_comfort: 0.3, festival: 1, weekend_holiday: 0.3, payday: 0.2, religious_gathering: 1, climate_anomaly: -0.3, market_day: 0.5 }),
    competitorFilters: ['["shop"~"^(florist|religion)$"]'],
    competitorLabel: 'florists and religious-goods shops',
    anchors: { worship: 1, temples: 1, mosques: 0.6, markets: 0.8, busStops: 0.4 },
    traits: { perishable: true, outdoorStall: true },
  },
  {
    id: 'mobile_electronics',
    label: 'Mobile, recharge and electronics',
    keywords: ['mobile', 'phone', 'recharge', 'electronics', 'repair', 'mobile repair', 'sim', 'accessories', 'ಮೊಬೈಲ್', 'computer'],
    weights: W({ heat: -0.1, rain: -0.4, outdoor_comfort: 0.3, festival: 0.8, weekend_holiday: 0.6, payday: 1, religious_gathering: 0.2, market_day: 0.4 }),
    competitorFilters: ['["shop"~"^(mobile_phone|electronics|telecommunication|computer)$"]'],
    competitorLabel: 'mobile, electronics and computer shops',
    anchors: { ...FOOT_TRAFFIC, colleges: 1, shops: 0.8 },
    traits: { needsPower: true },
  },
  {
    id: 'pharmacy',
    label: 'Medical store or pharmacy',
    keywords: ['medical', 'medical store', 'pharmacy', 'chemist', 'medicine', 'medicines', 'druggist', 'ಔಷಧ'],
    weights: W({ heat: 0.3, rain: 0.2, outdoor_comfort: -0.1, air_quality: -0.5, weekend_holiday: -0.1, payday: 0.4, religious_gathering: 0.2, climate_anomaly: 0.1 }),
    competitorFilters: ['["amenity"="pharmacy"]', '["shop"="chemist"]'],
    competitorLabel: 'pharmacies and chemists',
    anchors: { hospitals: 1, buildings: 0.7, busStops: 0.3, mainRoads: 0.4 },
    traits: {},
  },
  {
    id: 'salon',
    label: 'Salon, barber or beauty parlour',
    keywords: ['salon', 'barber', 'parlour', 'parlor', 'beauty', 'hair', 'haircut', 'spa', 'mehendi', 'mehndi', 'ಸಲೂನ್'],
    weights: W({ heat: -0.2, rain: -0.5, outdoor_comfort: 0.3, festival: 0.9, weekend_holiday: 0.8, payday: 0.6, religious_gathering: 0.4, market_day: 0.3 }),
    competitorFilters: ['["shop"~"^(hairdresser|beauty|massage)$"]'],
    competitorLabel: 'salons and beauty parlours',
    anchors: { buildings: 0.9, colleges: 0.6, shops: 0.6, busStops: 0.4, offices: 0.4 },
    traits: { serviceAppointments: true, needsPower: true },
  },
  {
    id: 'stationery_print',
    label: 'Stationery, books and photocopy',
    keywords: ['stationery', 'stationary', 'xerox', 'photocopy', 'print', 'printing', 'books', 'book shop', 'lamination', 'dtp'],
    weights: W({ heat: -0.1, rain: -0.3, outdoor_comfort: 0.2, festival: 0.2, weekend_holiday: -0.8, payday: 0.3, religious_gathering: 0.1, market_day: 0.2 }),
    competitorFilters: ['["shop"~"^(stationery|copyshop|books)$"]'],
    competitorLabel: 'stationery, copy and book shops',
    anchors: { schools: 1, colleges: 1, govt: 0.9, offices: 0.7, banks: 0.4 },
    traits: { needsPower: true },
  },
  {
    id: 'hardware',
    label: 'Hardware, paint and building materials',
    keywords: ['hardware', 'paint', 'paints', 'cement', 'sanitary', 'electricals', 'electrical', 'plumbing', 'tiles', 'steel', 'building material'],
    weights: W({ heat: -0.2, rain: -0.6, outdoor_comfort: 0.4, festival: 0.2, weekend_holiday: -0.2, payday: 0.5, market_day: 0.4 }),
    competitorFilters: ['["shop"~"^(hardware|doityourself|paint|trade|building_materials|electrical)$"]'],
    competitorLabel: 'hardware and building-material shops',
    anchors: { mainRoads: 1, buildings: 0.6, industrial: 0.6, fuel: 0.3 },
    traits: {},
  },
  {
    id: 'lodging',
    label: 'Lodge, guest house or homestay',
    keywords: ['lodge', 'lodging', 'guest house', 'guesthouse', 'homestay', 'dharamshala', 'hostel', 'rooms', 'pg'],
    weights: W({ heat: -0.1, rain: -0.3, outdoor_comfort: 0.3, air_quality: 0.1, festival: 0.6, weekend_holiday: 0.6, payday: 0.1, religious_gathering: 1, market_day: 0.2 }),
    competitorFilters: ['["tourism"~"^(hotel|guest_house|hostel|motel)$"]'],
    competitorLabel: 'hotels, lodges and guest houses',
    anchors: { busStations: 1, rail: 1, attractions: 1, worship: 0.6, hospitals: 0.7, mainRoads: 0.6 },
    traits: {},
  },
  {
    id: 'transport',
    label: 'Auto, taxi or goods transport',
    keywords: ['auto', 'autorickshaw', 'rickshaw', 'taxi', 'cab', 'tempo', 'transport', 'delivery', 'goods vehicle', 'driver', 'ಆಟೋ'],
    weights: W({ heat: 0.1, rain: 0.1, outdoor_comfort: 0.1, festival: 0.8, weekend_holiday: 0.4, payday: 0.3, religious_gathering: 1, market_day: 0.8, local_events: 0.8 }),
    competitorFilters: ['["amenity"="taxi"]'],
    competitorLabel: 'taxi and auto stands',
    anchors: { busStations: 1, rail: 1, markets: 0.8, hospitals: 0.7, mainRoads: 0.6 },
    traits: {},
  },
  {
    id: 'dairy',
    label: 'Dairy animals and milk',
    keywords: ['dairy', 'milk', 'cow', 'cows', 'buffalo', 'buffaloes', 'cattle', 'ಹಾಲು', 'ಹಸು', 'ghee', 'paneer', 'curd'],
    weights: W({ heat: -0.7, rain: -0.2, outdoor_comfort: 0.4, festival: 0.4, payday: 0.2, climate_anomaly: -0.4, local_events: 0.1 }),
    competitorFilters: ['["shop"="dairy"]'],
    competitorLabel: 'dairy shops',
    anchors: { buildings: 0.6, vets: 0.6, markets: 0.5, water: 0.4 },
    traits: { livestock: 'dairy', perishable: true },
  },
  {
    id: 'poultry',
    label: 'Poultry, goat or sheep',
    keywords: ['poultry', 'chicken', 'broiler', 'broilers', 'layer', 'layers', 'hen', 'hens', 'goat', 'goats', 'sheep', 'mutton', 'egg farm', 'ಕೋಳಿ', 'ಕುರಿ', 'ಮೇಕೆ'],
    weights: W({ heat: -0.9, rain: -0.2, outdoor_comfort: 0.3, weekend_holiday: 0.7, payday: 0.5, religious_gathering: 0.4, climate_anomaly: -0.5, local_events: 0.2 }),
    competitorFilters: ['["shop"~"^(butcher|poultry)$"]'],
    competitorLabel: 'butchers and poultry shops',
    anchors: { buildings: 0.6, vets: 0.7, markets: 0.6, mainRoads: 0.4 },
    traits: { livestock: 'poultry' },
  },
  {
    id: 'farm_crop',
    label: 'Crop farming',
    keywords: ['farmer', 'farm', 'farming', 'crop', 'crops', 'cotton', 'tur', 'toor', 'tur dal', 'jowar', 'paddy', 'rice field', 'ragi', 'maize', 'corn', 'groundnut', 'chilli', 'onion', 'tomato farm', 'horticulture', 'agriculture', 'sugarcane farm', 'sunflower', 'bengal gram', 'chickpea', 'ರೈತ', 'ಕೃಷಿ', 'ಬೆಳೆ', 'ತೊಗರಿ', 'ಜೋಳ'],
    weights: W({ field_conditions: 1, heat: -0.3, rain: -0.5, outdoor_comfort: 0.3, market_day: 0.5, local_events: 0.1 }),
    competitorFilters: [],
    competitorLabel: '',
    anchors: { agriSupply: 1, vets: 0.3, markets: 0.8, farmland: 0.5, water: 0.6, mainRoads: 0.5 },
    traits: { farm: true },
  },
  {
    id: 'general_retail',
    label: 'General shop',
    keywords: ['shop', 'store', 'business', 'gift', 'fancy store', 'bangles', 'cosmetics', 'toys', 'variety', 'jewellery', 'jewelry'],
    weights: W({ heat: -0.2, rain: -0.4, outdoor_comfort: 0.4, air_quality: 0.1, festival: 0.7, weekend_holiday: 0.5, payday: 0.7, religious_gathering: 0.4, market_day: 0.5 }),
    competitorFilters: ['["shop"~"^(variety_store|gift|cosmetics|jewelry|toys|general|department_store)$"]'],
    competitorLabel: 'variety, gift and general shops',
    anchors: { ...FOOT_TRAFFIC, shops: 1 },
    traits: {},
  },
]

export function archetypeById(id: ArchetypeId): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[ARCHETYPES.length - 1]
}

/**
 * Pick the archetype whose keywords best match what the user typed. Specific, longer keywords
 * beat generic ones, and words that say "I grow or rear this" (farm, farmer, acres, ರೈತ…) move
 * the match to the producer archetypes: "vegetable farmer" is farming, "vegetable seller" is a
 * vendor, "poultry farm" is poultry.
 */
const FARM_INTENT = /(^| )(farm|farmer|farmers|farming|grow|grower|growing|cultivate|cultivating|cultivation|acre|acres|field|fields|rear|rearing)( |$)|ರೈತ|ಕೃಷಿ/
const PRODUCERS: ArchetypeId[] = ['farm_crop', 'dairy', 'poultry']

export function matchArchetype(business: string): { archetype: Archetype; matched: string | null } {
  const text = ` ${business.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')} `
  const farmIntent = FARM_INTENT.test(text)
  let best: { archetype: Archetype; matched: string; score: number } | null = null
  for (const a of ARCHETYPES) {
    for (const k of a.keywords) {
      const needle = ` ${k.toLowerCase()} `
      const hit = text.includes(needle) || (k.length >= 5 && text.includes(` ${k.toLowerCase()}`))
      if (!hit) continue
      // Generic words ("shop", "stall", "farm") score lower than specific ones.
      const generic = ['shop', 'store', 'business', 'stall', 'cart', 'hotel', 'farm'].includes(k)
      const score = k.length + (generic ? 0 : 10) + (farmIntent && PRODUCERS.includes(a.id) ? 20 : 0)
      if (!best || score > best.score) best = { archetype: a, matched: k, score }
    }
  }
  return best ? { archetype: best.archetype, matched: best.matched } : { archetype: archetypeById('general_retail'), matched: null }
}
