import { describe, expect, test } from "vitest";
import {
  canActForCompany,
  canReadResume,
  canReadStudentResume,
  type PolicyActor,
} from "./access-policy";

const admin: PolicyActor = { role: "admin", companyIds: [] };
const recruiterA: PolicyActor = { role: "recruiter", companyIds: [1] };
const recruiterAB: PolicyActor = { role: "recruiter", companyIds: [1, 2] };
const orphan: PolicyActor = { role: "recruiter", companyIds: [] };
const student: PolicyActor = { role: "student", companyIds: [] };

describe("canActForCompany", () => {
  test("an admin may act for any company", () => {
    expect(canActForCompany(admin, 1)).toBe(true);
    expect(canActForCompany(admin, 999)).toBe(true);
  });

  test("a recruiter may act for their own company", () => {
    expect(canActForCompany(recruiterA, 1)).toBe(true);
  });

  test("a recruiter may NOT act for another company", () => {
    expect(canActForCompany(recruiterA, 2)).toBe(false);
  });

  test("a recruiter with no membership may act for nothing", () => {
    expect(canActForCompany(orphan, 1)).toBe(false);
  });

  test("a recruiter in two companies may act for both, and no third", () => {
    expect(canActForCompany(recruiterAB, 1)).toBe(true);
    expect(canActForCompany(recruiterAB, 2)).toBe(true);
    expect(canActForCompany(recruiterAB, 3)).toBe(false);
  });
});

describe("canReadStudentResume", () => {
  test("an admin may read any resume, even one shared with nobody", () => {
    expect(canReadStudentResume(admin, [])).toBe(true);
    expect(canReadStudentResume(admin, [7])).toBe(true);
  });

  test("a recruiter may read a candidate who applied to their company", () => {
    expect(canReadStudentResume(recruiterA, [1])).toBe(true);
  });

  test("a recruiter may NOT read a candidate belonging only to another company", () => {
    expect(canReadStudentResume(recruiterA, [2])).toBe(false);
  });

  test("a shared candidate is readable by each company that has them", () => {
    expect(canReadStudentResume(recruiterA, [1, 2])).toBe(true);
    expect(
      canReadStudentResume({ role: "recruiter", companyIds: [2] }, [1, 2]),
    ).toBe(true);
  });

  test("a candidate who applied nowhere is unreadable by any recruiter", () => {
    expect(canReadStudentResume(recruiterA, [])).toBe(false);
    expect(canReadStudentResume(recruiterAB, [])).toBe(false);
  });

  test("a recruiter with no membership may read nothing", () => {
    expect(canReadStudentResume(orphan, [1])).toBe(false);
    expect(canReadStudentResume(orphan, [])).toBe(false);
  });
});

describe("fails closed", () => {
  // Guards against a future refactor that treats an empty membership list as
  // "unrestricted" — the classic direction this kind of bug goes.
  test("an empty recruiter membership never grants access anywhere", () => {
    for (const companyId of [0, 1, 2, 42]) {
      expect(canActForCompany(orphan, companyId)).toBe(false);
      expect(canReadStudentResume(orphan, [companyId])).toBe(false);
    }
  });
});

/**
 * A student is the default role for any signed-in account, so these are the
 * tests that stop a self-registered account from reading candidate PII.
 */
describe("students are denied everywhere", () => {
  test("a student may not act for any company", () => {
    expect(canActForCompany(student, 1)).toBe(false);
    expect(canActForCompany(student, 999)).toBe(false);
  });

  test("a student may not read any resume", () => {
    expect(canReadStudentResume(student, [])).toBe(false);
    expect(canReadStudentResume(student, [1])).toBe(false);
    expect(canReadStudentResume(student, [1, 2, 3])).toBe(false);
  });

  test("a student carrying a forged companyIds list is still denied", () => {
    const forged: PolicyActor = { role: "student", companyIds: [1, 2, 3] };
    expect(canActForCompany(forged, 1)).toBe(false);
    expect(canReadStudentResume(forged, [1])).toBe(false);
  });
});

/**
 * Regression tests for the disclosure fixed on 2026-09-03.
 *
 * The route used to decide read standing per-STUDENT while selecting the file
 * per-APPLICATION, and never joined the two. A recruiter who shared a single
 * applicant with a rival could pass the rival's openingId and be handed the CV
 * that student submitted to the rival. The 200/404 difference also let them
 * enumerate which rivals each candidate had applied to.
 *
 * Company 1 is the recruiter's own; company 2 is the rival. Both hold standing
 * on the student, because the student applied to both — that shared standing is
 * exactly what made the old check pass.
 */
describe("application-scoped resume reads", () => {
  const appliedToBoth = [1, 2];

  test("a recruiter may read the snapshot from their OWN opening", () => {
    expect(
      canReadResume(recruiterA, {
        scopedToOpening: true,
        owningCompanyId: 1,
        permittedCompanyIds: appliedToBoth,
      }),
    ).toBe(true);
  });

  test("a recruiter may NOT read the snapshot from a rival's opening", () => {
    expect(
      canReadResume(recruiterA, {
        scopedToOpening: true,
        owningCompanyId: 2,
        permittedCompanyIds: appliedToBoth,
      }),
    ).toBe(false);
  });

  test("standing over the student does not confer standing over the application", () => {
    // The old bug in one assertion: the student-level check passes...
    expect(canReadStudentResume(recruiterA, appliedToBoth)).toBe(true);
    // ...but the application-scoped read must still be refused.
    expect(
      canReadResume(recruiterA, {
        scopedToOpening: true,
        owningCompanyId: 2,
        permittedCompanyIds: appliedToBoth,
      }),
    ).toBe(false);
  });

  test("a nonexistent opening is refused, never widened to a whole-profile read", () => {
    expect(
      canReadResume(recruiterA, {
        scopedToOpening: true,
        owningCompanyId: null,
        permittedCompanyIds: appliedToBoth,
      }),
    ).toBe(false);
  });

  test("a recruiter in both companies may read either snapshot", () => {
    for (const owningCompanyId of [1, 2]) {
      expect(
        canReadResume(recruiterAB, {
          scopedToOpening: true,
          owningCompanyId,
          permittedCompanyIds: appliedToBoth,
        }),
      ).toBe(true);
    }
  });

  test("an admin may read any snapshot", () => {
    for (const owningCompanyId of [1, 2, 99]) {
      expect(
        canReadResume(admin, {
          scopedToOpening: true,
          owningCompanyId,
          permittedCompanyIds: appliedToBoth,
        }),
      ).toBe(true);
    }
  });

  test("a student is denied a scoped read even for an opening they applied to", () => {
    expect(
      canReadResume(student, {
        scopedToOpening: true,
        owningCompanyId: 1,
        permittedCompanyIds: appliedToBoth,
      }),
    ).toBe(false);
  });

  test("an orphaned recruiter is denied every scoped read", () => {
    for (const owningCompanyId of [1, 2]) {
      expect(
        canReadResume(orphan, {
          scopedToOpening: true,
          owningCompanyId,
          permittedCompanyIds: appliedToBoth,
        }),
      ).toBe(false);
    }
  });
});

describe("whole-profile resume reads are unchanged", () => {
  test("an unscoped read ignores the owning company entirely", () => {
    expect(
      canReadResume(recruiterA, {
        scopedToOpening: false,
        owningCompanyId: null,
        permittedCompanyIds: [1],
      }),
    ).toBe(true);
  });

  test("an unscoped read still requires standing on the student", () => {
    expect(
      canReadResume(recruiterA, {
        scopedToOpening: false,
        owningCompanyId: null,
        permittedCompanyIds: [2],
      }),
    ).toBe(false);
  });

  test("a student who has applied nowhere is readable only by an admin", () => {
    const request = {
      scopedToOpening: false,
      owningCompanyId: null,
      permittedCompanyIds: [] as number[],
    };
    expect(canReadResume(admin, request)).toBe(true);
    expect(canReadResume(recruiterA, request)).toBe(false);
  });
});
