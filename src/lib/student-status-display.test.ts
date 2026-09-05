import { describe, expect, test } from "vitest";
import {
  studentVisibleStatus,
  type StudentStatus,
} from "./student-status-display";

/**
 * The invariant: internal pipeline stages must never leak to a student.
 * Every enum value maps to one of exactly three student-facing labels.
 */

const ALL_STATUSES: StudentStatus[] = [
  "registered",
  "screened",
  "shortlisted",
  "interviewed",
  "selected",
  "rejected",
];

describe("studentVisibleStatus", () => {
  test("every status maps to a label, a tone and a detail sentence", () => {
    for (const status of ALL_STATUSES) {
      const shown = studentVisibleStatus(status);
      expect(shown.label.length).toBeGreaterThan(0);
      expect(shown.detail.length).toBeGreaterThan(0);
      expect(["neutral", "positive", "critical"]).toContain(shown.tone);
    }
  });

  test("pre-decision stages all read as Under review", () => {
    for (const status of ["registered", "screened", "interviewed"] as const) {
      expect(studentVisibleStatus(status).label).toBe("Under review");
      expect(studentVisibleStatus(status).tone).toBe("neutral");
    }
  });

  test("internal stage names never appear in any student-facing text", () => {
    for (const status of ALL_STATUSES) {
      const shown = studentVisibleStatus(status);
      const text = `${shown.label} ${shown.detail}`.toLowerCase();
      expect(text).not.toContain("screened");
      expect(text).not.toContain("interviewed");
    }
  });

  test("decisions carry their own labels and tones", () => {
    expect(studentVisibleStatus("shortlisted")).toMatchObject({
      label: "Shortlisted",
      tone: "positive",
    });
    expect(studentVisibleStatus("selected")).toMatchObject({
      label: "Selected",
      tone: "positive",
    });
    expect(studentVisibleStatus("rejected")).toMatchObject({
      label: "Not selected",
      tone: "critical",
    });
  });
});
