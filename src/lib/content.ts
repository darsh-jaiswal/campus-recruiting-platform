/**
 * Aspire Quest — canonical event content.
 *
 * SOURCING RULE (from the approved plan):
 *   Every figure in this file is a VERIFIED source fact. Nothing here is
 *   invented. If a fact is not yet known it is modelled explicitly as `null`
 *   or "TBA" and the UI degrades gracefully — it is never filled with a
 *   plausible-looking placeholder.
 *
 * This site is official-adjacent to a host institution. Invented
 * recruiter-facing numbers are a credibility and compliance risk, not a
 * cosmetic one. If you add a field here, add its source alongside it.
 *
 * Note: the values below are illustrative example data for this generalized
 * case study, not the real event's figures — see the README.
 */

/* -------------------------------------------------------------------------
 * Site / org identity
 * ---------------------------------------------------------------------- */

export const SITE = {
  /** Domain not yet decided (own domain vs. institution subdomain) — pending sign-off. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example-recruiting.vercel.app",
  name: "Aspire Quest",
  parentEvent: "the annual tech fest",
  institution: "the host institution",
  institutionFull: "a college or university running its own recruiting drive",
} as const;

export const CONTACT = {
  campusPhone: "+1 555 010 0100",
  campusEmail: "placements@example.edu",
  address: {
    line1: "123 Example Campus Road",
    line2: "",
    line3: "",
    line4: "",
  },
  placementCell: {
    name: "Placement Cell",
    role: "Placement Cell",
    email: "placements@example.edu",
    phone: "+1 555 010 0101",
  },
  instagram: "https://instagram.com/example",
} as const;

/**
 * Contact shown specifically on the payment/legal pages (terms, privacy,
 * refunds, contact) — kept separate from CONTACT above on purpose: whoever
 * actually holds the payment account is not necessarily the same contact as
 * the campus recruiter-facing one, and the two should never be conflated.
 */
export const PAYMENT_CONTACT = {
  phone: "+1 555 010 0102",
  email: "payments@example.edu",
} as const;

/* -------------------------------------------------------------------------
 * Edition — date-driven from config, defaults to TBA
 * ---------------------------------------------------------------------- */

export type Edition = {
  label: string;
  /** ISO start date (IST) or null when not yet announced. */
  startsAt: string | null;
  endsAt: string | null;
  dateLabel: string;
  registrationOpen: boolean;
};

/** This edition's dates are not announced. The site ships honest about that. */
export const EDITION: Edition = {
  label: "Next Edition",
  startsAt: null,
  endsAt: null,
  dateLabel: "Dates to be announced",
  registrationOpen: false,
};

export const TAGLINE = "Where campus talent meets the companies hiring it";

export const DESCRIPTION =
  "Aspire Quest is the industry and careers track of a college's annual technical fest. It is a real recruitment drive: partner companies interview students on campus and make internship offers with stipends and PPO tracks.";

/* -------------------------------------------------------------------------
 * Last edition — illustrative example data
 * ---------------------------------------------------------------------- */

export const LAST_EDITION = {
  label: "Previous Edition",
  dateLabel: "March 2026",
  days: 3,
  participants: 480,
} as const;

export type Placement = {
  name: string;
  programme: string;
  year: string;
  company: string;
  stipend: string;
  ppo: boolean;
};

/** Illustrative example outcomes — the shape a real edition's data takes. */
export const PLACEMENTS: readonly Placement[] = [
  {
    name: "Student A",
    programme: "B.Tech Computer Science",
    year: "3rd year",
    company: "Example Robotics Co.",
    stipend: "$60/mo",
    ppo: true,
  },
  {
    name: "Student B",
    programme: "B.Tech Computer Engineering",
    year: "3rd year",
    company: "Example Robotics Co.",
    stipend: "$60/mo",
    ppo: true,
  },
];

/* -------------------------------------------------------------------------
 * Placement credibility — the table recruiters actually read
 * ---------------------------------------------------------------------- */

export type PlacementStat = {
  programme: string;
  year: string;
  highest: number;
  average: number;
};

/** Illustrative figures, in a generic currency unit. Source: institution's own published placement reports, in a real deployment. */
export const PLACEMENT_STATS: readonly PlacementStat[] = [
  { programme: "B.Tech", year: "2024", highest: 22.2, average: 9.9 },
  { programme: "B.Tech", year: "2025", highest: 19.8, average: 8.0 },
  { programme: "B.Tech", year: "2026", highest: 17.8, average: 7.5 },
];

export type Recruiter = {
  name: string;
  /** Path under /public. Logos are third-party trademarks in a real
   * deployment, used only to identify each company as a recruiting partner. */
  logo: string;
};

/** Illustrative example recruiter list. */
export const RECRUITERS: readonly Recruiter[] = [
  { name: "Company A", logo: "/recruiters/company-a.svg" },
  { name: "Company B", logo: "/recruiters/company-b.svg" },
  { name: "Company C", logo: "/recruiters/company-c.svg" },
  { name: "Company D", logo: "/recruiters/company-d.svg" },
];

/* -------------------------------------------------------------------------
 * Talent pool
 * ---------------------------------------------------------------------- */

export type Branch = {
  code: string;
  name: string;
  programme: "B.Tech" | "MBA.Tech";
};

export const BRANCHES: readonly Branch[] = [
  { code: "CS", name: "Computer Science", programme: "B.Tech" },
  { code: "IT", name: "Information Technology", programme: "B.Tech" },
  { code: "AIML", name: "Artificial Intelligence & Machine Learning", programme: "B.Tech" },
  { code: "MTX", name: "Mechatronics", programme: "B.Tech" },
  { code: "EXTC", name: "Electronics & Telecommunication", programme: "B.Tech" },
  { code: "CE-MT", name: "Computer Engineering", programme: "MBA.Tech" },
  { code: "IT-MT", name: "Information Technology", programme: "MBA.Tech" },
];

/** Focus areas — these drive screening and partner openings. */
export type FocusAreaCode = "core_dev" | "aiml" | "robotics" | "other";

export type FocusArea = {
  code: FocusAreaCode;
  name: string;
  summary: string;
};

export const FOCUS_AREAS: readonly FocusArea[] = [
  {
    code: "core_dev",
    name: "Core Development",
    summary:
      "Backend, frontend and full-stack engineering. Students shortlisted here are screened on shipped projects and data-structures depth.",
  },
  {
    code: "aiml",
    name: "AI & Machine Learning",
    summary:
      "Applied ML, data engineering and analytics — drawn largely from the AIML cohort and CS students with ML coursework.",
  },
  {
    code: "robotics",
    name: "Robotics & Embedded",
    summary:
      "Mechatronics, EXTC and embedded/robotics work.",
  },
  {
    code: "other",
    name: "Product, Design & Other",
    summary:
      "Roles outside the three core technical tracks, matched case by case against a partner's problem statement.",
  },
];

/**
 * Openings may also target every track at once; a student's registration
 * cannot — they must pick a real pool, so "all" lives here and not in
 * FOCUS_AREAS.
 */
export type OpeningFocusCode = FocusAreaCode | "all";

export const OPENING_FOCUS_AREAS: readonly {
  code: OpeningFocusCode;
  name: string;
}[] = [
  ...FOCUS_AREAS.map(({ code, name }) => ({ code, name })),
  { code: "all", name: "All focus areas" },
];

/* -------------------------------------------------------------------------
 * Fest events — context for what the fest is (illustrative)
 * ---------------------------------------------------------------------- */

export const LAST_EDITION_EVENTS: readonly string[] = [
  "24-Hr Hackathon",
  "Robotics Workshop",
  "Pitch Your Own App",
  "Code Relay",
  "Tech Arena (E-Sports)",
  "Treasure Hunt",
];

/* -------------------------------------------------------------------------
 * The four-phase organiser timeline (Event Organizer Playbook)
 * ---------------------------------------------------------------------- */

export type Phase = {
  number: number;
  window: string;
  title: string;
  summary: string;
  audience: "recruiters" | "students" | "both";
};

export const PHASES: readonly Phase[] = [
  {
    number: 1,
    window: "8–10 weeks out",
    title: "Corporate onboarding",
    summary:
      "Partner companies commit, confirm stipend and PPO intent, and submit the problem statements their interviews will be built around.",
    audience: "recruiters",
  },
  {
    number: 2,
    window: "4–6 weeks out",
    title: "Student intake & screening",
    summary:
      "Registration opens. Applications are screened on CGPA, branch and focus area, and students apply to partner openings in their focus area.",
    audience: "students",
  },
  {
    number: 3,
    window: "Fest week",
    title: "On-campus interviews",
    summary:
      "Partners review the candidates who applied to their openings and run interviews on campus across the fest.",
    audience: "both",
  },
  {
    number: 4,
    window: "Post-event",
    title: "Offers & handover",
    summary:
      "Offers are confirmed, outcomes are recorded with the Placement Cell, and the partner relationship carries into the next edition.",
    audience: "both",
  },
];

/* -------------------------------------------------------------------------
 * FAQ — answers derived only from the playbook and verified facts
 * ---------------------------------------------------------------------- */

export type FaqItem = { question: string; answer: string };

export const FAQ: readonly FaqItem[] = [
  {
    question: "What is Aspire Quest?",
    answer:
      "It is the industry and careers track inside a college's annual technical fest. Unlike the competition events, Aspire Quest is a real recruitment drive: partner companies interview students on campus and make internship offers carrying stipends and Pre-Placement Offer eligibility.",
  },
  {
    question: "Who can register?",
    answer:
      "Students of the host institution across B.Tech (Computer Science, IT, AIML, Mechatronics, EXTC) and MBA.Tech (Computer Engineering, IT). Applications are screened on CGPA, branch and declared focus area before shortlisting.",
  },
  {
    question: "Do I need an account?",
    answer:
      "Yes, but only to register — browsing the rest of the site never requires it. Sign in with Google or Microsoft so the email address on your application is verified rather than typed; there is no separate account to set up and no password to remember. It is not a dashboard: there is nothing to check back into afterward. When you submit the form you are shown a reference code on screen — save it, because that code, not a login, is how the organising team identifies your application.",
  },
  {
    question: "What do I need to have ready?",
    answer:
      "Your CGPA, your branch and year, the focus area you want to be considered for, and a resume as a PDF under 5 MB. Nothing else.",
  },
  {
    question: "Does registering guarantee an interview?",
    answer:
      "No. Registrations are screened against the requirements each partner company sets, and partners review the applications to their own openings. Meeting the CGPA threshold makes you eligible for consideration, not for a guaranteed slot.",
  },
  {
    question: "What happened at the last edition?",
    answer:
      "The previous edition ran across three days with about 480 participants. Through Aspire Quest, two third-year students were placed at a partner robotics company on a stipend with PPO eligibility.",
  },
  {
    question: "How is my data handled?",
    answer:
      "Your resume is stored in private encrypted storage and is never exposed by a public link. Only the organising team and the specific partner companies whose openings you apply to can view it, and every such access is logged. You consent to this explicitly at registration, and records are purged after the stated retention window.",
  },
  {
    question: "Our company wants to recruit here. How do we start?",
    answer:
      "Use the corporate partner form. You will be asked for a contact, the roles and stipend range you are considering, and a short problem statement describing the work. The organising team follows up to confirm onboarding, typically eight to ten weeks before the fest.",
  },
];

/* -------------------------------------------------------------------------
 * Registration fee — modelled the same way as EDITION.startsAt: a value that
 * ships correct but inert until real, and is never invented.
 * ---------------------------------------------------------------------- */

export type RegistrationFee = {
  /** Integer smallest-currency-unit, never a float — same discipline as CGPA. Null = not yet decided. */
  amountPaise: number | null;
  label: string;
};

export const REGISTRATION_FEE: RegistrationFee = {
  amountPaise: null,
  label: "TBA",
};

/* -------------------------------------------------------------------------
 * Registration constraints — single source of truth, shared with Zod schemas
 * ---------------------------------------------------------------------- */

export const REGISTRATION = {
  /** Screening floor used by the admin console default filter. */
  defaultCgpaThreshold: 6.0,
  minCgpa: 0,
  maxCgpa: 10,
  resumeMaxBytes: 5 * 1024 * 1024,
  resumeMaxLabel: "5 MB",
  resumeAcceptedTypes: ["application/pdf"],
  resumeAcceptedLabel: "PDF only",
  years: ["1st year", "2nd year", "3rd year", "4th year", "5th year"],
} as const;
