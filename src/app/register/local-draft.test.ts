import { describe, expect, it } from "vitest";
import type { SubmittedValues } from "./actions";
import {
  nextResumeMeta,
  parseStoredDraft,
  RESUME_MAX_AGE_MS,
} from "./local-draft";

const VALUES: SubmittedValues = {
  fullName: "Asha Patil",
  phone: "9876543210",
  cgpa: "8.15",
  programme: "B.Tech",
  branch: "CS",
  year: "3rd year",
  focusArea: "aiml",
  skills: "Python",
  consent: true,
};

const NOW = 1_700_000_000_000;

function stored(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ v: 1, values: VALUES, resume: null, ...overrides });
}

describe("parseStoredDraft", () => {
  it("round-trips a plain values draft", () => {
    expect(parseStoredDraft(stored(), NOW)).toEqual({
      values: VALUES,
      resume: null,
    });
  });

  it("returns null for garbage, missing input, or a wrong version", () => {
    expect(parseStoredDraft(null, NOW)).toBeNull();
    expect(parseStoredDraft("not json {", NOW)).toBeNull();
    expect(parseStoredDraft('"a string"', NOW)).toBeNull();
    expect(parseStoredDraft(stored({ v: 2 }), NOW)).toBeNull();
    expect(parseStoredDraft(stored({ values: { fullName: 3 } }), NOW)).toBeNull();
  });

  it("keeps a fresh uploaded resume but expires one older than the sweep-safe window", () => {
    const resume = {
      key: "resumes/abc.pdf",
      name: "cv.pdf",
      bytes: 100,
      fromRow: false,
      savedAt: NOW - RESUME_MAX_AGE_MS + 60_000,
    };
    expect(parseStoredDraft(stored({ resume }), NOW)?.resume).toEqual({
      key: "resumes/abc.pdf",
      name: "cv.pdf",
      bytes: 100,
    });

    const stale = { ...resume, savedAt: NOW - RESUME_MAX_AGE_MS - 60_000 };
    expect(parseStoredDraft(stored({ resume: stale }), NOW)?.resume).toBeNull();
  });

  it("never expires a resume that a submitted row references", () => {
    const resume = {
      key: "resumes/abc.pdf",
      name: "cv.pdf",
      bytes: 100,
      fromRow: true,
      savedAt: NOW - 40 * 60 * 60 * 1000,
    };
    expect(parseStoredDraft(stored({ resume }), NOW)?.resume).not.toBeNull();
  });
});

describe("nextResumeMeta", () => {
  const current = {
    key: "resumes/abc.pdf",
    name: "cv.pdf",
    bytes: 100,
    fromRow: false,
  };

  it("stamps a new key with now", () => {
    expect(nextResumeMeta(null, current, NOW)).toEqual({
      ...current,
      savedAt: NOW,
    });
  });

  it("keeps the original stamp when the same key is re-saved, so editing can't refresh a dying pointer", () => {
    const previous = { ...current, savedAt: NOW - 5_000 };
    expect(nextResumeMeta(previous, current, NOW)?.savedAt).toBe(NOW - 5_000);
  });

  it("re-stamps when the key changes (a new upload replaced the file)", () => {
    const previous = { ...current, key: "resumes/old.pdf", savedAt: NOW - 5_000 };
    expect(nextResumeMeta(previous, current, NOW)?.savedAt).toBe(NOW);
  });

  it("preserves fromRow once earned", () => {
    const previous = { ...current, fromRow: true, savedAt: NOW - 5_000 };
    expect(nextResumeMeta(previous, current, NOW)?.fromRow).toBe(true);
  });

  it("returns null when there is no resume", () => {
    expect(nextResumeMeta(null, null, NOW)).toBeNull();
  });
});
