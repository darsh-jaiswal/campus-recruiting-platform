import { describe, expect, test } from "vitest";
import {
  DECISION_STATUSES,
  shouldEmailStatus,
  statusEmailIdempotencyKey,
  statusEmailSubject,
} from "./status-emails";
import type { StudentStatus } from "./student-status-display";

const ALL_STATUSES: StudentStatus[] = [
  "registered",
  "screened",
  "shortlisted",
  "interviewed",
  "selected",
  "rejected",
];

describe("shouldEmailStatus", () => {
  test("only the three decisions notify", () => {
    const notifying = ALL_STATUSES.filter((status) =>
      shouldEmailStatus(status, null),
    );
    expect(notifying.sort()).toEqual([...DECISION_STATUSES].sort());
  });

  test("internal stages never notify", () => {
    for (const status of ["registered", "screened", "interviewed"] as const) {
      expect(shouldEmailStatus(status, null)).toBe(false);
    }
  });

  test("a withdrawn registration never gets decision mail", () => {
    for (const status of ALL_STATUSES) {
      expect(shouldEmailStatus(status, new Date())).toBe(false);
    }
  });
});

describe("statusEmailIdempotencyKey", () => {
  test("one key per decision and student", () => {
    expect(statusEmailIdempotencyKey("shortlisted", "AQ-ABC123")).toBe(
      "status-shortlisted/AQ-ABC123",
    );
    expect(statusEmailIdempotencyKey("selected", "AQ-ABC123")).not.toBe(
      statusEmailIdempotencyKey("rejected", "AQ-ABC123"),
    );
  });
});

describe("statusEmailSubject", () => {
  test("every decision has a subject and none leaks internal stage names", () => {
    for (const status of DECISION_STATUSES) {
      const subject = statusEmailSubject(status);
      expect(subject.length).toBeGreaterThan(0);
      expect(subject.toLowerCase()).not.toContain("screened");
    }
  });
});
