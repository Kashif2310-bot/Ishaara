/** Plain helpers for the brief UI, kept out of the component file so it only exports components. */
import { WEEKDAYS } from '../../brief/calendar'
import type { Verdict } from '../../brief/types'

export const VERDICT_TEXT: Record<Verdict, { word: string; producer: string; blurb: string }> = {
  push: { word: 'Push', producer: 'Good day', blurb: 'Busier than an ordinary day. Prepare more.' },
  normal: { word: 'Normal', producer: 'Ordinary day', blurb: 'An ordinary day. Run your usual plan.' },
  protect: { word: 'Protect', producer: 'Protect', blurb: 'Slower or riskier than usual. Hold back and protect stock.' },
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(
    new Date(`${iso}T12:00:00+05:30`),
  )
}

export function weekdayName(n: number): string {
  return WEEKDAYS[n]
}
