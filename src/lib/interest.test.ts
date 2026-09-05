import { describe, expect, test } from "vitest";
import { parseInterest, toggleValue, type Interest } from "./interest";

describe("parseInterest", () => {
  test("reads the two explicit marks", () => {
    expect(parseInterest("true")).toBe(true);
    expect(parseInterest("false")).toBe(false);
  });

  test("an empty submission clears the mark", () => {
    expect(parseInterest("")).toBeNull();
  });

  test("a missing field is 'not reviewed', not 'passed'", () => {
    expect(parseInterest(null)).toBeNull();
    expect(parseInterest(undefined)).toBeNull();
  });

  // The failure direction that matters: junk must never read as approval.
  test("junk never parses as interested", () => {
    for (const value of [
      "TRUE",
      "True",
      "1",
      "yes",
      "on",
      0,
      1,
      true,
      {},
      [],
      new File([], "x"),
    ]) {
      expect(parseInterest(value)).not.toBe(true);
    }
  });
});

describe("toggleValue", () => {
  test("an unreviewed candidate can be marked either way", () => {
    expect(toggleValue(null, true)).toBe("true");
    expect(toggleValue(null, false)).toBe("false");
  });

  test("pressing the button you are already on clears it", () => {
    expect(toggleValue(true, true)).toBe("");
    expect(toggleValue(false, false)).toBe("");
  });

  test("pressing the opposite button switches the mark", () => {
    expect(toggleValue(false, true)).toBe("true");
    expect(toggleValue(true, false)).toBe("false");
  });

  // Round-trip: what the button submits is what the action stores.
  test("every toggle round-trips through parseInterest", () => {
    const states: Interest[] = [null, true, false];
    for (const current of states) {
      for (const target of [true, false]) {
        const submitted = toggleValue(current, target);
        const stored = parseInterest(submitted);
        expect(stored).toBe(current === target ? null : target);
      }
    }
  });
});
