/**
 * Government Scheme Knowledge Base — v1 starter dataset.
 *
 * IMPORTANT: this is a MANUALLY CURATED, STATIC reference dataset, not a
 * live feed from any government system. It was assembled from publicly
 * published scheme guidelines as of each entry's `lastVerifiedDate` and can
 * go stale — official terms, caps and URLs change. Every scheme card in the
 * UI must show the source + lastVerifiedDate and tell the user to confirm
 * details with the official channel before acting on them.
 *
 * Only schemes whose names, official URLs, and eligibility structure are
 * well-documented public knowledge are included. Where a specific number
 * (e.g. an exact income ceiling) is genuinely scheme/sub-scheme dependent
 * and not safely reducible to one figure, the field is left undefined
 * rather than guessed — the eligibility engine treats "undefined" as "not
 * enough information to check this criterion", never as "no restriction
 * exists". See eligibility.ts.
 *
 * The two NSFDC entries deliberately reuse the numeric constants already
 * defined in src/lib/config.ts (NSFDC) and used by the existing, unmodified
 * /finance calculator — so this knowledge base can never drift from the
 * app's own real NSFDC math.
 */

import { NSFDC } from '../../lib/config'
import type { GovernmentScheme } from '../types'

export const KNOWLEDGE_BASE_META = {
  label: 'Maintained knowledge base (static reference data)',
  description:
    'Curated from publicly available central/state scheme guidelines. Not a live government data feed — always verify against the official source before applying.',
  lastReviewedDate: '2026-09-12',
}

export const SCHEMES: GovernmentScheme[] = [
  {
    id: 'nsfdc-micro-finance',
    name: 'NSFDC Micro Finance Scheme (MFS)',
    shortName: 'NSFDC MFS',
    description:
      'Micro-credit for small business/self-employment ventures for Scheduled Caste beneficiaries, routed through State Channelising Agencies (SCAs) or NSFDC-empanelled banks/NBFCs. This is the same NSFDC micro-finance structure this app\'s own /finance calculator uses for project costs up to the micro-project cap.',
    ministry: 'Ministry of Social Justice and Empowerment (National Scheduled Castes Finance and Development Corporation)',
    scope: 'central',
    eligibility: {
      socialCategories: ['sc'],
      maxAnnualIncome: 500_000,
      businessSectors: ['any'],
      notes:
        'Applicant must belong to a Scheduled Caste and route the application via the State Channelising Agency (SCA) in their state. Income ceiling shown here matches this app\'s existing NSFDC eligibility assumption.',
    },
    loanAmount: {
      maxRupees: NSFDC.microLoanCapRupees,
      notes: `Project cost capped at ₹${NSFDC.microProjectCapRupees.toLocaleString('en-IN')}; loan up to 90% of project cost, capped at ₹${NSFDC.microLoanCapRupees.toLocaleString('en-IN')}.`,
    },
    interest: {
      ratePercent: NSFDC.microRate,
      notes: `${NSFDC.microTenureYears}-year tenure with a ${NSFDC.microMoratoriumMonths}-month moratorium.`,
    },
    documents: [
      'Caste certificate (SC)',
      'Aadhaar card',
      'Income certificate',
      'Project report / cost estimate',
      'Bank account details',
      'Passport-size photographs',
    ],
    applicationSteps: [
      'Identify the State Channelising Agency (SCA) for NSFDC schemes in your state.',
      'Submit the loan application with the required documents to the SCA.',
      'SCA appraises the project and forwards it to NSFDC for sanction.',
      'On sanction, funds are released via the SCA / partner bank.',
    ],
    officialApplicationUrl: 'https://www.nsfdc.nic.in/',
    officialInfoUrl: 'https://www.nsfdc.nic.in/',
    source: 'NSFDC scheme guidelines',
    sourceUrl: 'https://www.nsfdc.nic.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['sc', 'scheduled caste', 'micro finance', 'small loan', 'self employment', 'nsfdc'],
  },
  {
    id: 'nsfdc-term-loan',
    name: 'NSFDC Term Loan Scheme',
    shortName: 'NSFDC Term Loan',
    description:
      'Term loan financing for larger Scheduled Caste-owned business projects, routed through State Channelising Agencies. This mirrors the "term_loan" path in this app\'s own NSFDC /finance calculator.',
    ministry: 'Ministry of Social Justice and Empowerment (National Scheduled Castes Finance and Development Corporation)',
    scope: 'central',
    eligibility: {
      socialCategories: ['sc'],
      maxAnnualIncome: 500_000,
      businessSectors: ['any'],
      notes: 'Applicant must belong to a Scheduled Caste and route the application via the SCA in their state.',
    },
    loanAmount: {
      maxRupees: NSFDC.termLoanCapRupees,
      notes: `Project cost capped at ₹${(NSFDC.termProjectCapRupees / 100000).toFixed(0)} lakh; loan up to 90% of project cost, capped at ₹${(NSFDC.termLoanCapRupees / 100000).toFixed(1)} lakh.`,
    },
    interest: {
      ratePercent: NSFDC.termRate,
      notes: `${NSFDC.termTenureYears}-year tenure with a ${NSFDC.termMoratoriumMonths}-month moratorium.`,
    },
    documents: [
      'Caste certificate (SC)',
      'Aadhaar card',
      'Income certificate',
      'Detailed project report',
      'Bank account details',
      'Collateral / guarantor details as required by the channel partner',
    ],
    applicationSteps: [
      'Identify the State Channelising Agency (SCA) for NSFDC schemes in your state.',
      'Submit the loan application with a detailed project report to the SCA.',
      'SCA appraises and forwards the case to NSFDC for sanction.',
      'On sanction, funds are released via the SCA / partner bank in tranches.',
    ],
    officialApplicationUrl: 'https://www.nsfdc.nic.in/',
    officialInfoUrl: 'https://www.nsfdc.nic.in/',
    source: 'NSFDC scheme guidelines',
    sourceUrl: 'https://www.nsfdc.nic.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['sc', 'scheduled caste', 'term loan', 'nsfdc', 'business loan'],
  },
  {
    id: 'pmegp',
    name: 'Prime Minister\'s Employment Generation Programme (PMEGP)',
    shortName: 'PMEGP',
    description:
      'Credit-linked subsidy scheme for setting up new micro-enterprises in the manufacturing or service sector, implemented by KVIC, KVIBs and District Industries Centres.',
    ministry: 'Ministry of Micro, Small and Medium Enterprises (via KVIC)',
    scope: 'central',
    eligibility: {
      minAge: 18,
      businessSectors: ['any'],
      excludedBusinessSectors: ['poultry', 'meat_processing', 'liquor', 'tobacco'],
      businessStages: ['idea', 'new'],
      minEducationNote:
        'At least Class VIII pass required for projects above ₹10 lakh (manufacturing) or ₹5 lakh (service).',
      notes:
        'For a new unit only — an existing/already-operating unit is generally not eligible for PMEGP margin-money subsidy on that unit. PMEGP\'s standard negative list excludes meat/poultry-farming, liquor and tobacco-based activities.',
    },
    loanAmount: {
      maxRupees: 5_000_000,
      notes:
        'Project cost up to ₹50 lakh for manufacturing units and ₹20 lakh for service-sector units (bank term loan + working capital).',
    },
    subsidy: {
      description:
        'Margin money subsidy of 15–35% of the project cost, higher for rural areas and for special categories (SC/ST/OBC/women/ex-servicemen/PwD/NER/border areas).',
      ratePercentMin: 15,
      ratePercentMax: 35,
    },
    documents: [
      'Aadhaar card',
      'Project report / detailed project report (DPR)',
      'Education qualification proof',
      'Caste/category certificate, if applicable',
      'Passport-size photographs',
      'Bank account details',
    ],
    applicationSteps: [
      'Register and apply online on the PMEGP e-portal (KVIC).',
      'Select the implementing agency (KVIC / KVIB / DIC) for your area.',
      'Attend the interview/selection process at the district level task force committee.',
      'Complete the mandatory Entrepreneurship Development Programme (EDP) training.',
      'On approval, the bank releases the loan and the margin-money subsidy is credited after the EDP.',
    ],
    officialApplicationUrl: 'https://www.kviconline.gov.in/pmegp/',
    officialInfoUrl: 'https://www.kviconline.gov.in/pmegp/',
    source: 'KVIC PMEGP guidelines',
    sourceUrl: 'https://www.kviconline.gov.in/pmegp/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['pmegp', 'kvic', 'new business', 'manufacturing', 'service enterprise', 'subsidy'],
  },
  {
    id: 'pm-mudra-yojana',
    name: 'Pradhan Mantri Mudra Yojana (PMMY)',
    shortName: 'Mudra Yojana',
    description:
      'Collateral-free institutional credit up to ₹20 lakh for non-farm income-generating micro/small enterprises in manufacturing, trading, services, and activities allied to agriculture (e.g. poultry, dairy, beekeeping). Loans are categorised as Shishu, Kishor, Tarun and Tarun Plus by ticket size.',
    ministry: 'Ministry of Finance (Micro Units Development & Refinance Agency Ltd.)',
    scope: 'central',
    eligibility: {
      businessSectors: ['any'],
      businessStages: ['idea', 'new', 'existing_expansion'],
      notes:
        'No caste, income or gender restriction is prescribed by MUDRA itself, though the lending bank/NBFC applies its own standard credit appraisal. Explicitly covers activities allied to agriculture such as poultry, dairy and beekeeping, in addition to manufacturing, trading and services.',
    },
    loanAmount: {
      minRupees: 0,
      maxRupees: 2_000_000,
      notes:
        'Shishu: up to ₹50,000. Kishor: ₹50,001–₹5 lakh. Tarun: ₹5,00,001–₹10 lakh. Tarun Plus (for prior Tarun borrowers with a good repayment record): up to ₹20 lakh.',
    },
    documents: [
      'Aadhaar card',
      'Business plan / project proposal',
      'Proof of business existence, if already operating',
      'Bank account details',
      'Passport-size photographs',
    ],
    applicationSteps: [
      'Approach a participating bank, NBFC, MFI or apply online via the Udyamimitra/Jan Samarth portal.',
      'Submit the Mudra loan application form with the project proposal.',
      'Bank appraises the proposal under Shishu/Kishor/Tarun/Tarun Plus as applicable.',
      'On sanction, the loan is disbursed along with a Mudra Card for working capital drawdown.',
    ],
    officialApplicationUrl: 'https://www.jansamarth.in/',
    officialInfoUrl: 'https://www.mudra.org.in/',
    source: 'MUDRA (Ministry of Finance) scheme guidelines',
    sourceUrl: 'https://www.mudra.org.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: [
      'mudra',
      'shishu',
      'kishor',
      'tarun',
      'collateral free loan',
      'poultry',
      'dairy',
      'small business',
      'expansion',
    ],
  },
  {
    id: 'stand-up-india',
    name: 'Stand-Up India',
    shortName: 'Stand-Up India',
    description:
      'Bank loans of ₹10 lakh to ₹1 crore for setting up a new (greenfield) enterprise in manufacturing, services, trading or activities allied to agriculture, for at least one Scheduled Caste/Scheduled Tribe borrower or one woman borrower per bank branch.',
    ministry: 'Department of Financial Services, Ministry of Finance',
    scope: 'central',
    eligibility: {
      minAge: 18,
      businessSectors: ['any'],
      businessStages: ['idea', 'new'],
      requiresGreenfield: true,
      eligibleIfAny: [{ socialCategories: ['sc', 'st'] }, { genders: ['female'] }],
      notes:
        'Meant for a first-time (greenfield) enterprise, not for expanding an existing business. Eligible if the applicant is SC, ST, or a woman.',
    },
    loanAmount: {
      minRupees: 1_000_000,
      maxRupees: 100_000_000,
      notes: 'Composite loan (term loan + working capital) between ₹10 lakh and ₹1 crore.',
    },
    documents: [
      'Aadhaar card',
      'Caste certificate, if applying under SC/ST category',
      'Detailed project report / business plan',
      'Identity and address proof',
      'Bank account details',
    ],
    applicationSteps: [
      'Apply online via the Stand-Up India portal or approach a scheduled commercial bank branch directly.',
      'Submit the project report and required documents for appraisal.',
      'Bank appraises the greenfield project for viability and sanctions the composite loan.',
      'Handholding support is available through the Stand-Up India portal\'s support agencies.',
    ],
    officialApplicationUrl: 'https://www.standupmitra.in/',
    officialInfoUrl: 'https://www.standupmitra.in/',
    source: 'Stand-Up India scheme guidelines',
    sourceUrl: 'https://www.standupmitra.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['stand up india', 'sc', 'st', 'women entrepreneur', 'greenfield', 'new enterprise', 'bank loan'],
  },
  {
    id: 'pm-vishwakarma',
    name: 'PM Vishwakarma',
    shortName: 'PM Vishwakarma',
    description:
      'Support for artisans and craftspeople working with their hands and tools in one of 18 family-based traditional trades (including carpenters, boat makers, blacksmiths, locksmiths, goldsmiths, potters, sculptors, cobblers, masons, basket/mat/broom makers, toy makers, barbers, garland makers, washermen, tailors and fishing net makers), covering recognition, skill training, a toolkit incentive, and collateral-free credit. Implemented for five years up to 2027-28.',
    ministry: 'Ministry of Micro, Small and Medium Enterprises',
    scope: 'central',
    eligibility: {
      minAge: 18,
      businessSectors: [
        'tailoring',
        'carpentry',
        'blacksmithing',
        'pottery',
        'handicraft',
        'metal_tools',
        'goldsmith',
        'stonework',
        'cobbler_footwear',
        'masonry',
        'barber',
        'garland_making',
        'washerman',
        'boat_making',
        'fishing_net_making',
      ],
      notes:
        'Guidelines v30.0, para 4: "An artisan or craftsperson working with hands and tools and engaged in one of the family-based traditional trades specified in Para 2.3, in the unorganized or informal sector, on self-employment basis". Minimum age 18 on the date of registration, and engaged in the trade on that date. Prior loans (para 4(ii)): "should not have availed loans under similar credit-based schemes of Central Government or State Government for self-employment/ business development, e.g. PMEGP, PM SVANidhi, MUDRA, in the past 5 years. However, the beneficiaries of MUDRA and SVANidhi who have fully repaid their loan, will be eligible under PM Vishwakarma. This period of 5 years will be calculated from the date of sanction of the loan." The official FAQ is stricter on PMEGP: "A person who has availed PMEGP loan cannot apply for PM Vishwakarma." Registration and benefits are restricted to one member of the family (husband, wife and unmarried children), and a person in government service and his/her family members are not eligible.',
    },
    loanAmount: {
      maxRupees: 300_000,
      notes:
        'Collateral-free Enterprise Development Loan in two tranches: first tranche up to ₹1,00,000 (18-month repayment), available after completing 5–7 days of Basic Training; second tranche up to ₹2,00,000 (30-month repayment). The second tranche is only for beneficiaries who availed the first tranche, maintained a standard loan account, and have adopted digital transactions in their business or undergone Advanced Training; the first tranche must be fully repaid, and the second loan is not granted before six months from disbursement of the first.',
    },
    interest: {
      ratePercent: 5,
      notes:
        'Fixed concessional rate of 5% charged to the beneficiary, for both tranches; the Ministry of MSME passes interest subvention of up to 8% upfront to the lending bank.',
    },
    subsidy: {
      description:
        'Toolkit incentive of up to ₹15,000 through e-RUPI/e-vouchers, for buying improved tools from designated centres, after Skill Assessment. A training stipend of ₹500 per day is paid during Basic and Advanced Training.',
    },
    documents: [
      'Aadhaar card (all registrations are Aadhaar-based with biometric authentication)',
      'Mobile number',
      'Aadhaar-seeded bank account details',
      'Ration card — or, without one, the Aadhaar numbers of all family members',
    ],
    applicationSteps: [
      'Enrol free of cost through your nearest Common Service Centre (CSC), or apply online on the PM Vishwakarma portal with Aadhaar biometric authentication.',
      'Three-step verification: the Gram Panchayat / Urban Local Body head, then the District Implementation Committee, then approval by the Screening Committee.',
      'On registration, receive the PM Vishwakarma Certificate and ID Card.',
      'Complete Skill Assessment and 5–7 days of Basic Training (₹500/day stipend), which unlocks the toolkit incentive and the first loan tranche; Advanced Training (15 days) is optional.',
    ],
    officialApplicationUrl: 'https://pmvishwakarma.gov.in/',
    officialInfoUrl: 'https://pmvishwakarma.gov.in/Home/FAQ',
    source: 'PM Vishwakarma Guidelines v30.0 (Ministry of MSME) and the official PM Vishwakarma FAQ',
    sourceUrl: 'https://pmvishwakarma.gov.in/cdn/MiscFiles/eng_v30.0_PM_Vishwakarma_Guidelines_final.pdf',
    lastVerifiedDate: '2026-09-30',
    confidence: 'reference',
    tags: ['pm vishwakarma', 'artisan', 'craftsperson', 'tailor', 'darzi', 'toolkit', 'traditional trade'],
  },
  {
    id: 'nbcfdc-term-loan',
    name: 'NBCFDC Term Loan Scheme',
    shortName: 'NBCFDC Term Loan',
    description:
      'Concessional term-loan finance for income-generating self-employment ventures for Other Backward Classes (OBC) and Economically Backward Classes (EBC) beneficiaries, routed through State Channelising Agencies.',
    ministry: 'Ministry of Social Justice and Empowerment (National Backward Classes Finance and Development Corporation)',
    scope: 'central',
    eligibility: {
      socialCategories: ['obc'],
      businessSectors: ['any'],
      notes:
        'Exact income ceiling and loan slab depend on the specific NBCFDC scheme variant and are set by the State Channelising Agency (SCA) — confirm current limits with your state SCA before applying. Not modelled here as a fixed number to avoid overstating precision.',
    },
    loanAmount: {
      notes:
        'Ticket size varies by scheme variant and SCA; typically small/medium-ticket term loans for self-employment. Confirm the current slab with your SCA.',
    },
    documents: [
      'OBC / EBC caste certificate',
      'Income certificate',
      'Aadhaar card',
      'Project report / cost estimate',
      'Bank account details',
    ],
    applicationSteps: [
      'Identify the State Channelising Agency (SCA) for NBCFDC schemes in your state.',
      'Submit the loan application with required documents to the SCA.',
      'SCA appraises and forwards the case to NBCFDC for sanction.',
      'On sanction, funds are released via the SCA / partner bank.',
    ],
    officialApplicationUrl: 'https://www.nbcfdc.gov.in/',
    officialInfoUrl: 'https://www.nbcfdc.gov.in/',
    source: 'NBCFDC scheme guidelines',
    sourceUrl: 'https://www.nbcfdc.gov.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['obc', 'backward classes', 'nbcfdc', 'term loan', 'self employment'],
  },
  {
    id: 'kudumbashree-microenterprise',
    name: 'Kudumbashree Microenterprise Support',
    shortName: 'Kudumbashree',
    description:
      'Kerala\'s State Poverty Eradication Mission supports women, organised into Neighbourhood Groups (NHGs), to set up and run individual or group microenterprises — including common categories such as tailoring units, food units and retail — with training, subsidy linkage and bank credit facilitation.',
    ministry: 'Government of Kerala (Kudumbashree — State Poverty Eradication Mission)',
    scope: 'state',
    state: 'Kerala',
    eligibility: {
      states: ['Kerala'],
      genders: ['female'],
      businessSectors: ['any'],
      notes:
        'Open to women in Kerala, typically through membership in a Kudumbashree Neighbourhood Group (NHG); both rural and urban units operate. Exact subsidy/loan amount depends on the specific microenterprise scheme routed through Kudumbashree at the time of application.',
    },
    loanAmount: {
      notes: 'Varies by the specific microenterprise/bank-linkage scheme in effect — confirm current terms with your local Kudumbashree unit.',
    },
    documents: [
      'Kudumbashree NHG membership details',
      'Aadhaar card',
      'Ration card / local resident proof',
      'Business plan for the proposed microenterprise',
      'Bank account details',
    ],
    applicationSteps: [
      'Join or confirm membership in a local Kudumbashree Neighbourhood Group (NHG).',
      'Discuss the microenterprise idea with the NHG/Area Development Society for endorsement.',
      'Apply for the relevant microenterprise/bank-linkage support through the Community Development Society (CDS).',
      'Complete any required training, then proceed to bank loan sanction and unit setup.',
    ],
    officialApplicationUrl: 'https://www.kudumbashree.org/',
    officialInfoUrl: 'https://www.kudumbashree.org/',
    source: 'Kudumbashree (Government of Kerala) programme information',
    sourceUrl: 'https://www.kudumbashree.org/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['kudumbashree', 'kerala', 'women entrepreneur', 'tailoring', 'microenterprise', 'nhg'],
  },
  {
    id: 'pmmsy',
    name: 'Pradhan Mantri Matsya Sampada Yojana (PMMSY)',
    shortName: 'PMMSY',
    description:
      'Fisheries-sector scheme of the Department of Fisheries for fishers, fish farmers, fish workers and fish vendors, among others. For beneficiary-oriented individual activities, government financial assistance covers 40% of the project/unit cost for General category and 60% for SC/ST/Women; the beneficiary meets the rest from own funds or institutional finance such as a bank loan. Implemented through the States/UTs, which share the assistance with the Centre (60:40 in most States; 90:10 in North Eastern and Himalayan States; fully central in Union Territories).',
    ministry: 'Ministry of Fisheries, Animal Husbandry and Dairying (Department of Fisheries)',
    scope: 'central',
    eligibility: {
      businessSectors: ['fisheries'],
      notes:
        'Operational Guidelines (June 2020), para 8.1: intended beneficiaries include "Fishers", "Fish farmers", "Fish workers and Fish vendors" and "SCs/STs/Women/Differently abled persons" — as well as SHGs, cooperatives and fish farmer producer organisations, which this app does not match. No scheme-wide minimum age or education is set; individual sub-components can add their own conditions (e.g. livelihood and nutritional support for fishers requires a full-time active fisher who is a member of a fishers\' cooperative, Below Poverty Line and aged 18–60). Para 21.1: applicants must obtain "necessary statutory clearances, permits and licenses, whatsoever and wherever required"; activities needing land require documentary evidence of own or registered-lease land. These guidelines name no specific fishing permit or fisheries registration, and a later revision order could not be retrieved — confirm current document requirements with your district fisheries office. Scheme period: approved for FY 2020-21 to 2024-25 and extended up to FY 2025-26 (PIB, September 2025); the Union Budget 2026-27 allocates ₹2,500 crore to PMMSY (PIB, 6 April 2026).',
    },
    subsidy: {
      description:
        'Government financial assistance of 40% of the project/unit cost for General category and 60% for SC/ST/Women (Operational Guidelines para 5.2.2). No single project-cost ceiling: the Department fixes the unit cost and any upper ceiling per activity (para 9.8).',
      ratePercentMin: 40,
      ratePercentMax: 60,
      applicantTiers: {
        higherRatePercent: 60,
        higherRateFor: { socialCategories: ['sc', 'st'], genders: ['female'] },
        higherRateLabel: 'SC/ST/Women',
        standardRatePercent: 40,
        standardRateLabel: 'General category',
        rateOf: 'project/unit cost',
      },
    },
    documents: [
      "Project proposal for the activity (the guidelines' Detailed Project Report or Self Contained Proposal; preparation costs count toward the unit cost)",
      'Documentary evidence of own or registered-lease land, where the activity needs land',
      'Statutory clearances, permits and licences, wherever the activity requires them',
    ],
    applicationSteps: [
      'Apply through your State/UT Fisheries Department at district level: beneficiary-oriented activities are implemented by the States/UTs under an Annual District Fisheries Plan.',
      'Beneficiaries for individual activities are approved by the District Level Committee, normally headed by the District Collector.',
      'Obtain any statutory clearances, permits and licences the activity needs; their cost is met by the applicant (para 21.1).',
      'Meet your share of the project cost from own funds or a bank loan; the district committee helps with linkages to banks and financial institutions.',
    ],
    officialApplicationUrl: 'https://pmmsy.dof.gov.in/',
    officialInfoUrl: 'https://pmmsy.dof.gov.in/',
    source:
      'PMMSY Operational Guidelines (Department of Fisheries, June 2020) and PIB releases of September 2025 and 6 April 2026',
    sourceUrl: 'https://www.dof.gov.in/static/uploads/2025/08/89f0158000ddb527f339428aef82a676.pdf',
    lastVerifiedDate: '2026-09-30',
    confidence: 'reference',
    tags: ['pmmsy', 'matsya sampada', 'fisheries', 'fish farming', 'aquaculture', 'fish vendor', 'blue revolution'],
  },
  {
    id: 'udyogini',
    name: 'Udyogini Scheme',
    shortName: 'Udyogini',
    description:
      'Karnataka State Women\'s Development Corporation (KSWDC) scheme helping women set up an income-generating activity through a bank loan carrying a government subsidy, plus EDP training.',
    ministry: 'Government of Karnataka (Karnataka State Women\'s Development Corporation — KSWDC)',
    scope: 'state',
    state: 'Karnataka',
    eligibility: {
      states: ['Karnataka'],
      genders: ['female'],
      minAge: 18,
      maxAge: 55,
      businessSectors: ['any'],
      notes:
        'KSWDC\'s own scheme page (primary source, verified) states: "Age limit 18 to 55 Years", "Permanent resident of Karnataka", and an annual family income limit of "below Rs.1.50 lakhs" for General/Special category applicants and "below Rs.2.00 lakhs" for SC/ST category applicants. This income ceiling is deliberately NOT encoded as a single maxAnnualIncome figure here — it genuinely differs by category and this engine has no category-conditional income field — so check your own category\'s ceiling against your income before applying. Secondary sources disagreeing on whether an income ceiling applies at all, or citing a flat ₹2,00,000 for everyone, are not supported by KSWDC\'s own page, which clearly states two different category-specific ceilings.',
    },
    loanAmount: {
      minRupees: 100_000,
      maxRupees: 300_000,
      notes:
        'KSWDC: "can avail a loan from Rs.1.00 Lakhs to Rs.3.00 Lakhs from banks". The ₹90,000 (General/Special) and ₹1,50,000 (SC/ST) figures sometimes quoted as maximum subsidy caps are this app\'s own arithmetic — 30%/50% of the ₹3,00,000 maximum loan — not a separate rupee cap KSWDC\'s page itself states; KSWDC states only the percentage and the loan range.',
    },
    subsidy: {
      description:
        'KSWDC: "subsidy of 30% is provided to General and Special category women and Subsidy of 50% is provided to SC / ST category women" (percentage of the bank loan, not independently capped in rupees on KSWDC\'s page).',
      ratePercentMin: 30,
      ratePercentMax: 50,
      applicantTiers: {
        higherRatePercent: 50,
        higherRateFor: { socialCategories: ['sc', 'st'] },
        higherRateLabel: 'SC/ST category women',
        standardRatePercent: 30,
        standardRateLabel: 'General/Special category women',
        rateOf: 'bank loan amount',
      },
    },
    documents: [
      'Aadhaar card',
      'Residential certificate / Voter ID / Ration Card',
      'Project report for the proposed activity',
      'Aadhaar-seeded bank account (mandatory)',
      'Income and caste certificate from the Tahsildar',
    ],
    applicationSteps: [
      'Download the application form from kswdc.karnataka.gov.in, or collect it from the Deputy Director / Child Development Project Officer (CDPO) office in your district.',
      'Complete the form and attach the required documents.',
      'Submit it to the nearest participating bank branch or Karnataka State Finance Corporation (KSFC) office.',
      'On sanction, complete the 3–6 day EDP training before the loan is released.',
    ],
    officialApplicationUrl: 'https://kswdc.karnataka.gov.in/21/udyogini/en',
    officialInfoUrl: 'https://kswdc.karnataka.gov.in/21/udyogini/en',
    source: 'Karnataka State Women\'s Development Corporation (KSWDC) — official Udyogini scheme page',
    sourceUrl: 'https://kswdc.karnataka.gov.in/21/udyogini/en',
    lastVerifiedDate: '2026-10-18',
    confidence: 'reference',
    tags: ['udyogini', 'karnataka', 'women entrepreneur', 'kswdc', 'self employment', 'collateral free loan'],
  },
  {
    id: 'needs-tn',
    name: 'New Entrepreneur-cum-Enterprise Development Scheme (NEEDS)',
    shortName: 'NEEDS',
    description:
      'Tamil Nadu term-loan and capital-subsidy scheme to help educated first-generation entrepreneurs set up a new manufacturing or service enterprise, financed through TIIC, SIDBI, TAICO or commercial banks and administered by the Tamil Nadu MSME Department under G.O.Ms.No.49, MSME (D2) Department, dated 29.10.2012.',
    ministry: 'Government of Tamil Nadu, MSME Department (financed through TIIC / SIDBI / TAICO / commercial banks)',
    scope: 'state',
    state: 'Tamil Nadu',
    eligibility: {
      states: ['Tamil Nadu'],
      minAge: 21,
      maxAge: 45,
      businessSectors: ['any'],
      businessStages: ['idea', 'new'],
      minEducationNote: 'Degree / Diploma / ITI / Vocational Training from a recognized institution (Tamil Nadu MSME Dept eligibility PDF).',
      notes:
        'PRIMARY-SOURCE CONFLICT, flagged rather than silently resolved: ' +
        'the Tamil Nadu MSME Department\'s own portal (msmeonline.tn.gov.in/needs, "Check your Eligibility" and FAQ PDFs, both citing G.O.Ms.No.49 dated 29.10.2012 — the scheme-owning department) states the age limit as "21 to 35 years maximum" for General category and up to "45 years" for Special category (Women, Transgender, BC, MBC, SC/ST, Minority, Ex-servicemen, Physically Challenged). TIIC\'s own scheme page (tiic.org/need-scheme/, one of the financing banks, not the scheme owner) instead states "21-45 years under General category and 21-55 years under special category". This app encodes the wider of the two Special-category caps (45, from the MSME Department) as the hard age gate so a Special-category applicant eligible under the authoritative government source is never wrongly told they don\'t match. General category age limit is 35; the wider 45 limit shown here applies only to Special categories (SC/ST/BC/MBC/Minority/Women/Ex-servicemen/Transgender/Differently-abled). A General-category applicant should use the stricter 21–35 cap to self-check, since the General-category ceiling under the MSME Department\'s own page is lower than the 45 used here. ' +
        'NOT hard-gated by this app\'s eligibility engine (disclosed here only, following the same precedent as PM Vishwakarma\'s prior-loan exclusion): (1) the applicant must be a genuine FIRST-GENERATION entrepreneur proposing their first-ever, brand-new project — the MSME Dept FAQ states plainly "No, only new unit being promoted by new First Generation Entrepreneur is eligible for assistance" and "Business enterprises are ineligible under this scheme"; (2) minimum project cost — the MSME Department\'s own eligibility PDF states a project cost range of "Rs.5 lakhs to Rs.1 crore" (capped at ₹1 crore for subsidy computation if the actual cost is higher), which conflicts with TIIC\'s page, which states "Minimum Project Cost: Rs.10.00 lakhs, Maximum project cost: Rs.500.00 lakhs" — a second unresolved primary-source conflict on the minimum/maximum themselves. Citizens must confirm their own project cost against the official NEEDS guidelines before relying on either figure. ' +
        'Also note: TIIC states "resident of Tamil Nadu State for not less than 3 years" (not separately modelled — this app only checks current state, not duration of residence) and the MSME Dept FAQ states there is "no family income ceiling" for NEEDS.',
    },
    loanAmount: {
      minRupees: 500_000,
      maxRupees: 10_000_000,
      notes:
        'Tamil Nadu MSME Department eligibility PDF (G.O.Ms.No.49): project cost "Rs.5 lakhs to Rs.1 crore" (₹1 crore cap applied for subsidy computation above that). TIIC\'s own page instead states "Rs.10.00 lakhs" minimum and "Rs.500.00 lakhs" maximum — a direct conflict with the Department\'s figures that this app could not resolve from the primary sources alone; see eligibility notes. Funded as a term loan (promoter contribution 10% general / 5% special category, debt-equity 9:1 / 19:1, repayment 9 years including a 2-year holiday — TIIC).',
    },
    subsidy: {
      description:
        'Tamil Nadu MSME Department FAQ (citing G.O.Ms.No.49): "25% of the eligible components of the project cost subject to maximum amount of Rs.25.00 lakhs" (cost of land, building and plant & machinery; building cost capped at 25% of project cost). Paid front-ended in instalments tied to loan disbursement and verified capital expenditure. TIIC\'s own scheme page does not mention any subsidy percentage or cap at all — secondary sources quoting ₹75 lakh or 25% of up to ₹500 lakh project cost are not supported by either primary source checked.',
      ratePercentMin: 25,
      ratePercentMax: 25,
    },
    interest: {
      notes:
        'Tamil Nadu MSME Dept FAQ: "Enterprises financed by TIIC/Banks will be charged at the rate of interest applicable to Micro & Small enterprises as per banking norms" (no fixed figure stated by the Department). TIIC\'s own page separately states "PLR + 0.25% pa" for enterprises it finances directly — sourced to TIIC specifically, not corroborated by the Department\'s own pages.',
    },
    documents: [
      'Proof of educational qualification (Degree / Diploma / ITI / Vocational Training)',
      'Proof of Tamil Nadu residency (3+ years)',
      'Detailed project report / business plan for a new, first-ever enterprise',
      'Aadhaar card and identity/address proof',
      'Bank account details',
    ],
    applicationSteps: [
      'Apply online through msmeonline.tn.gov.in (the Tamil Nadu MSME Department\'s NEEDS portal).',
      'Complete the mandatory one-month Entrepreneurship Development Programme (EDP) training (exemption available if an equivalent EDP was already completed).',
      'On eligibility clearance, tie up with a participating bank, TIIC, SIDBI or TAICO for the term loan.',
      'Deposit your own contribution, have the bank sanction and disburse the loan, then claim the front-ended capital subsidy in instalments as capital expenditure is verified.',
    ],
    officialApplicationUrl: 'https://msmeonline.tn.gov.in/needs/index.php',
    officialInfoUrl: 'https://www.tiic.org/need-scheme/',
    source:
      'Tamil Nadu MSME Department — official NEEDS eligibility and FAQ PDFs (msmeonline.tn.gov.in/needs, citing G.O.Ms.No.49 dated 29.10.2012), cross-checked against TIIC\'s own NEED Scheme page (tiic.org/need-scheme/)',
    sourceUrl: 'https://msmeonline.tn.gov.in/needs/pdf/check_your_eligibility.pdf',
    lastVerifiedDate: '2026-10-18',
    confidence: 'reference',
    tags: ['needs', 'tamil nadu', 'tiic', 'first generation entrepreneur', 'new enterprise', 'capital subsidy'],
  },
  {
    id: 'kmdc-self-employment',
    name: 'KMDC Self-Employment Scheme',
    shortName: 'KMDC Self-Employment',
    description:
      'Karnataka Minorities Development Corporation (KMDC) scheme for members of Karnataka\'s State Religious Minority Community: a bank loan plus a Corporation subsidy, via Nationalized/Scheduled banks, to start or improve a small-scale handicraft industry, service-sector activity or agro-based activity.',
    ministry: 'Government of Karnataka, Minority Welfare, Hajj and Waqf Department (Karnataka Minorities Development Corporation Limited — KMDC)',
    scope: 'state',
    state: 'Karnataka',
    eligibility: {
      states: ['Karnataka'],
      minAge: 18,
      maxAge: 55,
      maxAnnualIncome: 600_000,
      businessSectors: ['any'],
      notes:
        'KMDC\'s own scheme page (primary source, verified against the raw page text) lists eligibility as: "(A) Applicants must belong to the State Religious Minority Community. (B) The applicant must be a permanent resident of the State. (E) The age limit of the applicant is between 18 to 55 years. (E) Family income from all sources should not exceed Rs.6.00 lakh. (G) No member of the applicant\'s family shall be an employee of the State/Central/ Government PSU. (H) Applicants should not have availed a loan in KMDC earlier." ' +
        'RELIGIOUS-MINORITY STATUS IS THIS SCHEME\'S CORE ELIGIBILITY GATE, BUT IT IS NOT HARD-GATED HERE: this app\'s profile schema has no religion/minority field at all (SocialCategory is limited to sc/st/obc/general, and UserProfile has no religion field), so this engine cannot check it. A likely_eligible/possibly_eligible result from this app does NOT mean minority status has been confirmed — only that state, age and income passed. The no-government/PSU-household-member condition and the no-prior-KMDC-loan condition are, likewise, disclosed here only and not hard-gated, following the same precedent as PM Vishwakarma\'s prior-loan exclusion.',
    },
    loanAmount: {
      notes:
        'KMDC: loans and subsidy are provided "with the help of Nationalized / Scheduled banks" — the page states the subsidy rate/cap (see subsidy below) but no fixed loan amount or unit-cost ceiling, so none is modelled here.',
    },
    subsidy: {
      description:
        'KMDC: "33% of the unit cost or maximum of Rs. 1.00 Lakh will be given as a subsidy," with the remaining unit cost funded as a bank loan from a Nationalized/Scheduled bank at that bank\'s own rate (no fixed rate stated by KMDC).',
      ratePercentMin: 33,
      ratePercentMax: 33,
    },
    documents: [
      'Online application',
      'Two latest passport-size photographs',
      'Caste and income certificate',
      'Copy of Aadhaar card',
      'Project report of the proposed industry/activity',
    ],
    applicationSteps: [
      'Submit the online application through KMDC\'s portal with the required documents.',
      'The application is reviewed by the Taluk-level Selection Panel: the local MLA (Chairman), an MLC resident in that Taluk (Vice-Chairman), the Tahsildar, the Taluk Panchayat Executive Officer, the District Lead Bank Manager, the District Joint Director of Commerce & Industry and the District Deputy Director of Women & Child Welfare (Members), with the District KMDC Manager as Member Secretary.',
      'On selection, a Nationalized/Scheduled bank sanctions the loan; KMDC releases its subsidy against the sanctioned loan.',
    ],
    officialApplicationUrl: 'https://kmdc.karnataka.gov.in/29/self-employment-scheme/en',
    officialInfoUrl: 'https://kmdc.karnataka.gov.in/29/self-employment-scheme/en',
    source: 'Karnataka Minorities Development Corporation (KMDC) — official Self-Employment Scheme page',
    sourceUrl: 'https://kmdc.karnataka.gov.in/29/self-employment-scheme/en',
    lastVerifiedDate: '2026-10-19',
    confidence: 'reference',
    tags: ['kmdc', 'karnataka', 'religious minority', 'minority welfare', 'self employment', 'handicraft', 'agro-based'],
  },
  {
    id: 'kmvstdcl-self-employment-direct-loan',
    name: 'KMVSTDCL Self Employment Direct Loan Scheme',
    shortName: 'KMVSTDCL Direct Loan',
    description:
      'Karnataka Maharshi Valmiki Scheduled Tribes Development Corporation (KMVSTDCL) scheme giving Scheduled Tribe beneficiaries ₹1,00,000 in combined subsidy and bank loan to take up Dairy Farming in a rural area, or a small urban trade such as a petty shop, readymade-garments shop, sheep/goat rearing, fishery, fruit-and-vegetable vending or tailoring.',
    ministry: 'Government of Karnataka (Karnataka Maharshi Valmiki Scheduled Tribes Development Corporation Limited — KMVSTDCL)',
    scope: 'state',
    state: 'Karnataka',
    eligibility: {
      states: ['Karnataka'],
      socialCategories: ['st'],
      businessSectors: ['any'],
      notes:
        'KMVSTDCL\'s own Self Employment Program page (primary source, verified against the raw page text), scheme (a), "Self Employment Direct Loan Scheme (1.0 Lakh Subsidy)": half the scheme\'s target is for Scheduled Tribe beneficiaries taking up Dairy Farming in rural areas, the other half for small urban business activities (petty shop, readymade garments shop, sheep and goat rearing, fishery, fruits and vegetable shop, tailoring, etc.) — both funded through the same ₹1,00,000 (₹50,000 subsidy + ₹50,000 loan) assistance structure. ' +
        'This is a DIFFERENT scheme from KMVSTDCL\'s separate dairy-animal-purchase subsidy (a 2025-26 Budget-Speech-announced ₹1.25 lakh subsidy specifically for buying two buffaloes/cows) — that one is deliberately NOT catalogued here, as it is a pure agricultural-input subsidy, not microenterprise capital. ' +
        'The page states no separate age or income ceiling for this scheme beyond Scheduled Tribe status and (implicitly) Karnataka residency.',
    },
    loanAmount: {
      minRupees: 100_000,
      maxRupees: 100_000,
      notes: 'KMVSTDCL: "financial assistance of Rs.1,00,000/- to each beneficiary... includes subsidy of Rs.50,000/- and Loan of Rs.50,000/-."',
    },
    subsidy: {
      description:
        'KMVSTDCL: a flat ₹50,000 subsidy component of the ₹1,00,000 total assistance (the remaining ₹50,000 is a bank loan). The page states this as a flat rupee split, not as a percentage of unit cost.',
    },
    documents: [
      'Aadhaar card',
      'Scheduled Tribe community/caste certificate',
      'Proof of Karnataka residency',
      'Project report or activity proposal (Dairy Farming or the chosen urban trade)',
      'Bank account details',
    ],
    applicationSteps: [
      'Apply at your district/taluk KMVSTDCL office (or the Corporation\'s online portal) with the required documents.',
      'KMVSTDCL verifies Scheduled Tribe status and the proposed activity.',
      'On approval, a bank sanctions the ₹50,000 loan portion; KMVSTDCL releases its ₹50,000 subsidy against it.',
    ],
    officialApplicationUrl: 'https://kmvstdcl.karnataka.gov.in/info-2/Self+Employment+Program/en',
    officialInfoUrl: 'https://kmvstdcl.karnataka.gov.in/info-2/Self+Employment+Program/en',
    source: 'Karnataka Maharshi Valmiki Scheduled Tribes Development Corporation (KMVSTDCL) — official Self Employment Program page',
    sourceUrl: 'https://kmvstdcl.karnataka.gov.in/info-2/Self+Employment+Program/en',
    lastVerifiedDate: '2026-10-19',
    confidence: 'reference',
    tags: ['kmvstdcl', 'karnataka', 'scheduled tribe', 'st', 'self employment', 'direct loan', 'dairy farming'],
  },
  {
    id: 'kmvstdcl-women-industries-services-business',
    name: 'KMVSTDCL Industries, Services and Business Scheme (Women)',
    shortName: 'KMVSTDCL Women ISB',
    description:
      'KMVSTDCL scheme for Scheduled Tribe women to start a self-employment unit in small business, small industry or the service sector, combining a Corporation subsidy with a bank loan.',
    ministry: 'Government of Karnataka (Karnataka Maharshi Valmiki Scheduled Tribes Development Corporation Limited — KMVSTDCL)',
    scope: 'state',
    state: 'Karnataka',
    eligibility: {
      states: ['Karnataka'],
      socialCategories: ['st'],
      genders: ['female'],
      businessSectors: ['any'],
      notes:
        'KMVSTDCL\'s own Self Employment Program page (primary source, verified against the raw page text), scheme (b), "Industries, Services, and Business (2.0 Lakhs subsidy)": "the Scheduled Tribe women will be provided with subsidy from the Corporation and bank loan facility to start self-employment units in small business, small industry and service sectors. 70% of the unit cost or a maximum of Rs.2.00 lakhs will be subsidy and the remaining amount will be bank loan." This requires BOTH Scheduled Tribe status AND being a woman — not an either/or condition like Stand-Up India\'s SC/ST-or-woman gate. The page states no separate age or income ceiling for this scheme beyond those two conditions and (implicitly) Karnataka residency.',
    },
    subsidy: {
      description:
        'KMVSTDCL: "70% of the unit cost or a maximum of Rs.2.00 lakhs will be subsidy and the remaining amount will be bank loan" — no fixed unit-cost ceiling or loan amount is stated beyond that, so no loanAmount is modelled here (same reasoning as PMMSY, whose subsidy is also a pure percentage-of-cost with no stated loan ceiling).',
      ratePercentMin: 70,
      ratePercentMax: 70,
    },
    documents: [
      'Aadhaar card',
      'Scheduled Tribe community/caste certificate',
      'Proof of Karnataka residency',
      'Project report or business plan for the proposed unit',
      'Bank account details',
    ],
    applicationSteps: [
      'Apply at your district/taluk KMVSTDCL office (or the Corporation\'s online portal) with the required documents.',
      'KMVSTDCL verifies Scheduled Tribe status, gender and the proposed business/industry/service unit.',
      'On approval, a bank sanctions the loan portion; KMVSTDCL releases its subsidy (up to 70% of unit cost, capped at ₹2,00,000) against it.',
    ],
    officialApplicationUrl: 'https://kmvstdcl.karnataka.gov.in/info-2/Self+Employment+Program/en',
    officialInfoUrl: 'https://kmvstdcl.karnataka.gov.in/info-2/Self+Employment+Program/en',
    source: 'Karnataka Maharshi Valmiki Scheduled Tribes Development Corporation (KMVSTDCL) — official Self Employment Program page',
    sourceUrl: 'https://kmvstdcl.karnataka.gov.in/info-2/Self+Employment+Program/en',
    lastVerifiedDate: '2026-10-19',
    confidence: 'reference',
    tags: ['kmvstdcl', 'karnataka', 'scheduled tribe', 'st', 'women entrepreneur', 'self employment'],
  },
]
