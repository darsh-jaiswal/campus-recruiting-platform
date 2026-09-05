import { describe, expect, test } from "vitest";
import {
  canAddResume,
  canDeleteResume,
  defaultResumeId,
  MAX_ACTIVE_RESUMES,
  type LibraryResume,
} from "./resume-library";

function entry(
  id: number,
  overrides: Partial<LibraryResume> = {},
): LibraryResume {
  return {
    id,
    filename: `resume-${id}.pdf`,
    bytes: 1000,
    isPrimary: false,
    deletedAt: null,
    ...overrides,
  };
}

describe("canAddResume", () => {
  test("allows adding below the cap", () => {
    expect(canAddResume([])).toBe(true);
    expect(canAddResume([entry(1, { isPrimary: true }), entry(2)])).toBe(true);
  });

  test("refuses at the cap", () => {
    const full = [entry(1, { isPrimary: true }), entry(2), entry(3)];
    expect(full).toHaveLength(MAX_ACTIVE_RESUMES);
    expect(canAddResume(full)).toBe(false);
  });

  test("soft-deleted entries do not count against the cap", () => {
    const entries = [
      entry(1, { isPrimary: true }),
      entry(2, { deletedAt: new Date() }),
      entry(3, { deletedAt: new Date() }),
    ];
    expect(canAddResume(entries)).toBe(true);
  });
});

describe("canDeleteResume", () => {
  const library = [entry(1, { isPrimary: true }), entry(2), entry(3)];

  test("a non-primary entry can be deleted", () => {
    expect(canDeleteResume(library, 2)).toEqual({ ok: true });
  });

  test("the primary can never be deleted", () => {
    expect(canDeleteResume(library, 1)).toEqual({ ok: false, reason: "primary" });
  });

  test("an unknown or already-deleted entry is not found", () => {
    expect(canDeleteResume(library, 99)).toEqual({
      ok: false,
      reason: "not_found",
    });
    const withDeleted = [...library, entry(4, { deletedAt: new Date() })];
    expect(canDeleteResume(withDeleted, 4)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("defaultResumeId", () => {
  test("prefers the active primary", () => {
    expect(
      defaultResumeId([entry(1), entry(2, { isPrimary: true }), entry(3)]),
    ).toBe(2);
  });

  test("falls back to the first active entry when no primary is active", () => {
    expect(
      defaultResumeId([
        entry(1, { isPrimary: true, deletedAt: new Date() }),
        entry(2),
      ]),
    ).toBe(2);
  });

  test("null for an empty or fully deleted library", () => {
    expect(defaultResumeId([])).toBeNull();
    expect(defaultResumeId([entry(1, { deletedAt: new Date() })])).toBeNull();
  });
});
