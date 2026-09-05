import { describe, expect, test } from "vitest";
import { parseCsv, parseCsvRecords, pick, toCsv } from "./csv";

type Row = { name: string; cgpa: string; skills: string[] };

const COLUMNS = [
  { header: "Name", value: (r: Row) => r.name },
  { header: "CGPA", value: (r: Row) => r.cgpa },
  { header: "Skills", value: (r: Row) => r.skills },
];

describe("toCsv", () => {
  test("writes a header row and one row per record", () => {
    const csv = toCsv([{ name: "Asha", cgpa: "8.10", skills: ["Python"] }], COLUMNS);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Name,CGPA,Skills");
    expect(lines[1]).toBe("Asha,8.10,Python");
  });

  test("starts with a BOM so Excel reads UTF-8", () => {
    const csv = toCsv([], COLUMNS);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  test("joins array cells with a semicolon", () => {
    const csv = toCsv([{ name: "A", cgpa: "9", skills: ["ROS", "C++"] }], COLUMNS);
    expect(csv).toContain("ROS; C++");
  });

  test("quotes cells containing a comma", () => {
    const csv = toCsv([{ name: "Patil, Neha", cgpa: "7", skills: [] }], COLUMNS);
    expect(csv).toContain('"Patil, Neha"');
  });

  test("doubles embedded quotes", () => {
    const csv = toCsv([{ name: 'She said "hi"', cgpa: "7", skills: [] }], COLUMNS);
    expect(csv).toContain('"She said ""hi"""');
  });

  test("neutralises a formula so Excel cannot execute it", () => {
    const csv = toCsv(
      [{ name: "=HYPERLINK(\"http://evil\")", cgpa: "7", skills: [] }],
      COLUMNS,
    );
    // Prefixed with an apostrophe, and quoted because it contains a quote.
    expect(csv).toContain("'=HYPERLINK");
  });

  test.each(["=", "+", "-", "@"])(
    "neutralises a cell beginning with %s",
    (prefix) => {
      const csv = toCsv(
        [{ name: `${prefix}cmd`, cgpa: "7", skills: [] }],
        COLUMNS,
      );
      expect(csv).toContain(`'${prefix}cmd`);
    },
  );

  test("leaves ordinary cells untouched", () => {
    const csv = toCsv([{ name: "Ravi", cgpa: "8.00", skills: [] }], COLUMNS);
    expect(csv).toContain("Ravi,8.00,");
    expect(csv).not.toContain("'Ravi");
  });

  test("renders null and undefined as empty cells", () => {
    const csv = toCsv([{ a: null, b: undefined }], [
      { header: "A", value: (r: { a: null; b: undefined }) => r.a },
      { header: "B", value: (r: { a: null; b: undefined }) => r.b },
    ]);
    expect(csv.replace(/^﻿/, "").trim().split("\r\n")[1]).toBe(",");
  });
});

describe("parseCsv", () => {
  test("parses a simple file", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("handles quoted fields containing commas", () => {
    expect(parseCsv('name,co\n"Patil, Neha",Oracle\n')).toEqual([
      ["name", "co"],
      ["Patil, Neha", "Oracle"],
    ]);
  });

  test("handles escaped quotes", () => {
    expect(parseCsv('a\n"say ""hi"""\n')).toEqual([["a"], ['say "hi"']]);
  });

  test("handles a newline inside a quoted field", () => {
    expect(parseCsv('a,b\n"line1\nline2",x\n')).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  test("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("strips a leading BOM", () => {
    expect(parseCsv("﻿a,b\n1,2\n")[0]).toEqual(["a", "b"]);
  });

  test("drops blank rows", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvRecords", () => {
  test("normalises header spelling", () => {
    const records = parseCsvRecords("Full_Name,COMPANY\nNeha,Oracle\n");
    expect(records[0]).toEqual({ "full name": "Neha", company: "Oracle" });
  });

  test("returns nothing for a header-only file", () => {
    expect(parseCsvRecords("a,b\n")).toEqual([]);
  });

  test("tolerates rows shorter than the header", () => {
    const records = parseCsvRecords("a,b,c\n1,2\n");
    expect(records[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});

describe("pick", () => {
  test("returns the first non-empty match", () => {
    const record = { name: "", "full name": "Neha" };
    expect(pick(record, "name", "full name")).toBe("Neha");
  });

  test("returns undefined when nothing matches", () => {
    expect(pick({ a: "1" }, "b", "c")).toBeUndefined();
  });
});
