import { describe, expect, it } from "vitest";
import {
  averageScoreLabel,
  checkEligibility,
  scoreBand,
  scoringPromptHash,
} from "./openings";

describe("scoreBand", () => {
  it("bands 80+ as strong, including the boundary", () => {
    expect(scoreBand(80)).toBe("strong");
    expect(scoreBand(100)).toBe("strong");
  });

  it("bands 60–79 as possible, including both boundaries", () => {
    expect(scoreBand(60)).toBe("possible");
    expect(scoreBand(79)).toBe("possible");
  });

  it("bands below 60 as weak", () => {
    expect(scoreBand(59)).toBe("weak");
    expect(scoreBand(0)).toBe("weak");
  });
});

describe("scoringPromptHash", () => {
  it("is stable for identical inputs", () => {
    expect(scoringPromptHash("desc", "prompt")).toBe(
      scoringPromptHash("desc", "prompt"),
    );
  });

  it("changes when either input changes", () => {
    const base = scoringPromptHash("desc", "prompt");
    expect(scoringPromptHash("desc2", "prompt")).not.toBe(base);
    expect(scoringPromptHash("desc", "prompt2")).not.toBe(base);
  });

  it("treats a missing screening prompt as distinct from text, not equal to any", () => {
    // The separator prevents ("ab", null) colliding with ("a", "b").
    expect(scoringPromptHash("ab", null)).not.toBe(scoringPromptHash("a", "b"));
    expect(scoringPromptHash("desc", null)).toBe(scoringPromptHash("desc", null));
  });

  it("changes when the JD file changes, and omitting it equals passing null", () => {
    const withoutJd = scoringPromptHash("desc", "prompt");
    expect(scoringPromptHash("desc", "prompt", null)).toBe(withoutJd);
    expect(scoringPromptHash("desc", "prompt", "jd/key.pdf")).not.toBe(withoutJd);
    expect(scoringPromptHash("desc", "prompt", "jd/other.pdf")).not.toBe(
      scoringPromptHash("desc", "prompt", "jd/key.pdf"),
    );
  });
});

describe("checkEligibility", () => {
  const student = { cgpa: "7.85", branch: "CS" };

  it("passes when there are no constraints", () => {
    expect(
      checkEligibility({ minCgpa: null, eligibleBranches: [] }, student),
    ).toEqual({ eligible: true });
  });

  it("enforces the CGPA floor, inclusive at the boundary", () => {
    expect(
      checkEligibility({ minCgpa: "7.85", eligibleBranches: [] }, student)
        .eligible,
    ).toBe(true);
    expect(
      checkEligibility({ minCgpa: "7.86", eligibleBranches: [] }, student)
        .eligible,
    ).toBe(false);
  });

  it("treats an empty branch list as all branches, a non-empty one as a whitelist", () => {
    expect(
      checkEligibility({ minCgpa: null, eligibleBranches: ["IT", "AIML"] }, student)
        .eligible,
    ).toBe(false);
    expect(
      checkEligibility({ minCgpa: null, eligibleBranches: ["CS"] }, student)
        .eligible,
    ).toBe(true);
  });

  it("reports the failed rule in the reason", () => {
    const failed = checkEligibility(
      { minCgpa: "9.00", eligibleBranches: [] },
      student,
    );
    expect(failed.eligible).toBe(false);
    if (!failed.eligible) expect(failed.reason).toContain("9.00");
  });
});

describe("averageScoreLabel", () => {
  it("returns an em dash when nothing is scored — never zero", () => {
    expect(averageScoreLabel([])).toBe("—");
    expect(averageScoreLabel([null, null])).toBe("—");
  });

  it("averages only the scores that exist", () => {
    expect(averageScoreLabel([80, null, 60])).toBe("70");
  });

  it("rounds to a whole number", () => {
    expect(averageScoreLabel([80, 61])).toBe("71");
  });
});
