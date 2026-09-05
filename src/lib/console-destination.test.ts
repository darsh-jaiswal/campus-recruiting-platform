import { describe, expect, it } from "vitest";
import { consoleDestination } from "./console-destination";

describe("consoleDestination", () => {
  it("sends admins to the admin console", () => {
    expect(consoleDestination("admin")).toEqual({
      href: "/admin",
      label: "Admin console",
    });
  });

  it("sends recruiters straight to their job openings", () => {
    expect(consoleDestination("recruiter")).toEqual({
      href: "/portal/openings",
      label: "Recruiter portal",
    });
  });

  it("gives students and the signed-out no console", () => {
    expect(consoleDestination("student")).toBeNull();
    expect(consoleDestination(undefined)).toBeNull();
    expect(consoleDestination(null)).toBeNull();
  });

  it("treats junk metadata as no console, never a link", () => {
    expect(consoleDestination("ADMIN")).toBeNull();
    expect(consoleDestination(42)).toBeNull();
    expect(consoleDestination({ role: "admin" })).toBeNull();
  });
});
