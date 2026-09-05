"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import {
  Checkbox,
  Field,
  Honeypot,
  Input,
  Textarea,
  describedBy,
} from "@/components/ui/Field";
import { FOCUS_AREAS } from "@/lib/content";
import { submitPartner, type PartnerState } from "./actions";

const INITIAL: PartnerState = { status: "idle" };

export function PartnerForm() {
  const [state, formAction, pending] = useActionState(submitPartner, INITIAL);
  const id = useId();
  const fid = (name: string) => `${id}-${name}`;
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  // React 19 resets every field after a form action returns, so a failed
  // submit re-fills the form from the echoed values instead of wiping it.
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const focusAreas = state.status === "error" ? (state.focusAreas ?? []) : [];

  // The banner sits above the fold on a long form — bring it to the reader,
  // or a failed submit looks like nothing happened at all.
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") {
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="rounded border border-hairline bg-raised p-8 md:p-12">
        <p className="text-eyebrow font-semibold uppercase text-positive">
          Received
        </p>
        <h2 className="mt-5 text-h2 font-semibold">
          Thank you — {state.company} is on the list.
        </h2>
        <p className="mt-4 max-w-[54ch] text-slate">
          The organising team reviews partner submissions and follows up by
          email to confirm onboarding, portal access and interview format.
          Corporate onboarding closes eight to ten weeks before the fest.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="relative" noValidate>
      <Honeypot name="companyFax" />

      {state.status === "error" ? (
        <div
          ref={alertRef}
          role="alert"
          className="mb-8 rounded border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
        >
          {state.message}
        </div>
      ) : null}

      <fieldset className="border-0 p-0">
        <legend className="text-eyebrow font-semibold uppercase text-muted">
          Your organisation
        </legend>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Field
            label="Company name"
            htmlFor={fid("companyName")}
            error={errors.companyName}
            required
          >
            <Input
              id={fid("companyName")}
              name="companyName"
              defaultValue={values.companyName}
              required
              autoComplete="organization"
              aria-invalid={errors.companyName ? true : undefined}
              aria-describedby={describedBy(fid("companyName"), undefined, errors.companyName)}
            />
          </Field>

          <Field label="Website" htmlFor={fid("website")} error={errors.website}>
            <Input
              id={fid("website")}
              name="website"
              defaultValue={values.website}
              inputMode="url"
              placeholder="example.com"
              autoComplete="url"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-12 border-0 p-0">
        <legend className="text-eyebrow font-semibold uppercase text-muted">
          Who we speak to
        </legend>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Field
            label="Contact name"
            htmlFor={fid("contactName")}
            error={errors.contactName}
            required
          >
            <Input
              id={fid("contactName")}
              name="contactName"
              defaultValue={values.contactName}
              required
              autoComplete="name"
              aria-invalid={errors.contactName ? true : undefined}
            />
          </Field>

          <Field
            label="Email"
            htmlFor={fid("contactEmail")}
            error={errors.contactEmail}
            required
          >
            <Input
              id={fid("contactEmail")}
              name="contactEmail"
              defaultValue={values.contactEmail}
              type="email"
              inputMode="email"
              required
              autoComplete="email"
              aria-invalid={errors.contactEmail ? true : undefined}
            />
          </Field>

          <Field
            label="Phone"
            htmlFor={fid("contactPhone")}
            error={errors.contactPhone}
          >
            <Input
              id={fid("contactPhone")}
              name="contactPhone"
              defaultValue={values.contactPhone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="tabular"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-12 border-0 p-0">
        <legend className="text-eyebrow font-semibold uppercase text-muted">
          The role
        </legend>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Field
            label="Monthly stipend"
            htmlFor={fid("stipendMin")}
            error={errors.stipendMin}
            hint="In rupees per month. Indicative is fine."
          >
            <Input
              id={fid("stipendMin")}
              name="stipendMin"
              defaultValue={values.stipendMin}
              inputMode="numeric"
              placeholder="5000"
              className="tabular"
              aria-describedby={describedBy(fid("stipendMin"), "hint", errors.stipendMin)}
            />
          </Field>

          <Field
            label="Focus area"
            htmlFor={fid("focusArea-core_dev")}
            error={errors.focusArea}
            hint="The talent pool(s) your openings draw from. Pick as many as apply."
            required
          >
            <div className="flex flex-col gap-2.5">
              {FOCUS_AREAS.map((area) => (
                <Checkbox
                  key={area.code}
                  id={fid(`focusArea-${area.code}`)}
                  name="focusArea"
                  value={area.code}
                  defaultChecked={focusAreas.includes(area.code)}
                  label={area.name}
                />
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-6">
          <Checkbox
            id={fid("ppoTrack")}
            name="ppoTrack"
            defaultChecked={values.ppoTrack === "on"}
            label="This internship can lead to a Pre-Placement Offer."
          />
        </div>
      </fieldset>

      <fieldset className="mt-12 border-0 p-0">
        <legend className="text-eyebrow font-semibold uppercase text-muted">
          Problem statement
        </legend>
        <p className="mt-3 max-w-[58ch] text-sm text-muted">
          What should candidates be assessed against? This is what the
          interviews at the fest are built around.
        </p>

        <div className="mt-6 grid gap-6">
          <Field
            label="Title"
            htmlFor={fid("problemTitle")}
            error={errors.problemTitle}
            required
          >
            <Input
              id={fid("problemTitle")}
              name="problemTitle"
              defaultValue={values.problemTitle}
              required
              placeholder="Autonomous navigation for an indoor drone"
              aria-invalid={errors.problemTitle ? true : undefined}
            />
          </Field>

          <Field
            label="Description"
            htmlFor={fid("problemDescription")}
            error={errors.problemDescription}
            hint="A couple of paragraphs is plenty."
            required
          >
            <Textarea
              id={fid("problemDescription")}
              name="problemDescription"
              defaultValue={values.problemDescription}
              rows={7}
              required
              aria-invalid={errors.problemDescription ? true : undefined}
              aria-describedby={describedBy(
                fid("problemDescription"),
                "hint",
                errors.problemDescription,
              )}
            />
          </Field>
        </div>
      </fieldset>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sending…" : "Register interest"}
        </Button>
        <p className="text-sm text-muted">
          No commitment — the team follows up to confirm details.
        </p>
      </div>
    </form>
  );
}
