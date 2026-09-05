import { describe, expect, test } from "vitest";
import { REGISTRATION } from "./content";
import {
  fieldErrors,
  jobOpeningSchema,
  partnerSchema,
  resumeUploadSchema,
  studentRegistrationSchema,
} from "./validation";

/** A minimal registration that should always pass. */
function validRegistration(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Asha Deshmukh",
    email: "Asha.Deshmukh@Example.com",
    phone: "+91 98765 43210",
    branch: "CS",
    programme: "B.Tech",
    year: "3rd year",
    cgpa: "7.85",
    focusArea: "core_dev",
    skills: ["Python", "ROS"],
    resumeBlobKey: "resumes/abc123-xyz.pdf",
    resumeFilename: "asha.pdf",
    resumeBytes: 240_000,
    consent: true,
    website: "",
    ...overrides,
  };
}

describe("studentRegistrationSchema", () => {
  test("accepts a complete, valid registration", () => {
    const result = studentRegistrationSchema.safeParse(validRegistration());
    expect(result.success).toBe(true);
  });

  test("normalises email to lowercase", () => {
    const result = studentRegistrationSchema.parse(validRegistration());
    expect(result.email).toBe("asha.deshmukh@example.com");
  });

  test("strips the +91 prefix and spacing from a phone number", () => {
    const result = studentRegistrationSchema.parse(validRegistration());
    expect(result.phone).toBe("9876543210");
  });

  test("accepts a bare 10-digit number and a 0-prefixed number", () => {
    for (const input of ["9876543210", "09876543210", "91 9876543210"]) {
      const result = studentRegistrationSchema.parse(
        validRegistration({ phone: input }),
      );
      expect(result.phone).toBe("9876543210");
    }
  });

  test("rejects a phone number that does not start 6-9", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ phone: "5876543210" }),
    );
    expect(result.success).toBe(false);
  });

  test("returns CGPA as a fixed-2 string, never a float", () => {
    const result = studentRegistrationSchema.parse(
      validRegistration({ cgpa: "8" }),
    );
    expect(result.cgpa).toBe("8.00");
    expect(typeof result.cgpa).toBe("string");
  });

  test("accepts CGPA at both boundaries", () => {
    for (const value of ["0", "10", "10.00"]) {
      const result = studentRegistrationSchema.safeParse(
        validRegistration({ cgpa: value }),
      );
      expect(result.success).toBe(true);
    }
  });

  test("rejects CGPA above 10", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ cgpa: "10.01" }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a non-numeric CGPA", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ cgpa: "seven" }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects an unknown branch code", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ branch: "MECH" }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects an unknown focus area", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ focusArea: "quantum" }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects the openings-only 'all' focus area — students pick a real pool", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ focusArea: "all" }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a resume above the size cap", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ resumeBytes: REGISTRATION.resumeMaxBytes + 1 }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a registration with no resume key", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ resumeBlobKey: "" }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a registration without consent", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ consent: false }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a submission where the honeypot was filled", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ website: "http://spam.example" }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a branch that belongs to the other programme", () => {
    const result = studentRegistrationSchema.safeParse(
      // CE-MT is an MBA.Tech branch, submitted here against B.Tech.
      validRegistration({ programme: "B.Tech", branch: "CE-MT" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error).branch).toMatch(/MBA\.Tech branch/);
  });

  test("accepts a matching MBA.Tech programme and branch", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ programme: "MBA.Tech", branch: "CE-MT" }),
    );
    expect(result.success).toBe(true);
  });

  test("rejects more than 12 skills", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ skills: Array.from({ length: 13 }, (_, i) => `s${i}`) }),
    );
    expect(result.success).toBe(false);
  });
});

describe("resumeUploadSchema", () => {
  test("accepts a PDF within the size cap", () => {
    const result = resumeUploadSchema.safeParse({
      filename: "resume.pdf",
      contentType: "application/pdf",
      size: 1_000_000,
    });
    expect(result.success).toBe(true);
  });

  test("rejects a non-PDF content type", () => {
    const result = resumeUploadSchema.safeParse({
      filename: "resume.docx",
      contentType: "application/msword",
      size: 1_000,
    });
    expect(result.success).toBe(false);
  });

  test("rejects a file above the size cap", () => {
    const result = resumeUploadSchema.safeParse({
      filename: "resume.pdf",
      contentType: "application/pdf",
      size: REGISTRATION.resumeMaxBytes + 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("partnerSchema", () => {
  const valid = {
    companyName: "Example Robotics Co.",
    website: "",
    contactName: "Ravi Kulkarni",
    contactEmail: "ravi@example.com",
    contactPhone: "",
    stipendMin: "5000",
    ppoTrack: true,
    problemTitle: "Autonomous indoor navigation",
    problemDescription:
      "We want candidates assessed on building a navigation stack for an indoor drone using onboard sensing only.",
    focusArea: ["robotics"],
    companyFax: "",
  };

  test("accepts a complete partner submission", () => {
    expect(partnerSchema.safeParse(valid).success).toBe(true);
  });

  test("accepts more than one focus area", () => {
    const result = partnerSchema.safeParse({
      ...valid,
      focusArea: ["robotics", "aiml"],
    });
    expect(result.success).toBe(true);
  });

  test("rejects no focus area selected", () => {
    const result = partnerSchema.safeParse({ ...valid, focusArea: [] });
    expect(result.success).toBe(false);
  });

  test("coerces the stipend to a number", () => {
    const result = partnerSchema.parse(valid);
    expect(result.stipendMin).toBe(5000);
  });

  test("treats an empty stipend as undefined rather than zero", () => {
    const result = partnerSchema.parse({ ...valid, stipendMin: "" });
    expect(result.stipendMin).toBeUndefined();
  });

  test("rejects a too-short problem description", () => {
    const result = partnerSchema.safeParse({
      ...valid,
      problemDescription: "Build a drone.",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a filled honeypot", () => {
    const result = partnerSchema.safeParse({ ...valid, companyFax: "bot" });
    expect(result.success).toBe(false);
  });
});

describe("jobOpeningSchema", () => {
  const valid = {
    title: "Backend Engineering",
    focusArea: "core_dev",
    description:
      "Design, build and maintain scalable server-side applications, robust APIs and core backend infrastructure.",
  };

  test("accepts a real focus area", () => {
    expect(jobOpeningSchema.safeParse(valid).success).toBe(true);
  });

  test("accepts 'all' — an opening may target every pool", () => {
    const result = jobOpeningSchema.safeParse({ ...valid, focusArea: "all" });
    expect(result.success).toBe(true);
  });

  test("no branches selected means all branches eligible", () => {
    const result = jobOpeningSchema.parse(valid);
    expect(result.eligibleBranches).toEqual([]);
  });
});

describe("fieldErrors", () => {
  test("maps each failing field to its first message", () => {
    const result = studentRegistrationSchema.safeParse(
      validRegistration({ cgpa: "99", email: "nope" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = fieldErrors(result.error);
    expect(errors.cgpa).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.fullName).toBeUndefined();
  });
});
