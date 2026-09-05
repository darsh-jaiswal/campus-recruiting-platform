import { describe, expect, it } from "vitest";
import { savedDraftFrom, type SavedDraftRow } from "./saved-draft";

const ROW: SavedDraftRow = {
  fullName: "Asha Patil",
  phone: "9876543210",
  cgpa: "8.15",
  programme: "B.Tech",
  branch: "CS",
  year: "3rd year",
  focusArea: "aiml",
  skills: ["Python", "PyTorch"],
  resumeBlobKey: "resumes/abc123.pdf",
  resumeFilename: "asha-resume.pdf",
  resumeBytes: 123_456,
};

describe("savedDraftFrom", () => {
  it("maps a full pending row to form defaults, joining skills back to a comma list", () => {
    const draft = savedDraftFrom(ROW);

    expect(draft.values).toEqual({
      fullName: "Asha Patil",
      phone: "9876543210",
      cgpa: "8.15",
      programme: "B.Tech",
      branch: "CS",
      year: "3rd year",
      focusArea: "aiml",
      skills: "Python, PyTorch",
      consent: true,
    });
    expect(draft.resume).toEqual({
      key: "resumes/abc123.pdf",
      name: "asha-resume.pdf",
      bytes: 123_456,
    });
  });

  it("renders an empty skills array as an empty string, not a stray comma", () => {
    expect(savedDraftFrom({ ...ROW, skills: [] }).values.skills).toBe("");
  });

  it("returns no resume when the row has no blob key", () => {
    expect(savedDraftFrom({ ...ROW, resumeBlobKey: null }).resume).toBeNull();
  });

  it("returns no resume when stored bytes would fail submit validation", () => {
    // resumeBytes must be a positive int to pass the registration schema —
    // restoring a resume the form could not resubmit would strand the student.
    expect(savedDraftFrom({ ...ROW, resumeBytes: null }).resume).toBeNull();
    expect(savedDraftFrom({ ...ROW, resumeBytes: 0 }).resume).toBeNull();
  });

  it("falls back to a generic filename when none was stored", () => {
    expect(savedDraftFrom({ ...ROW, resumeFilename: null }).resume?.name).toBe(
      "resume.pdf",
    );
  });
});
