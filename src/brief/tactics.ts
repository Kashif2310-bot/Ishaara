/**
 * Tactics: concrete, rule-based actions for tomorrow. Every rule names the metrics it rests on,
 * and every number in its text is read from those metrics. Farm and livestock tactics describe
 * conditions to discuss with the local Krishi Vigyan Kendra (KVK); they never name a pesticide,
 * a dose or a seed variety.
 */
import type { Archetype } from './archetypes'
import { daysBetween, hijri, weekday, WEEKDAYS } from './calendar'
import { festivalSignal, isHoliday, ursOn, type Facts } from './facts'
import { heatIndexBand, indianAqiFromPm, moonAgeDays, naqiBand, thiBand, uvBand, wbgtBand } from './formulas'
import type { DayOutlook, Tactic, Verdict } from './types'

const f0 = (n: number) => Math.round(n).toString()
const f1 = (n: number) => n.toFixed(1)
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

const FESTIVAL_STOCK: Partial<Record<Archetype['id'], string>> = {
  sweets_bakery: 'Take pre-orders for sweet boxes and gift packs now, and fix a pick-up time for each.',
  flowers_puja: 'Book extra garlands, loose flowers and puja kits from the wholesaler a day early; flowers sell out on the eve.',
  clothing: 'Put festive wear at the front, keep popular sizes in depth, and display prices clearly.',
  kirana: 'Stock up on festival staples (oil, sugar, ghee, jaggery, dry fruits, pooja items) before the wholesale rush.',
  salon: 'Open festival bookings and extend hours on the eve.',
  tailoring: 'Accept festival orders now with a clear last date for delivery; refuse what you cannot finish.',
  mobile_electronics: 'Display gift-ready accessories and any EMI or exchange offers at the counter.',
  restaurant_meals: 'Offer family and party pre-orders; prepare more of your best sellers.',
  street_food: 'Prepare more of your best sellers for the evening crowd.',
  cold_beverages: 'Keep extra stock for evening crowds.',
  cafe_tea: 'Expect visitors and errands: stock more snacks.',
  general_retail: 'Put gift items and festival goods at the front.',
  lodging: 'Expect travellers: confirm room readiness and phone bookings.',
  transport: 'Expect travel demand to markets, temples and bus stands.',
}

const ANCHOR_NOUN: Record<string, string> = {
  schools: 'schools',
  colleges: 'colleges',
  hospitals: 'hospitals and clinics',
  busStops: 'bus stops',
  busStations: 'bus stands',
  rail: 'railway stations',
  markets: 'marketplaces',
  offices: 'offices',
  govt: 'government offices',
  worship: 'places of worship',
  temples: 'temples',
  mosques: 'mosques',
  banks: 'banks and ATMs',
}

const ANCHOR_HOURS: Record<string, string> = {
  schools: 'schools: 08:00–09:00 and 15:30–17:00',
  colleges: 'colleges: 09:00–10:00, lunch and 16:00–18:00',
  hospitals: 'hospitals: visitors all day, peaks in the morning OPD hours',
  busStops: 'bus stops: morning and evening commutes',
  busStations: 'bus stands: early morning and evening',
  rail: 'railway station: around train times',
  markets: 'market: morning buying hours',
  offices: 'offices: 13:00–14:00 and 17:30–19:00',
  govt: 'government offices: 10:00–17:00 on working days',
  worship: 'worship places: early morning and evening, and festival days',
  temples: 'temples: early morning and evening',
  mosques: 'mosques: prayer times, especially Friday midday',
  banks: 'banks: 10:00–16:00 on working days',
}

export function buildTactics(facts: Facts, archetype: Archetype, verdict: Verdict | null, outlookDays: DayOutlook[], marketDay?: number): Tactic[] {
  const T = facts.days[0] ?? null
  const tr = archetype.traits
  const tm = facts.tomorrow
  const tactics: Tactic[] = []
  const add = (t: Tactic) => tactics.push(t)
  const isFood = !!tr.food
  const isProducer = !!tr.farm || !!tr.livestock

  // ------------------------------------------------------------ heat
  if (T?.heatIndexMax != null) {
    const hi = T.heatIndexMax
    const peak = T.heatIndexPeakHour != null ? ` around ${hh(T.heatIndexPeakHour)}` : ''
    if (hi >= 41 || (hi >= 32 && (T.wbgtMax ?? 0) >= 31.1)) {
      add({
        id: 'heat.safety',
        kind: 'avoid',
        priority: 96,
        title: 'Protect people from dangerous heat',
        detail: `Heat index peaks at ${f1(hi)} °C (${heatIndexBand(hi)})${peak}${T.wbgtMax != null ? `; shade WBGT ${f1(T.wbgtMax)} °C (${wbgtBand(T.wbgtMax)})` : ''}. Keep drinking water and ORS at hand, take shade breaks every hour between 12:00 and 16:00, and move heavy work to the morning.`,
        basis: ['wx.heat_index', 'wx.wbgt'],
      })
    } else if (hi >= 32 && (tr.outdoorStall || isProducer) && (T.rainProbTrading ?? 0) < 60) {
      add({
        id: 'heat.shade',
        kind: 'act',
        priority: 68,
        title: 'Shade the afternoon',
        detail: `Heat index reaches ${f1(hi)} °C (${heatIndexBand(hi)})${peak}. Put up shade over the stall or work area and keep water for yourself and customers.`,
        basis: ['wx.heat_index'],
      })
    }
  }
  if (tr.sellsCold && T?.hotHours != null && T.hotHours >= 3) {
    add({
      id: 'heat.cold_stock',
      kind: 'act',
      priority: 92,
      title: 'Chill extra stock tonight',
      detail: `${T.hotHours} trading hours will feel 35 °C or hotter. Freeze extra ice or chill extra stock tonight so you do not run out in the afternoon peak, and keep the counter in shade so drinks stay cold.`,
      basis: ['wx.hot_hours', 'wx.feels_max'],
    })
  }
  if (tr.sellsHot && T?.hotHours != null && T.hotHours >= 4) {
    add({
      id: 'heat.hot_drinks',
      kind: 'act',
      priority: 74,
      title: 'Lead with cool options in the afternoon',
      detail: `${T.hotHours} hot hours: keep tea and coffee for the morning and evening, and offer buttermilk, lemon or iced drinks in the afternoon if you can.`,
      basis: ['wx.hot_hours'],
    })
  }
  if (tr.sellsHot && T && ((T.rainProbTrading ?? 0) >= 50 || (T.feelsMax ?? 99) <= 26)) {
    add({
      id: 'cool.hot_drinks',
      kind: 'act',
      priority: 80,
      title: 'Rain or cool day: hot drinks and fried snacks sell',
      detail: `Rain chance ${f0(T.rainProbTrading ?? 0)} % and feels-like maximum ${f1(T.feelsMax ?? 0)} °C. Make more tea and coffee, and fry snacks in small batches so they stay hot.`,
      basis: ['wx.rain_prob_trading', 'wx.feels_max'],
    })
  }
  if (tr.livestock === 'dairy' && T?.tMax != null && T.tMax >= 32) {
    add({
      id: 'heat.milk',
      kind: 'field',
      priority: 74,
      title: 'Cool the milk fast',
      detail: `Maximum ${f1(T.tMax)} °C. Milk sours quickly in heat: get it to the cooler or society within two hours of milking, and deliver early.`,
      basis: ['wx.tmax'],
    })
  }
  if (tr.perishable && !isProducer && T?.tMax != null && T.tMax >= 35) {
    add({
      id: 'heat.perishables',
      kind: 'act',
      priority: 79,
      title: 'Buy fresh in smaller batches',
      detail: `Maximum ${f1(T.tMax)} °C shortens shelf life. Buy or prepare smaller lots, restock at midday, and keep stock shaded, wet-covered or iced.`,
      basis: ['wx.tmax'],
    })
  }
  if (facts.days.length && facts.normals.size) {
    const n = facts.normals.get(tm)
    if (T?.tMax != null && n?.normTmax != null) {
      const anom = T.tMax - n.normTmax
      if (T.tMax >= 45 || (T.tMax >= 40 && anom >= 4.5)) {
        add({
          id: 'heat.heatwave',
          kind: 'avoid',
          priority: 97,
          title: 'Heat-wave conditions',
          detail: `Maximum ${f1(T.tMax)} °C is ${f1(anom)} °C above the 10-year normal, meeting the IMD heat-wave rule for plains. Avoid outdoor work 12:00–16:00 and check on older people and animals.`,
          basis: ['cl.heatwave', 'cl.anom_tmax'],
        })
      } else if (anom >= 3 && tr.sellsCold) {
        add({
          id: 'heat.anomaly',
          kind: 'act',
          priority: 70,
          title: 'Unusually hot for the season',
          detail: `${f1(anom)} °C above the 10-year normal for this date. People are not used to it yet, so cold drinks tend to sell faster than on an ordinary hot day.`,
          basis: ['cl.anom_tmax'],
        })
      }
    }
  }

  // ------------------------------------------------------------ rain, wind, storms
  if (T) {
    const p = T.rainProbTrading ?? T.rainProbMax ?? 0
    const first = T.firstRainHour
    if (p >= 60 || (T.rainMm ?? 0) >= 15.6) {
      if (tr.outdoorStall) {
        add({
          id: 'rain.cover',
          kind: 'act',
          priority: 90,
          title: first != null ? `Be under cover before ${hh(first)}` : 'Keep a rain cover ready',
          detail: `Rain chance ${f0(p)} % in trading hours, ${f1(T.rainMm ?? 0)} mm expected. Keep a tarpaulin and plastic covers ready and move stock off the ground.`,
          basis: ['wx.rain_prob_trading', 'wx.rain_mm', 'wx.first_rain'],
        })
      } else if (!isProducer) {
        add({
          id: 'rain.walkins',
          kind: 'watch',
          priority: 66,
          title: 'Fewer walk-ins once it rains',
          detail: `Rain chance ${f0(p)} %${first != null ? `, likely from ${hh(first)}` : ''}. Take phone and WhatsApp orders, offer delivery, and keep the entrance dry.`,
          basis: ['wx.rain_prob_trading', 'wx.first_rain'],
        })
      }
    }
    if (first != null && first >= 11 && (isFood || tr.outdoorStall)) {
      add({
        id: 'rain.before',
        kind: 'act',
        priority: 78,
        title: `Sell hard before ${hh(first)}`,
        detail: `Rain becomes likely from ${hh(first)}. Open early and put your fastest-selling items out first.`,
        basis: ['wx.first_rain'],
      })
    }
    if (T.thunder) {
      add({
        id: 'storm.thunder',
        kind: 'avoid',
        priority: 93,
        title: 'Thunderstorm risk',
        detail: `${T.capeMax != null ? `Instability (CAPE) up to ${f0(T.capeMax)} J/kg. ` : ''}Tie down canopies, unplug electronics when it starts, and do not stay in open fields or under lone trees during thunder.`,
        basis: ['wx.thunder', 'wx.cape'],
      })
    }
    if ((T.gustMax ?? 0) >= 40) {
      add({
        id: 'wind.gust',
        kind: 'act',
        priority: 84,
        title: 'Tie down canopy and signboards',
        detail: `Gusts up to ${f0(T.gustMax ?? 0)} km/h. Weigh down umbrellas and tarpaulins and keep light stock in closed crates.`,
        basis: ['wx.gust'],
      })
    }
    if ((T.uvMax ?? 0) >= 8 && (tr.outdoorStall || tr.perishable || isProducer)) {
      add({
        id: 'sun.uv',
        kind: 'watch',
        priority: 58,
        title: `UV ${uvBand(T.uvMax ?? 0)}`,
        detail: `UV index ${f1(T.uvMax ?? 0)} for ${T.uvHighHours ?? 0} hours. Shade produce and flowers, and wear a cap and full sleeves outdoors.`,
        basis: ['wx.uv', 'wx.uv_hours'],
      })
    }
    if ((T.fogHours ?? 0) >= 2) {
      add({
        id: 'fog.morning',
        kind: 'watch',
        priority: archetype.id === 'transport' ? 82 : 52,
        title: 'Morning fog likely',
        detail: `${T.fogHours} fog-risk hours. Expect late buses and deliveries in the morning; drive with lights on.`,
        basis: ['wx.fog'],
      })
    }
    if (tr.perishable && (T.rhMean ?? 0) >= 80) {
      add({
        id: 'damp.spoilage',
        kind: 'watch',
        priority: 57,
        title: 'Damp air spoils stock faster',
        detail: `Average humidity ${f0(T.rhMean ?? 0)} %. Bread, flowers, leafy greens and fried items go soft or mouldy sooner: keep them covered and buy a little less.`,
        basis: ['wx.humidity'],
      })
    }
    if ((T.afterSunsetTradingHours ?? 0) >= 2 && (isFood || tr.outdoorStall)) {
      add({
        id: 'light.evening',
        kind: 'act',
        priority: 44,
        title: 'Light up the evening',
        detail: `Sunset ${T.sunset ?? ''}; about ${f1(T.afterSunsetTradingHours ?? 0)} hours of trading after dark until 22:00. A bright, clean light draws evening customers.`,
        basis: ['wx.sunset', 'wx.after_dark'],
      })
    }
    if (isFood && (T.eveningComfortHours ?? 0) >= 4 && (T.hotHours ?? 0) >= 3) {
      add({
        id: 'evening.window',
        kind: 'act',
        priority: 64,
        title: 'The evening is your window',
        detail: `Afternoon is hot, but ${T.eveningComfortHours} evening hours (17:00–22:00) are comfortable. Rest stock in the afternoon and stay open late.`,
        basis: ['wx.evening_comfort', 'wx.hot_hours'],
      })
    }
  }

  // ------------------------------------------------------------ air
  if (facts.air) {
    const aqi = indianAqiFromPm(facts.air.pm25Mean, facts.air.pm10Mean)
    if (aqi != null && aqi > 200) {
      if (archetype.id === 'pharmacy') {
        add({
          id: 'air.pharmacy',
          kind: 'act',
          priority: 76,
          title: 'Poor air: stock masks',
          detail: `Indian AQI about ${aqi} (${naqiBand(aqi)}) from PM2.5 and PM10. Expect more cough and breathing complaints; keep masks and common cold remedies at the counter.`,
          basis: ['air.naqi', 'air.pm25'],
        })
      } else if (isFood || tr.outdoorStall) {
        add({
          id: 'air.cover',
          kind: 'act',
          priority: 62,
          title: 'Poor air: cover food',
          detail: `Indian AQI about ${aqi} (${naqiBand(aqi)}). Keep food and drinks covered; outdoor seating is less attractive today.`,
          basis: ['air.naqi'],
        })
      }
    }
  }
  if (archetype.id === 'pharmacy' && (T?.hotHours ?? 0) >= 3) {
    add({
      id: 'heat.pharmacy',
      kind: 'act',
      priority: 78,
      title: 'Heat: stock ORS and electrolytes',
      detail: `${T?.hotHours} hours at feels-like 35 °C or more. Keep ORS sachets, glucose and electrolyte drinks in view.`,
      basis: ['wx.hot_hours'],
    })
  }
  if (archetype.id === 'pharmacy' && (facts.past7.rainMm ?? 0) >= 20) {
    add({
      id: 'rain.mosquito',
      kind: 'act',
      priority: 60,
      title: 'Wet week: mosquito season items',
      detail: `${f1(facts.past7.rainMm ?? 0)} mm of rain in the last 7 days leaves standing water. Stock repellents and mosquito nets.`,
      basis: ['wk.past_rain'],
    })
  }

  // ------------------------------------------------------------ calendar
  const ev = facts.calendar.events
  const fest = festivalSignal(tm, ev, facts.calendar.state)
  if (fest.event && fest.signal >= 0.4 && !isProducer) {
    add({
      id: 'cal.festival',
      kind: 'act',
      priority: 88,
      title: fest.daysAway === 0 ? `${fest.event.name} tomorrow` : `${fest.event.name} in ${(fest.daysAway ?? 0) + 1} days`,
      detail: `${FESTIVAL_STOCK[archetype.id] ?? 'Put festival goods at the front.'}${fest.event.note ? ` (${fest.event.note})` : ''}`,
      basis: ['cal.festival'],
    })
  }
  const hol = isHoliday(tm, ev)
  const wd = weekday(tm)
  if (hol || wd === 0) {
    const what = hol ? hol.name : 'Sunday'
    if (archetype.id === 'stationery_print' || archetype.id === 'hardware') {
      add({ id: 'cal.closed', kind: 'avoid', priority: 72, title: `${what}: schools and offices shut`, detail: 'Keep stock and hours short; use the day for restocking and repairs.', basis: ['cal.holiday', 'cal.weekend'] })
    } else if (['restaurant_meals', 'street_food', 'salon', 'clothing', 'lodging', 'cold_beverages', 'sweets_bakery'].includes(archetype.id)) {
      add({ id: 'cal.family', kind: 'act', priority: 70, title: `${what}: family outings`, detail: 'Expect more families and groups from late morning; have help on hand for the evening rush.', basis: ['cal.holiday', 'cal.weekend'] })
    } else if (archetype.id === 'poultry' && wd === 0) {
      add({ id: 'cal.sunday_meat', kind: 'act', priority: 66, title: 'Sunday meat demand', detail: 'Sunday is the usual peak for chicken and mutton; arrange supply and buyers a day ahead.', basis: ['cal.weekend'] })
    }
  }
  const dom = Number(tm.slice(8, 10))
  if (dom <= 7 && ['kirana', 'clothing', 'mobile_electronics', 'general_retail', 'restaurant_meals', 'salon', 'hardware'].includes(archetype.id)) {
    add({
      id: 'cal.payday',
      kind: 'act',
      priority: 63,
      title: 'Salary week',
      detail: archetype.id === 'kirana' ? 'Households buy the month’s supplies now: keep monthly packs and bigger sizes in front.' : 'Customers have cash this week: put higher-value items forward.',
      basis: ['cal.payday'],
    })
  } else if (dom >= 26 && !isProducer) {
    add({ id: 'cal.month_end', kind: 'watch', priority: 40, title: 'Month-end squeeze', detail: 'Cash is tight: smaller packs move better and credit requests rise. Decide your credit limit before opening.', basis: ['cal.month_end'] })
  }
  if (ursOn(tm, facts.calendar.nearKalaburagi)) {
    add({
      id: 'cal.urs',
      kind: 'act',
      priority: 95,
      title: 'Urs of Khwaja Bande Nawaz: crowds expected',
      detail: 'Thousands of pilgrims of many faiths gather at the dargah. Extend hours, carry plenty of change and UPI QR, and stock fast-moving items. The date is computed from the Islamic calendar: confirm with the dargah committee, as the moon sighting can shift it by a day.',
      basis: ['cal.urs'],
    })
  } else if (facts.calendar.nextUrs) {
    const d = daysBetween(facts.today, facts.calendar.nextUrs)
    if (d <= 30) {
      add({ id: 'cal.urs_soon', kind: 'watch', priority: 55, title: `Urs in about ${d} days`, detail: `Computed start ${facts.calendar.nextUrs}. Plan stock, help and any stall permission now.`, basis: ['cal.urs'] })
    }
  }
  const H = hijri(tm)
  if (H?.month === 9 && (isFood || archetype.id === 'fruit_vegetable')) {
    add({
      id: 'cal.ramadan',
      kind: 'act',
      priority: 84,
      title: 'Ramadan: the iftar hour',
      detail: `Fruit, juices, dates and fried snacks sell in the hour before sunset${T?.sunset ? ` (${T.sunset})` : ''}. Have stock ready by late afternoon. Dates are computed and depend on the moon sighting.`,
      basis: ['cal.ramadan', 'wx.sunset'],
    })
  }
  if (wd === 5 && (facts.osm?.counts.mosques ?? 0) > 0 && (isFood || archetype.id === 'flowers_puja' || tr.outdoorStall)) {
    add({ id: 'cal.friday', kind: 'act', priority: 48, title: 'Friday prayers nearby', detail: `${facts.osm?.counts.mosques} mosque(s) within 1 km. Expect a crowd around the midday prayer; be stocked before 12:30.`, basis: ['osm.mosques'] })
  }
  const age = moonAgeDays(tm)
  const isMoonDay = age < 1.5 || age > 28 || (age >= 14 && age < 16)
  if (isMoonDay && archetype.id === 'flowers_puja') {
    add({ id: 'cal.moon', kind: 'act', priority: 60, title: 'Purnima / Amavasya: temple visits rise', detail: 'Approximate moon date: more temple visits and puja. Stock flowers and puja items for the morning.', basis: ['cal.moon', 'osm.temples'] })
  }
  if (marketDay != null) {
    if (marketDay === wd) {
      add({
        id: 'cal.santhe',
        kind: 'act',
        priority: 86,
        title: 'Market day tomorrow',
        detail: isProducer
          ? 'A chance to sell produce or buy inputs. Check the day’s rates with other sellers before you agree a price.'
          : 'Set up early near the market and carry more stock and change than usual.',
        basis: ['cal.market_day'],
      })
    } else {
      const daysTo = (marketDay - wd + 7) % 7
      if (daysTo > 0 && daysTo <= 2) {
        add({ id: 'cal.santhe_soon', kind: 'watch', priority: 50, title: `Market day ${daysTo === 1 ? 'the day after tomorrow' : `in ${daysTo} days`} (${WEEKDAYS[marketDay]})`, detail: 'Order stock now so it arrives in time.', basis: ['cal.market_day'] })
      }
    }
  }

  // ------------------------------------------------------------ place and competition
  if (facts.osm && archetype.competitorFilters.length) {
    const nearest = facts.osm.competitors[0]
    const c500 = facts.osm.counts.comp500 ?? 0
    if (nearest && nearest.distanceM <= 100) {
      add({
        id: 'comp.nearest',
        kind: 'watch',
        priority: 50,
        title: `A competitor is ${nearest.distanceM} m away`,
        detail: `${nearest.name ? `${nearest.name}` : 'A mapped competitor'} is very close. Win on something they do not offer (a signature item, speed, cleanliness, timing) rather than on price alone.`,
        basis: ['comp.nearest'],
      })
    }
    if (c500 >= 8) {
      add({ id: 'comp.crowded', kind: 'watch', priority: 46, title: `${c500} similar businesses within 500 m`, detail: 'A crowded spot: the busiest hours matter most. Be fully stocked and staffed exactly at the peak.', basis: ['comp.500'] })
    }
  }
  if (facts.osm) {
    const counts = facts.osm.counts
    const ranked = Object.entries(archetype.anchors)
      .map(([k, w]) => ({ k, w: w ?? 0, c: counts[k] ?? 0 }))
      .filter((x) => x.c > 0 && ANCHOR_HOURS[x.k])
      .sort((a, b) => b.w * Math.log1p(b.c) - a.w * Math.log1p(a.c))
    if (ranked.length && !isProducer) {
      const top = ranked.slice(0, 2)
      add({
        id: 'place.anchor_hours',
        kind: 'act',
        priority: 47,
        title: 'Time your peak to what is around you',
        detail: `Nearby: ${top.map((t) => `${t.c} ${ANCHOR_NOUN[t.k] ?? t.k}`).join(' and ')}. Typical rush hours, ${top.map((t) => ANCHOR_HOURS[t.k]).join('; ')}.`,
        basis: top.map((t) => `osm.${t.k}`),
      })
    }
    if ((counts.buildings ?? 0) < 20) {
      add({ id: 'dq.sparse_map', kind: 'watch', priority: 32, title: 'The map here is thin', detail: 'Few buildings are mapped within 500 m, so anchor and competitor counts understate what is really there. Trust your own eyes over these counts.', basis: ['dq.osm_density'] })
    }
  }

  // ------------------------------------------------------------ farm
  if (tr.farm && T) {
    if ((T.sprayHours ?? 0) >= 2 && T.sprayWindow) {
      add({
        id: 'farm.spray',
        kind: 'field',
        priority: 87,
        title: `Spray window ${T.sprayWindow}`,
        detail: `${T.sprayHours} hours have gentle wind, low rain chance and Delta T in the 2–8 °C range. If a spray is due, ask your KVK which product and dose suit your crop.`,
        basis: ['crop.spray_window', 'crop.spray_hours'],
      })
    } else {
      add({ id: 'farm.no_spray', kind: 'field', priority: 80, title: 'No good spray window tomorrow', detail: 'Wind, rain chance or dryness (Delta T) are outside the suitable range all day. Sprays are likely to drift or wash off.', basis: ['crop.spray_hours'] })
    }
    if ((T.diseaseHours ?? 0) >= 10) {
      add({ id: 'farm.disease', kind: 'field', priority: 79, title: 'Conditions favour fungal disease', detail: `${T.diseaseHours} hours of leaf wetness at 15–30 °C. Walk the field and look under leaves; show anything unusual to your KVK before spraying.`, basis: ['crop.disease_hours', 'crop.leaf_wet'] })
    }
    if ((T.rainMm ?? 0) >= 5) {
      add({ id: 'farm.cover', kind: 'field', priority: 85, title: 'Cover harvested produce', detail: `${f1(T.rainMm ?? 0)} mm of rain expected. Cover heaps and threshing floors, and do not apply fertiliser just before rain.`, basis: ['wx.rain_mm'] })
    } else if ((T.dryingHours ?? 0) >= 5) {
      add({ id: 'farm.drying', kind: 'field', priority: 60, title: `Good drying day (${T.dryingHours} h)`, detail: 'Dry, sunny and low-humidity hours: a good day to sun-dry harvested produce.', basis: ['crop.drying_hours'] })
    }
    const weekRain = facts.days.reduce((a, d) => a + (d.rainMm ?? 0), 0)
    if (weekRain >= 50) {
      add({ id: 'farm.drains', kind: 'field', priority: 76, title: `${f0(weekRain)} mm of rain this week`, detail: 'Clear field drains and bunds now; hold back fertiliser until the heavy spell passes.', basis: ['wk.rain_total'] })
    }
    const et = facts.days.reduce((a, d) => a + (d.et0 ?? 0), 0)
    if (facts.days.length && et - weekRain >= 20 && (facts.soil?.sm3 ?? 1) < 0.2) {
      add({ id: 'farm.irrigate', kind: 'field', priority: 70, title: 'Soil is drying', detail: `Crops will lose about ${f0(et)} mm to evaporation this week against ${f1(weekRain)} mm of rain, and model topsoil moisture is low. Check soil by hand and plan irrigation for early morning or evening.`, basis: ['crop.balance', 'soil.sm_root'] })
    }
    if ((T.tMax ?? 0) >= 38) {
      add({ id: 'farm.heat', kind: 'field', priority: 69, title: 'Crop and worker heat stress', detail: `Maximum ${f1(T.tMax ?? 0)} °C. Irrigate (if planned) early or late, not at midday, and finish field work by 11:00.`, basis: ['wx.tmax'] })
    }
    if ((T.fieldHours ?? 13) < 4) {
      add({ id: 'farm.limited', kind: 'avoid', priority: 65, title: `Only ${T.fieldHours} workable field hours`, detail: 'Plan indoor jobs: repairs, sorting, input purchases.', basis: ['crop.field_hours'] })
    }
  }
  if (tr.livestock === 'dairy' && T?.thiMax != null && T.thiMax >= 72) {
    add({
      id: 'stock.thi',
      kind: 'field',
      priority: 86,
      title: `Cattle heat stress (THI ${f0(T.thiMax)}, ${thiBand(T.thiMax)})`,
      detail: `${T.thiStressHours ?? 0} hours at THI 72 or more. Give shade and plenty of cool water, feed in the cooler hours, and milk early.${T.thiMax >= 79 ? ' Wetting the animals or a sprinkler helps at this level.' : ''} Milk yield usually dips in heat stress.`,
      basis: ['stock.thi', 'stock.thi_hours'],
    })
  }
  if (tr.livestock === 'poultry' && (T?.poultryHeatHours ?? 0) >= 3) {
    add({
      id: 'stock.poultry',
      kind: 'field',
      priority: 86,
      title: `${T?.poultryHeatHours} heat hours for birds`,
      detail: 'Open the shed for airflow, give cool water (ask your vet about electrolytes), and avoid catching or transporting birds at midday.',
      basis: ['stock.poultry_hours'],
    })
  }
  if (facts.river?.tomorrow != null && facts.river.median && facts.river.tomorrow / facts.river.median >= 2) {
    add({ id: 'water.river_high', kind: 'watch', priority: 72, title: `River running ${(facts.river.tomorrow / facts.river.median).toFixed(1)}× typical`, detail: 'Avoid low crossings and causeways, and lift pumps and stock away from the bank.', basis: ['river.ratio'] })
  }

  // ------------------------------------------------------------ the week
  const scored = outlookDays.filter((d) => d.index != null)
  if (scored.length >= 3) {
    const best = scored.reduce((a, b) => ((b.index ?? 0) > (a.index ?? 0) ? b : a))
    const worst = scored.reduce((a, b) => ((b.index ?? 100) < (a.index ?? 100) ? b : a))
    if (best.date !== worst.date) {
      add({
        id: 'week.plan',
        kind: 'watch',
        priority: 54,
        title: `Best day this week: ${WEEKDAYS[weekday(best.date)]} ${best.date.slice(8)}`,
        detail: `Index ${f0(best.index ?? 0)}${best.tags.length ? ` (${best.tags.join(', ')})` : ''}. Weakest: ${WEEKDAYS[weekday(worst.date)]} ${worst.date.slice(8)} at ${f0(worst.index ?? 0)}${worst.tags.length ? ` (${worst.tags.join(', ')})` : ''}. Plan big purchases and offers around them.`,
        basis: ['wk.rain_total', 'wk.hot_days'],
      })
    }
  }

  if (verdict === 'push' && !isProducer) {
    add({ id: 'verdict.push', kind: 'act', priority: 89, title: 'Prepare more than usual', detail: 'The signals point to a busier day than normal. Prepare or buy more of your top sellers and arrange an extra pair of hands for the peak.', basis: ['brief.index'] })
  } else if (verdict === 'protect' && !isProducer) {
    add({ id: 'verdict.protect', kind: 'avoid', priority: 89, title: 'Hold back on stock', detail: 'The signals point to a slower day. Prepare less perishable stock and spend the quiet hours on cleaning, accounts or restocking dry goods.', basis: ['brief.index'] })
  }

  return tactics.sort((a, b) => b.priority - a.priority)
}
