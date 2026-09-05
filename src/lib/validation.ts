/**
 * Zod schemas — the single validation boundary.
 *
 * Every public Server Action parses its input through one of these before it
 * touches the database. The client may also use them for inline feedback, but
 * client-side validation is a convenience, never the enforcement point.
 */

import { z } from "zod";
import {
  BRANCHES,
  FOCUS_AREAS,
  OPENING_FOCUS_AREAS,
  REGISTRATION,
} from "./content";

const branchCodes = BRANCHES.map((b) => b.code) as [string, ...string[]];
const focusCodes = FOCUS_AREAS.map((f) => f.code) as [string, ...string[]];
/** Openings additionally accept "all"; students never do. */
const openingFocusCodes = OPENING_FOCUS_AREAS.map((f) => f.code) as [
  string,
  ...string[],
];
const yearValues = REGISTRATION.years as readonly string[] as [
  string,
  ...string[],
];

/* -------------------------------------------------------------------------
 * Shared field schemas
 * ---------------------------------------------------------------------- */

const fullName = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(120, "That name is too long.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address.")
  .max(160, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

/**
 * Indian mobile numbers: 10 digits starting 6–9, with an optional +91 or 0
 * prefix. Stored normalised to the bare 10 digits.
 */
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^(?:\+?91|0)?[6-9]\d{9}$/,
        "Enter a valid 10-digit Indian mobile number.",
      ),
  )
  .transform((value) => value.replace(/^(?:\+?91|0)/, ""));

/**
 * CGPA is kept as a fixed-2 string all the way to Postgres `numeric(4,2)`.
 * Never a float — screening compares against a threshold and binary floating
 * point makes "6.00 >= 6.00" a coin toss at the boundary.
 */
const cgpa = z
  .string()
  .trim()
  .min(1, "Enter your CGPA.")
  .refine((value) => /^\d{1,2}(\.\d{1,2})?$/.test(value), {
    message: "Enter CGPA as a number, e.g. 7.85.",
  })
  .refine(
    (value) => {
      const parsed = Number(value);
      return parsed >= REGISTRATION.minCgpa && parsed <= REGISTRATION.maxCgpa;
    },
    {
      message: `CGPA must be between ${REGISTRATION.minCgpa} and ${REGISTRATION.maxCgpa}.`,
    },
  )
  .transform((value) => Number(value).toFixed(2));

/** Honeypot: a field no human sees. Any content means a bot filled the form. */
const honeypot = z
  .string()
  .max(0, "Submission rejected.")
  .optional()
  .or(z.literal(""));

/* -------------------------------------------------------------------------
 * Student registration
 * ---------------------------------------------------------------------- */

const studentRegistrationFields = z.object({
  fullName,
  email,
  phone,
  branch: z.enum(branchCodes, { message: "Select your branch." }),
  programme: z.enum(["B.Tech", "MBA.Tech"], {
    message: "Select your programme.",
  }),
  year: z.enum(yearValues, { message: "Select your year of study." }),
  cgpa,
  focusArea: z.enum(focusCodes, { message: "Select one focus area." }),
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(12, "List at most 12 skills.")
    .default([]),
  /** Blob key returned by the direct client upload. */
  resumeBlobKey: z.string().trim().min(1, "Upload your resume as a PDF."),
  resumeFilename: z.string().trim().max(200).optional(),
  resumeBytes: z
    .number()
    .int()
    .positive()
    .max(
      REGISTRATION.resumeMaxBytes,
      `Your resume must be under ${REGISTRATION.resumeMaxLabel}.`,
    ),
  consent: z
    .literal(true, { message: "You must agree before we can process your application." }),
  website: honeypot,
});

/**
 * Branch and programme must agree.
 *
 * Without this a student can submit programme "B.Tech" with branch "CE-MT",
 * which is an MBA.Tech branch. Nothing downstream would reject it, and the
 * admin console's branch filter would then silently mis-sort that
 * candidate in screening.
 */
export const studentRegistrationSchema = studentRegistrationFields.superRefine(
  (value, ctx) => {
    const branch = BRANCHES.find((b) => b.code === value.branch);
    if (!branch) return;
    if (branch.programme !== value.programme) {
      ctx.addIssue({
        code: "custom",
        path: ["branch"],
        message: `${branch.name} (${branch.code}) is a ${branch.programme} branch. Check your programme selection.`,
      });
    }
  },
);

export type StudentRegistrationInput = z.infer<
  typeof studentRegistrationSchema
>;

/* -------------------------------------------------------------------------
 * Corporate partner
 * ---------------------------------------------------------------------- */

export const partnerSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Enter your company name.")
    .max(160, "That company name is too long."),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  contactName: fullName,
  contactEmail: email,
  contactPhone: phone.optional().or(z.literal("")),
  stipendMin: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) => value === undefined || (Number.isFinite(value) && value >= 0),
      { message: "Enter the monthly stipend as a number in rupees." },
    ),
  ppoTrack: z.boolean().default(false),
  problemTitle: z
    .string()
    .trim()
    .min(4, "Give the problem statement a title.")
    .max(200),
  problemDescription: z
    .string()
    .trim()
    .min(40, "Describe the work in at least a couple of sentences.")
    .max(4000),
  focusArea: z
    .array(z.enum(focusCodes))
    .min(1, "Select at least one focus area."),
  /** Honeypot field, named to look plausible to a bot. */
  companyFax: honeypot,
});

export type PartnerInput = z.infer<typeof partnerSchema>;

/* -------------------------------------------------------------------------
 * Job opening — recruiter-authored, validated in the portal Server Action
 * ---------------------------------------------------------------------- */

export const jobOpeningSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, "Give the opening a title.")
    .max(200, "That title is too long."),
  focusArea: z.enum(openingFocusCodes, {
    message: "Select the focus area this role sits in.",
  }),
  description: z
    .string()
    .trim()
    .min(40, "Describe the role in at least a couple of sentences.")
    .max(8000, "Keep the description under 8000 characters."),
  /** Private to the hiring team and the AI scorer. Never shown to students. */
  screeningPrompt: z
    .string()
    .trim()
    .max(4000, "Keep the screening prompt under 4000 characters.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  /** Optional uploaded JD document — blob key from /api/openings/jd/upload. */
  jdBlobKey: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  jdFilename: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  jdBytes: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .transform((value) => (value ? value : null)),
  jdContentType: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  minCgpa: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || /^\d{1,2}(\.\d{1,2})?$/.test(value),
      { message: "Enter the minimum CGPA as a number, e.g. 7.0." },
    )
    .refine(
      (value) => {
        if (value === null) return true;
        const parsed = Number(value);
        return parsed >= REGISTRATION.minCgpa && parsed <= REGISTRATION.maxCgpa;
      },
      {
        message: `CGPA must be between ${REGISTRATION.minCgpa} and ${REGISTRATION.maxCgpa}.`,
      },
    )
    .transform((value) => (value === null ? null : Number(value).toFixed(2))),
  /** Empty = all branches eligible. */
  eligibleBranches: z
    .array(z.enum(branchCodes))
    .max(branchCodes.length)
    .default([]),
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(12, "List at most 12 skills.")
    .default([]),
});

export type JobOpeningInput = z.infer<typeof jobOpeningSchema>;

/* -------------------------------------------------------------------------
 * Resume upload constraints — enforced again server-side on the blob callback
 * ---------------------------------------------------------------------- */

export const resumeUploadSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(["application/pdf"], {
    message: "Resumes must be PDF files.",
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(REGISTRATION.resumeMaxBytes, "Your resume must be under 5 MB."),
});

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

/** Flatten a ZodError into `{ field: firstMessage }` for form rendering. */
export function fieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
