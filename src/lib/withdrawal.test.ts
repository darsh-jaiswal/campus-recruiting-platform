import { describe, expect, test } from "vitest";
import {
  applicationWithdrawnAt,
  canReapply,
  reapplyResetsScore,
} from "./withdrawal";

const WHEN = new Date("2026-08-24T10:00:00Z");
const LATER = new Date("2026-08-25T10:00:00Z");

describe("applicationWithdrawnAt", () => {
  test("an application is withdrawn by its own timestamp", () => {
    expect(
      applicationWithdrawnAt({ withdrawnAt: WHEN }, { withdrawnAt: null }),
    ).toBe(WHEN);
  });

  test("a withdrawn registration withdraws every application derivedly", () => {
    expect(
      applicationWithdrawnAt({ withdrawnAt: null }, { withdrawnAt: WHEN }),
    ).toBe(WHEN);
  });

  test("the application's own timestamp wins when both exist", () => {
    expect(
      applicationWithdrawnAt({ withdrawnAt: WHEN }, { withdrawnAt: LATER }),
    ).toBe(WHEN);
  });

  test("nothing withdrawn means null", () => {
    expect(
      applicationWithdrawnAt({ withdrawnAt: null }, { withdrawnAt: null }),
    ).toBeNull();
  });
});

describe("canReapply", () => {
  const withdrawn = { withdrawnAt: WHEN };
  const active = { withdrawnAt: null };
  const standingStudent = { withdrawnAt: null };

  test("a withdrawn application on a live opening can be re-applied", () => {
    expect(canReapply("live", withdrawn, standingStudent)).toBe(true);
  });

  test("never on a closed or draft opening", () => {
    expect(canReapply("closed", withdrawn, standingStudent)).toBe(false);
    expect(canReapply("draft", withdrawn, standingStudent)).toBe(false);
  });

  test("never for an application that is not withdrawn", () => {
    expect(canReapply("live", active, standingStudent)).toBe(false);
  });

  test("never when the whole registration is withdrawn", () => {
    expect(canReapply("live", withdrawn, { withdrawnAt: WHEN })).toBe(false);
  });
});

describe("reapplyResetsScore", () => {
  test("switching CVs throws the old score away", () => {
    expect(reapplyResetsScore(1, 2)).toBe(true);
  });

  test("re-applying with the same CV keeps the score", () => {
    expect(reapplyResetsScore(2, 2)).toBe(false);
  });

  test("a legacy application with no snapshot resets on any re-apply", () => {
    expect(reapplyResetsScore(null, 1)).toBe(true);
  });
});
