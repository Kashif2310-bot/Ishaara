/**
 * Kalaburagi (Gulbarga) district: places, and the local event calendar.
 *
 * Every fixed date below names its source. Dates that follow a lunar calendar are either
 * copied from an announcement, or computed and labelled as computed, with the rule used.
 *
 * Sources
 *   [URS26]  Deda & Sons, "Khwaja Banda Nawaz Gesu Daraz urs date" — 622nd Urs held 3–5 May 2026;
 *            623rd listed for 24 Apr 2027 (16 Dhu al-Qadah 1448). https://dedaandsons.com/khwaja-banda-nawaz-gesu-daraz-urs-date.php
 *   [URSW]   Wikipedia, Bande Nawaz; Aale Qutub — Urs on 15, 16, 17 Dhu al-Qadah; the Jhela (flower
 *            spire) ceremony one month before. https://en.wikipedia.org/wiki/Bande_Nawaz ·
 *            https://aalequtub.com/hazrat-syed-banda-nawaz-gesudaraz-gulbargah-r-a/
 *   [URS25]  Siasat, 16 May 2025 — Urs special trains Hyderabad ⇄ Kalaburagi on 17 and 18 May 2025.
 *            https://www.siasat.com/spl-trains-from-hyderabad-to-kalaburagi-for-urs-e-hazrat-khwaja-bandan-nawaz-3221265/
 *   [SBJ]    Sharanabasaveshwar Jatra / Rathotsava: held 12 Mar 2023 (ANI via LatestLY) and 22 Mar 2022
 *            (The Hindu via inkl) — both four days after Holi (Phalguna Krishna Panchami).
 *            https://www.latestly.com/socially/india/news/watch-karnataka-a-large-number-of-devotees-participated-in-sharanabasaveshwara-jatra-latest-tweet-by-ani-4939382.html
 *   [KA26]   Government of Karnataka general holidays 2026 (Sakshi Post, 26 Nov 2025): Balipadyami
 *            10 Nov, Kanakadasa Jayanthi 27 Nov. https://www.sakshipost.com/news/national/karnataka-2026-holiday-calendar-released-check-general-restricted-local-holidays
 *   [DATTA]  Datta Jayanti 2026 (Margashirsha Purnima) on 23 Dec 2026 — Hindutone.
 *            https://hindutone.com/festivals/datta-jayanti-2026-date-dattatreya/
 *   [KKU]    Kalyana Karnataka Utsava, 17 September every year (Hyderabad-Karnataka liberation day);
 *            covered by Kalaburagi 24.7 in Sept 2026.
 */
import { addDays, daysBetween, distanceKm, hijri, type CalendarEntry } from './calendar'

export const KALABURAGI_CITY = { lat: 17.3297, lng: 76.8343 }
/** Radius within which the Urs crowd is felt directly (the city). */
export const URS_CROWD_RADIUS_KM = 15

/** Taluk headquarters and big pilgrimage towns in the district, for the place picker. */
export const DISTRICT_PLACES: Array<{ name: string; query: string; note?: string }> = [
  { name: 'Kalaburagi city', query: 'Kalaburagi' },
  { name: 'Aland', query: 'Aland, Kalaburagi' },
  { name: 'Afzalpur', query: 'Afzalpur, Kalaburagi' },
  { name: 'Chincholi', query: 'Chincholi, Kalaburagi' },
  { name: 'Chittapur', query: 'Chitapur, Kalaburagi' },
  { name: 'Jevargi', query: 'Jevargi, Kalaburagi' },
  { name: 'Kalagi', query: 'Kalagi, Kalaburagi' },
  { name: 'Kamalapur', query: 'Kamalapur, Kalaburagi' },
  { name: 'Sedam', query: 'Sedam, Kalaburagi' },
  { name: 'Shahabad', query: 'Shahabad, Kalaburagi' },
  { name: 'Wadi', query: 'Wadi, Kalaburagi' },
  { name: 'Yadrami', query: 'Yadrami, Kalaburagi' },
  { name: 'Ganagapur', query: 'Ganagapur, Kalaburagi', note: 'Dattatreya temple town' },
]

/**
 * Localities that Kalaburagi news posts name. Used to pin a post to a part of the city.
 * Spellings are as the channels write them; several have aliases.
 */
export const LOCALITIES: Array<{ name: string; aliases: string[] }> = [
  { name: 'Jagat Circle', aliases: ['jagat circle', 'jagath circle'] },
  { name: 'Sardar Vallabhbhai Patel Circle', aliases: ['sardar vallabhbhai patel circle', 'svp circle', 'sardar patel circle'] },
  { name: 'Ram Mandir Circle', aliases: ['ram mandir circle'] },
  { name: 'Super Market', aliases: ['super market', 'supermarket'] },
  { name: 'Muslim Chowk', aliases: ['muslim chowk'] },
  { name: 'Khadri Chowk', aliases: ['khadri chowk'] },
  { name: 'Timmapuri Chowk', aliases: ['timmapuri chowk', 'timmapur chowk'] },
  { name: 'Tipu Sultan Chowk', aliases: ['tipu sultan chowk'] },
  { name: 'Channa Bhatti Chowk', aliases: ['channa bhatti'] },
  { name: 'Ring Road', aliases: ['ring road'] },
  { name: 'Hagarga Cross', aliases: ['hagarga'] },
  { name: 'Azadpur Road', aliases: ['azadpur'] },
  { name: 'Station Road', aliases: ['station road'] },
  { name: 'Aland Road', aliases: ['aland road'] },
  { name: 'Sedam Road', aliases: ['sedam road'] },
  { name: 'Jewargi Road', aliases: ['jewargi road', 'jevargi road'] },
  { name: 'Shahbazar', aliases: ['shahbazar', 'shah bazar'] },
  { name: 'Haft Gumbad', aliases: ['haft gumbad'] },
  { name: 'Noorbagh', aliases: ['noorbagh', 'noor bagh'] },
  { name: 'Peer Bangali Ground', aliases: ['peer bangali'] },
  { name: 'Khwaja Bande Nawaz Dargah', aliases: ['bande nawaz', 'banda nawaz', 'bandanawaz', 'gesudaraz', 'gesu daraz', 'dargah shareef', 'dargah sharif'] },
  { name: 'Sharanabasaveshwar Temple', aliases: ['sharanabasaveshwar', 'sharana basaveshwara', 'sharanabasappa', 'appaji'] },
  { name: 'Yadulla Colony', aliases: ['yadulla colony'] },
  { name: 'MSK Mill', aliases: ['msk mill'] },
  { name: 'Rozah', aliases: ['rozah', 'roza'] },
  { name: 'Khwaja Colony', aliases: ['khwaja colony'] },
  { name: 'Mominpura', aliases: ['mominpura'] },
  { name: 'Brahmapur', aliases: ['brahmapur'] },
  { name: 'Shahabad', aliases: ['shahabad'] },
  { name: 'Wadi', aliases: ['wadi '] },
  { name: 'Aland', aliases: ['aland'] },
  { name: 'Afzalpur', aliases: ['afzalpur'] },
  { name: 'Jevargi', aliases: ['jevargi', 'jewargi'] },
  { name: 'Chittapur', aliases: ['chittapur', 'chitapur'] },
  { name: 'Sedam', aliases: ['sedam'] },
  { name: 'Chincholi', aliases: ['chincholi'] },
  { name: 'Kamalapur', aliases: ['kamalapur', 'kamalpur'] },
  { name: 'Kalagi', aliases: ['kalagi', 'kalgi'] },
  { name: 'Ganagapur', aliases: ['ganagapur', 'gangapur', 'ganagapura'] },
]

/** Words that mark a post as being about Kalaburagi (any language the channels use). */
export const LOCAL_MARKERS = ['kalaburagi', 'kalaburgi', 'kalburgi', 'gulbarga', 'gulbarg', 'glb', 'klb', 'ಕಲಬುರಗಿ', 'ಗುಲ್ಬರ್ಗಾ', 'गुलबर्गा', 'कलबुर्गी', 'kalyana karnataka', 'kalyan karnataka']

const DISTRICT_NAME = /kalaburagi|gulbarga|kalburgi|ಕಲಬುರಗಿ/i

/**
 * Is this resolved place inside Kalaburagi district? Accepts the geocoder's district field or
 * its display name; as a last check, the place must also be in Karnataka and within 110 km of
 * the city (the district is roughly 160 km across).
 */
export function inKalaburagiDistrict(p: { lat: number; lng: number; district?: string; state?: string; displayName: string }): boolean {
  const named = DISTRICT_NAME.test(p.district ?? '') || DISTRICT_NAME.test(p.displayName)
  const inState = /karnataka/i.test(p.state ?? '') || /karnataka/i.test(p.displayName)
  return named && inState && distanceKm(p.lat, p.lng, KALABURAGI_CITY.lat, KALABURAGI_CITY.lng) <= 110
}

/** Make a free-text place resolve inside the district. */
export function districtQuery(text: string): string {
  const t = text.trim()
  return DISTRICT_NAME.test(t) ? `${t}, Karnataka` : `${t}, Kalaburagi, Karnataka`
}

// ---------------------------------------------------------------- local calendar

const MOON = 'Islamic date as observed in India, computed; the local moon sighting can move it by a day.'

function ev(date: string, name: string, kind: CalendarEntry['kind'], source: string, retail: boolean, note?: string): CalendarEntry {
  return note ? { date, name, kind, source, retail, note } : { date, name, kind, source, retail }
}

/** Fixed-date and announced local events, 2026–2027. */
export const KALABURAGI_FIXED: CalendarEntry[] = [
  ev('2026-10-23', 'North-East Teachers’ Constituency poll, 8 am–4 pm', 'local', 'Election Commission (PTI); Regional Commissioner, Kalaburagi division (Suddione)', false, 'Holiday only for registered teacher voters; prohibitory orders around polling centres.'),
  ev('2026-10-27', 'Teachers’ Constituency vote count at Gulbarga University', 'local', 'Regional Commissioner, Kalaburagi division (Suddione)', false, 'Prohibitory orders around the counting centre (Bhaskara Bhavan).'),
  ev('2026-11-10', 'Balipadyami (Karnataka holiday)', 'state', 'Government of Karnataka holidays 2026 [KA26]', true),
  ev('2026-11-27', 'Kanakadasa Jayanthi (Karnataka holiday)', 'state', 'Government of Karnataka holidays 2026 [KA26]', false),
  ev('2026-12-23', 'Datta Jayanti at Ganagapur (Dattatreya temple)', 'local', 'Margashirsha Purnima 2026 [DATTA]', true, 'Big pilgrim day at Ganagapur, Afzalpur taluk. Date from a festival calendar site; check with the temple.'),
  ev('2027-03-27', 'Sharanabasaveshwar Jatra and Rathotsava', 'local', 'Inferred: four days after Holi, as in 2022 and 2023 [SBJ]; Holi 2027 is 23 Mar (DoPT)', true, 'Inferred date. Devotees come from Kalaburagi, Raichur, Vijayapura, Bidar and nearby Maharashtra and Andhra; the fair runs around the temple for several days.'),
  ev('2027-04-14', 'Dr B. R. Ambedkar Jayanti', 'state', 'Karnataka general holiday every year on 14 April', true, 'Large processions and gatherings in Kalaburagi city.'),
  ev('2027-09-17', 'Kalyana Karnataka Utsava', 'state', 'Observed every 17 September [KKU]', true, 'Official celebrations in Kalaburagi; drone show in 2026.'),
]

/**
 * Islamic observances computed from the India-observed calendar. DoPT already lists Id-ul-Fitr,
 * Id-ul-Zuha, Muharram and Milad-un-Nabi for 2027, so those are not repeated here.
 */
export function islamicEventsBetween(from: string, to: string, distanceFromCityKm: number): CalendarEntry[] {
  const out: CalendarEntry[] = []
  const span = daysBetween(from, to)
  for (let i = 0; i <= span; i++) {
    const d = addDays(from, i)
    const h = hijri(d)
    if (!h) continue
    if (h.month === 8 && h.day === 15) out.push(ev(d, 'Shab-e-Barat', 'islamic_computed', 'India-observed Islamic calendar', false, `${MOON} Night prayers; dargahs and graveyards are crowded after dark.`))
    if (h.month === 9 && h.day === 1) out.push(ev(d, 'Ramadan begins', 'islamic_computed', 'India-observed Islamic calendar', false, `${MOON} Evening iftar buying for the whole month.`))
    if (h.month === 9 && h.day === 27) out.push(ev(d, 'Shab-e-Qadr (27 Ramadan)', 'islamic_computed', 'India-observed Islamic calendar', false, MOON))
    if (h.month === 12 && h.day === 3) out.push(ev(d, 'Bakrid livestock buying week begins', 'islamic_computed', 'India-observed Islamic calendar (one week before 10 Dhu al-Hijjah)', false, `${MOON} Goat and sheep prices and footfall at animal markets peak in the days before Bakrid.`))
    if (h.month === 10 && h.day === 15) out.push(ev(d, 'Jhela ceremony at the Bande Nawaz dargah (approximate)', 'islamic_computed', 'Held about one month before the Urs [URSW]', false, `${MOON} The exact day is set by the dargah.`))
    if (h.month === 11 && h.day >= 15 && h.day <= 17) {
      const near = distanceFromCityKm <= URS_CROWD_RADIUS_KM
      out.push(
        ev(
          d,
          `Urs of Khwaja Bande Nawaz, day ${h.day - 14} of 3`,
          'islamic_computed',
          '15–17 Dhu al-Qadah [URSW]; India date checked against 2026 (3–5 May) and 2027 (24 Apr) [URS26]',
          // Scored by the religious-gathering driver, not as a buying festival, so it is not counted twice.
          false,
          `${MOON} Hundreds of thousands of pilgrims of every faith; special trains from Hyderabad.${near ? '' : ' Your place is outside the city, so expect travel through it rather than crowds at your door.'}`,
        ),
      )
    }
  }
  return out
}

export function kalaburagiEventsBetween(from: string, to: string, distanceFromCityKm: number): CalendarEntry[] {
  return [...KALABURAGI_FIXED.filter((e) => e.date >= from && e.date <= to), ...islamicEventsBetween(from, to, distanceFromCityKm)]
}

/** 1 within the city during the Urs, 0.35 elsewhere in the district (travel, not crowds). */
export function ursStrength(distanceFromCityKm: number): number {
  return distanceFromCityKm <= URS_CROWD_RADIUS_KM ? 1 : 0.35
}
