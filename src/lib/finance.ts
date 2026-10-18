/**
 * NSFDC Micro Finance & Term Loan.
 * All internal money math is integer **paise** (1 rupee = 100 paise).
 * Display converts paise → rupees only at the edge.
 *
 * Reducing-balance quarterly annuity EMI:
 *   r = annual_rate / 4 / 100
 *   n = tenure_years × 4 − moratorium_quarters
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 *
 * Compounding uses integer tenths-of-a-percent over denominator 4000
 * (r = annualRate/400 = tenths/4000) so (1+r)^n is exact BigInt rational math.
 */

import { MORATORIUM_INTEREST_POLICY, NSFDC } from './config'

export const MICRO_CAP = NSFDC.microProjectCapRupees
export const TERM_CAP = NSFDC.termProjectCapRupees
export const MARGIN_RATIO = NSFDC.marginRatio
export const LOAN_RATIO = NSFDC.loanRatio
export { MORATORIUM_INTEREST_POLICY }

/** Rate scale: quarterly r = annualPercent / 400 = tenths / RATE_DENOM. */
const RATE_DENOM = 4000

export type SchemeId = 'micro_finance' | 'term_loan' | 'over_limit' | 'under_margin'

export interface SchemePlan {
  schemeId: SchemeId
  schemeName: string
  schemeNameKn: string
  projectCost: number
  loanAmount: number
  marginRequired: number
  interestRate: number
  tenureYears: number
  moratoriumMonths: number
  quarterlyEmi: number
  repaymentQuarters: number
  schedule: Array<{
    quarter: number
    dueDateLabel: string
    principal: number
    interest: number
    total: number
    status: 'moratorium' | 'repayment'
  }>
  /** @deprecated UI uses workingCapital module; kept for opsCostMonthly coupling */
  workingCapitalHint: number
  opsCostMonthly: number
  moratoriumPolicy: typeof MORATORIUM_INTEREST_POLICY
  /** Remaining principal after full schedule (must be 0 for in-scope schemes). */
  closingPrincipalPaise: number
  /** Principal after moratorium interest is capitalised (paise). */
  capitalizedPrincipalPaise: number
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function fromPaise(paise: number): number {
  return paise / 100
}

function rateTenths(annualRatePercent: number): number {
  return Math.round(annualRatePercent * 10)
}

/** Quarterly interest on a paise balance, nearest paise. */
export function quarterlyInterestPaise(balancePaise: number, annualRatePercent: number): number {
  const tenths = rateTenths(annualRatePercent)
  return Math.floor((balancePaise * tenths + RATE_DENOM / 2) / RATE_DENOM)
}

/**
 * Standard annuity EMI in paise.
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1) with r = tenths/RATE_DENOM.
 */
export function annuityEmiPaise(
  principalPaise: number,
  annualRatePercent: number,
  n: number,
): number {
  if (n <= 0 || principalPaise <= 0) return 0
  const tenths = BigInt(rateTenths(annualRatePercent))
  const d = BigInt(RATE_DENOM)
  const b = d + tenths
  let powB = 1n
  let powD = 1n
  for (let i = 0; i < n; i++) {
    powB *= b
    powD *= d
  }
  const P = BigInt(principalPaise)
  const num = P * tenths * powB
  const den = d * (powB - powD)
  return Number((num + den / 2n) / den)
}

function ninetyPercentPaise(projectPaise: number): number {
  // Integer 90% — avoid float (project × 0.9).
  return Math.floor((projectPaise * 9) / 10)
}

export function buildSchemePlan(availableMarginRupees: number, startDate = new Date()): SchemePlan {
  if (!Number.isFinite(availableMarginRupees) || availableMarginRupees <= 0) {
    return emptyPlan('under_margin', 0, 0, availableMarginRupees || 0)
  }

  // project = margin ÷ 10% ⇒ ×10; round at paise of the *project*, not margin×10 after rounding.
  const projectPaise = Math.round(availableMarginRupees * 10 * 100)
  const marginPaise = toPaise(availableMarginRupees)
  const rawLoanPaise = ninetyPercentPaise(projectPaise)
  const projectCost = fromPaise(projectPaise)

  if (projectPaise <= toPaise(NSFDC.microProjectCapRupees)) {
    const loanPaise = Math.min(rawLoanPaise, toPaise(NSFDC.microLoanCapRupees))
    return computePlan({
      schemeId: 'micro_finance',
      schemeName: 'NSFDC Micro Finance Scheme',
      schemeNameKn: 'ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ಮೈಕ್ರೋ ಫೈನಾನ್ಸ್ ಯೋಜನೆ',
      projectPaise,
      loanPaise,
      marginPaise,
      interestRate: NSFDC.microRate,
      tenureYears: NSFDC.microTenureYears,
      moratoriumMonths: NSFDC.microMoratoriumMonths,
      startDate,
      opsCostMonthlyPaise: Math.round(projectPaise * 0.04),
      workingCapitalHintPaise: Math.round(projectPaise * 0.18),
    })
  }

  if (projectPaise <= toPaise(NSFDC.termProjectCapRupees)) {
    const loanPaise = Math.min(rawLoanPaise, toPaise(NSFDC.termLoanCapRupees))
    return computePlan({
      schemeId: 'term_loan',
      schemeName: 'NSFDC Term Loan Scheme',
      schemeNameKn: 'ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ಟರ್ಮ್ ಲೋನ್ ಯೋಜನೆ',
      projectPaise,
      loanPaise,
      marginPaise,
      interestRate: NSFDC.termRate,
      tenureYears: NSFDC.termTenureYears,
      moratoriumMonths: NSFDC.termMoratoriumMonths,
      startDate,
      opsCostMonthlyPaise: Math.round(projectPaise * 0.035),
      workingCapitalHintPaise: Math.round(projectPaise * 0.15),
    })
  }

  return emptyPlan('over_limit', projectCost, fromPaise(rawLoanPaise), availableMarginRupees)
}

function emptyPlan(
  schemeId: SchemeId,
  projectCost: number,
  loanAmount: number,
  marginRequired: number,
): SchemePlan {
  const names =
    schemeId === 'over_limit'
      ? {
          schemeName: `Above NSFDC Term Loan Cap (₹50L). Max supported margin capital is ₹${NSFDC.maxMarginRupees.toLocaleString('en-IN')}.`,
          schemeNameKn: `ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ಮಿತಿ ಮೀರಿದೆ (₹50 ಲಕ್ಷ). ಗರಿಷ್ಠ ಬೆಂಬಲಿತ ಮಾರ್ಜಿನ್ ₹${NSFDC.maxMarginRupees.toLocaleString('en-IN')}.`,
        }
      : {
          schemeName: 'Margin capital of 0 or empty is not allowed — enter a positive amount (do not divide by zero).',
          schemeNameKn: 'ಮಾರ್ಜಿನ್ 0 ಅಥವಾ ಖಾಲಿ ಅಮಾನ್ಯ — ಧನಾತ್ಮಕ ಮೊತ್ತ ನಮೂದಿಸಿ (ಶೂನ್ಯದಿಂದ ಭಾಗಿಸಲಾಗುವುದಿಲ್ಲ).',
        }
  return {
    schemeId,
    ...names,
    projectCost,
    loanAmount,
    marginRequired,
    interestRate: 0,
    tenureYears: 0,
    moratoriumMonths: 0,
    quarterlyEmi: 0,
    repaymentQuarters: 0,
    schedule: [],
    workingCapitalHint: 0,
    opsCostMonthly: 0,
    moratoriumPolicy: MORATORIUM_INTEREST_POLICY,
    closingPrincipalPaise: 0,
    capitalizedPrincipalPaise: 0,
  }
}

function computePlan(input: {
  schemeId: SchemeId
  schemeName: string
  schemeNameKn: string
  projectPaise: number
  loanPaise: number
  marginPaise: number
  interestRate: number
  tenureYears: number
  moratoriumMonths: number
  startDate: Date
  opsCostMonthlyPaise: number
  workingCapitalHintPaise: number
}): SchemePlan {
  const totalQuarters = input.tenureYears * 4
  const moratoriumQuarters = input.moratoriumMonths / 3
  const repaymentQuarters = totalQuarters - moratoriumQuarters

  let remaining = input.loanPaise
  const schedule: SchemePlan['schedule'] = []

  for (let q = 1; q <= totalQuarters; q++) {
    const due = new Date(input.startDate)
    due.setMonth(due.getMonth() + q * 3)
    const dueDateLabel = due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

    if (q <= moratoriumQuarters) {
      const interest = quarterlyInterestPaise(remaining, input.interestRate)
      remaining += interest
      schedule.push({
        quarter: q,
        dueDateLabel,
        principal: fromPaise(0),
        interest: fromPaise(interest),
        total: fromPaise(0),
        status: 'moratorium',
      })
    } else {
      break
    }
  }

  const capitalizedPrincipalPaise = remaining
  const emiPaise = annuityEmiPaise(capitalizedPrincipalPaise, input.interestRate, repaymentQuarters)
  let repayIndex = 0

  for (let q = moratoriumQuarters + 1; q <= totalQuarters; q++) {
    const due = new Date(input.startDate)
    due.setMonth(due.getMonth() + q * 3)
    const dueDateLabel = due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

    repayIndex += 1
    const interest = quarterlyInterestPaise(remaining, input.interestRate)
    const isLast = repayIndex === repaymentQuarters
    let principalPaise: number
    let totalPaise: number
    if (isLast) {
      principalPaise = remaining
      totalPaise = remaining + interest
      remaining = 0
    } else {
      totalPaise = emiPaise
      principalPaise = Math.min(Math.max(emiPaise - interest, 0), remaining)
      remaining -= principalPaise
    }
    schedule.push({
      quarter: q,
      dueDateLabel,
      principal: fromPaise(principalPaise),
      interest: fromPaise(interest),
      total: fromPaise(totalPaise),
      status: 'repayment',
    })
  }

  const firstRepay = schedule.find((s) => s.status === 'repayment')
  return {
    schemeId: input.schemeId,
    schemeName: input.schemeName,
    schemeNameKn: input.schemeNameKn,
    projectCost: fromPaise(input.projectPaise),
    loanAmount: fromPaise(input.loanPaise),
    marginRequired: fromPaise(input.marginPaise),
    interestRate: input.interestRate,
    tenureYears: input.tenureYears,
    moratoriumMonths: input.moratoriumMonths,
    quarterlyEmi: firstRepay?.total ?? 0,
    repaymentQuarters,
    schedule,
    workingCapitalHint: fromPaise(input.workingCapitalHintPaise),
    opsCostMonthly: fromPaise(input.opsCostMonthlyPaise),
    moratoriumPolicy: MORATORIUM_INTEREST_POLICY,
    closingPrincipalPaise: remaining,
    capitalizedPrincipalPaise,
  }
}

export function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}
