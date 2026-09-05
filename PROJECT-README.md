# Aspire Quest

The industry and careers platform for **Aspire Quest**: the recruitment track inside a college's annual technical fest, generalized here since the pattern applies to any campus recruiting event. See the top-level case-study README for how this relates to the real deployment it's drawn from.

It does four things:

1. Sells Aspire Quest to recruiters and alumni.
2. Captures corporate partners and their problem statements.
3. Collects student registrations with resumes and screens them by CGPA, branch and focus area.
4. Runs the openings marketplace: recruiters post roles and review exactly the students who applied to them.

---

## Content is sourced, not invented

**`src/lib/content.ts` is the single source of truth for every public-facing fact, and every figure in it is verified.** Unknowns (event dates, for example) are modelled explicitly as `null` / `"TBA"` and the UI degrades gracefully.

This is not a style preference. The site is official-adjacent to a specific institution and is read by real corporate recruiters. Plausible-looking placeholder numbers on a placement platform are a credibility and compliance problem. **If you add a field, add its source.**

Always write `₹` directly (UTF-8). Source material renders it as mojibake; the test suite and content lint guard against it leaking through.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4, design tokens in `src/app/globals.css` |
| Database | Neon Postgres + Drizzle ORM (**pooled** connection string) |
| Resume storage | Vercel Blob, **private**, direct client uploads |
| Auth | Clerk — admin + recruiter only (**not yet wired**) |
| Rate limiting | Upstash Redis |
| Payments | Razorpay — direct SDK integration, not a Vercel Marketplace product (the payments category offers Stripe only) |
| Hosting | Vercel, Fluid Compute. No `runtime = 'edge'` |

**Students sign in with Google or Microsoft, and registration is paid.** Registration
is gated on a verified identity, so the email address on an application is one the
applicant demonstrably controls rather than one they typed. Browsing the site never
requires an account — only registering does. This reverses an earlier decision to
have no student accounts, made before there was a plan to charge a registration fee;
see `docs/superpowers/specs/2026-08-22-student-accounts-and-payment-design.md`. The
Resend 100/day cap that partly motivated the original decision remains a live
constraint on confirmation and reminder volume.

The fee itself (`REGISTRATION_FEE` in `src/lib/content.ts`) is modelled the same way
`EDITION.startsAt` is: a value that ships correct but inert until real, never invented.
In this generalized version it's left as `null` (free registration). Setting
`amountPaise` to a real value turns on the paid flow with no other code change —
**Razorpay itself is not yet configured anywhere** (`NEXT_PUBLIC_RAZORPAY_KEY_ID` /
`RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` are unset) — until an account exists
and test-mode keys are set, registration with a fee configured fails closed with a
clear "temporarily unavailable" message rather than silently accepting an unpayable
application.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill it in, or:
vercel env pull .env.local     # once the Marketplace integrations exist

npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright — public site, console fail-closed, form contracts. Needs `CLERK_SECRET_KEY`: the registration tests sign in, and `e2e/global-setup.ts` creates the passwordless `+clerk_test` account they use |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:push` | Push the schema to the database |
| `npm run db:studio` | Drizzle Studio |

### Environment status

The public site renders without any environment at all — including on Vercel, where `src/proxy.ts` skips Clerk entirely when its keys are absent. (Without that guard the proxy throws `Missing publishableKey` on every request and takes the public pages down with it; development tolerates missing keys and hides this, production does not.) `/admin` and `/portal` still refuse to render, which is the intended direction.

1. ✅ **Neon**, via the Vercel Marketplace → `DATABASE_URL` — provisioned, schema pushed (`example-project-name`), set on Production/Preview/Development automatically by the integration
2. ⬜ **Vercel Blob**, private store → `BLOB_READ_WRITE_TOKEN` — resume upload will fail until this exists
3. ⬜ **Upstash Redis** via the Marketplace → `UPSTASH_REDIS_REST_*` — public forms reject in production without it (see `src/lib/rate-limit.ts`; fails **closed**, on purpose)
4. ⬜ **Clerk** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — `/admin` and `/portal` return 500 until this exists
5. ⬜ **Razorpay** → `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — no account exists yet. With `REGISTRATION_FEE.amountPaise` set to a real value, registration fails closed with a clear error until these are set; set `amountPaise` back to `null` in `src/lib/content.ts` to keep registration free in the meantime

Local dev picks these up from `.env.local` (pulled via `vercel env pull .env.local`, gitignored). After a fresh `db:push` against a new database, run it non-interactively with `npm run db:push -- --force` if there's no TTY (CI, an agent) — safe on an empty database; there is nothing to lose data from yet.

---

## Design direction — Institutional Monochrome

Disciplined, Swiss-grid, and **black and white**. It must read as an official university placement platform and stay legible on a projector in a placement office.

- **The palette has no hue, so the accent is inversion.** The one primary action per screen is a solid ink block on paper; everything secondary is paper with a hairline. Where the previous navy/amber system used colour to say "this one matters", this one flips the fill.
- Ink `#0D0D0D` on paper `#F7F7F4` — not `#000` on `#FFF`, which vibrates on a projector and is tiring to read at length
- Structure comes from thin rules and whitespace, never drop shadows or card grids
- Inter, **two text weights** (400/600) — hierarchy from scale and tracking. 800 exists solely for the masthead wordmark, where the letterforms are artwork rather than a heading, and is not for body copy.
- Tabular figures anywhere a number is presented as data
- Uniform 4px radius
- **Committed to light mode** for the body, painted explicitly; the masthead is the one deliberately dark surface

Tokens live in `src/app/globals.css` under `@theme`. No hardcoded hex in components. The token *names* still read `navy` / `amber` from the previous palette — they are referenced across roughly forty components and renaming them would turn a palette change into a site-wide rewrite. They are semantic slots; only their values changed.

Because hue is gone, **status must never be carried by colour alone.** Every success and error state pairs its treatment with wording, which is the stronger WCAG position regardless of palette.

### The masthead

The first screen is the only place on the site that spends any ink on spectacle. Three layers:

1. **`MarkField`** — the fest's logo multiplied into a grid, every triangle turning to face the pointer. Texture, not subject. All the maths and DOM writes happen once per frame in a `requestAnimationFrame` callback, and the only thing written is a custom property driving a `rotate()`, so it stays on the compositor.
2. **The wordmark, reimagined** — the same mark built in three dimensions and draggable, lit by three hand-placed lights rather than an HDR environment map, because the CSP allows no external origins.
3. **The wordmark**, set large along the bottom edge and cropped, so the screen reads as a fragment of something bigger than the viewport.

The masthead is deliberately **not** an `<h1>`. The page's one first-level heading belongs to the section below it, which carries the actual proposition.

The next edition's creative theme is undecided, so palette, accent and the hero slot are swappable without a redesign.

---

## Security

This holds student PII (name, email, phone, **CGPA**) and resumes. Under the DPDP Act, CGPA and phone are personal data.

- **Authorization is re-checked in every Server Action and route handler.** Middleware is a first gate, never the only one. A recruiter may read only candidates who applied to their own company's openings — enforced in the query, not the UI.
- **Resumes** live in a private Blob store. No public URL exists. Reads go through short-TTL signed URLs minted server-side after an authz check, and every access writes an `audit_log` row.
- **Uploads** are PDF-only and 5 MB-capped, enforced by the upload token itself (`src/app/api/resume/upload/route.ts`), not by client-side `accept`. Keys get a random suffix — never the user's filename.
- **Validation**: Zod at every boundary (`src/lib/validation.ts`). Drizzle parameterized queries only.
- **Rate limiting** on all three public forms, plus honeypot fields. Fails **closed** in production.
- **Consent** is explicit and timestamped at registration.

### Known cost: three.js on the masthead

The draggable mark is real WebGL, and three.js is **229 KB gzipped** in its own chunk — well past the 150 KB landing-page JS budget this project otherwise works to. That budget is recorded here as broken rather than quietly dropped.

What keeps it defensible:

- The chunk is **code-split and lazy**, reached only through `next/dynamic` with `ssr: false`. It is not in the initial payload, `/` still prerenders as static, and nothing above the fold waits on it.
- It never loads at all on a **coarse pointer** (a phone, where the drag has little to offer and the frame cost lands hardest) or under **`prefers-reduced-motion`**.
- Machines without WebGL fall through to the flat SVG mark.

So the budget holds for first paint and for every phone; it is desktop enhancement that exceeds it. Revisit if the masthead ever stops earning that.

### Known gap: CSP is not nonce-based

A per-request nonce requires middleware to inject it into the HTML, which forces every page to render dynamically — directly conflicting with keeping the public pages static and CDN-served at zero compute.

The shipped CSP (`next.config.ts`) is the strictest *static-compatible* version: everything locked to `'self'` with no external origins, but `script-src` allows `'unsafe-inline'` because Next's hydration bootstrap is an inline script with no nonce to whitelist.

**This is a deliberate trade-off, not an oversight.** Revisit it if the public pages ever become dynamic anyway.

### Known advisory: `esbuild` via `drizzle-kit`

`npm audit` reports 4 moderate advisories, all from `esbuild` transitively under `drizzle-kit`. `drizzle-kit` is a **dev-only CLI** used for migrations and never ships to production, and the advisory concerns esbuild's dev server. `npm audit fix --force` would downgrade `drizzle-kit` 0.45 → 0.18, a major regression. Left as-is deliberately.

---

## Project status

| Step | State |
|---|---|
| 1. Scaffold | Done — Vercel project linked, Git-connected, auto-deploys on push to `main` |
| 2. Design tokens | Done |
| 3. Schema & migrations | Done — `drizzle/0000_init.sql`, 9 tables, pushed to Neon (`example-project-name`) |
| 4. Public marketing site | Done |
| 5. Public intake forms | Done — student, partner, alumni. Database is live; resume upload still needs `BLOB_READ_WRITE_TOKEN` |
| 6. Admin console | Done — screening, pipeline, alumni, audit, CSV in/out. (Candidate bundles removed 2026-08-24 — the openings marketplace is the only sharing channel.) Needs Clerk keys to run |
| 7. Recruiter portal | Done — job openings, AI-ranked applicant review, interest marks, resume reads. Needs Clerk keys to run |
| 8. Harden & verify | Partial — headers, validation/CSV/policy/interest tests done. E2E covers the public site, console fail-closed behaviour and the registration form's static contract (`npm run test:e2e`). Full-submission E2E, load and Lighthouse outstanding — the former needs Blob + a database configured |

## Console access

`/admin` is the organiser console; `/portal` is the recruiter view. Both sit behind Clerk.

The two are separate route trees on purpose. `/portal` is gated by `requireRecruiter`, which rejects **admins as well as anonymous traffic**, so a recruiter never loads a page whose data functions were written assuming an organiser caller. Recruiter-facing reads live in `src/db/queries/openings.ts` and take the permitted company ids as a required argument — there is no read-by-id function a recruiter path could reach without its company filter.

### What a recruiter can do

- Post and manage **job openings** for their own company, and see the applicants to those openings, AI-ranked — and nothing else. Another company's opening returns 404, the same response as one that does not exist, so the portal cannot be used to discover that it exists.
- Open an applicant's resume — the exact file snapshotted at apply time — through the same audited `/api/resume/download` handler the console uses.
- Mark each applicant **interested / passed / not reviewed**. These writes re-derive company authority from the database rather than from the submitted form.

Interest is a tri-state, not a boolean — "not yet reviewed" must never render as "everyone was rejected". The toggle lives in `src/lib/interest.ts` as pure functions shared by the action and the UI, so the two cannot disagree about what a click means.

**Roles are not self-service.** Students sign in and get no role — that is what makes them a student rather than a denial (see `src/lib/auth.ts`). There is no route by which a signed-in account can grant *itself* `admin` or `recruiter`; recruiters are invited by an admin. To grant access, set the Clerk user's **`publicMetadata.role`** to `admin` or `recruiter`:

```json
{ "role": "admin" }
```

A recruiter additionally needs a row in `recruiter_memberships` linking them to their company. That link lives in **our** database, not in Clerk, because it decides which candidates they can see — see `src/lib/auth.ts`.

Without Clerk keys every `/admin` route returns 500 rather than rendering. That is the intended failure direction; it is not a bug.

### How authorization is enforced

`src/proxy.ts` (Next 16's renamed middleware) is a **first gate only** — it knows nothing about roles. Every page, Server Action and route handler re-checks through `src/lib/auth.ts`, so a route added without a matcher entry still fails closed.

The actual decisions live in `src/lib/access-policy.ts` as pure functions with no I/O, covered by tests including explicit fail-closed cases. The rules:

- An admin may read anything.
- A recruiter may read a candidate **only** if that candidate applied to an opening of a company the recruiter is a member of — applying is the student's act of sharing.
- A recruiter with no membership can read nothing.
- Unauthorised resume requests return **404, not 403** — confirming a student id exists is itself a disclosure.

### Blocked on the organiser

- Next edition's dates (the site ships date-driven and defaults to TBA)
- Full-resolution photos from the RAW team, or an Instagram export
- Whether this lives on the institution's own subdomain or its own domain (institutional logo use, if any, would need its own sign-off)
- The alumni CSV and the Placement Cell recruiter list

**Branding caution:** this is official-adjacent. Institutional logo use and any institutional domain need sign-off before going public.

---

## Superseded work

`.superseded/platform-signage/` holds an earlier draft built to a different design direction ("Platform Signage" — transit-signage vernacular) with invented placeholder content. It is kept for reference only. **Do not copy content out of it** — its figures are not sourced.
