/**
 * CSV export and import.
 *
 * Exports are opened in Excel by the Placement Cell, which makes CSV formula
 * injection a real risk rather than a theoretical one: a student could set a
 * skill to `=HYPERLINK(...)` and have it execute on someone else's machine.
 * Every exported cell is neutralised.
 */

/** Cells starting with these are interpreted as formulas by Excel and Sheets. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function neutralise(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_PREFIXES.some((p) => value.startsWith(p)) ? `'${value}` : value;
}

function escapeCell(input: unknown): string {
  if (input === null || input === undefined) return "";

  const raw = Array.isArray(input) ? input.join("; ") : String(input);
  const safe = neutralise(raw);

  // Quote if the cell contains a delimiter, quote or newline.
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(","),
  );
  // BOM so Excel opens UTF-8 correctly — otherwise ₹ and accented names mangle.
  return `﻿${[head, ...body].join("\r\n")}\r\n`;
}

/* -------------------------------------------------------------------------
 * Import
 * ---------------------------------------------------------------------- */

/**
 * Minimal RFC 4180 parser — handles quoted fields, escaped quotes and
 * embedded newlines. Deliberately not a dependency: the alumni and Placement
 * Cell lists are small, well-formed exports, not arbitrary user CSV.
 */
export function parseCsv(text: string): string[][] {
  const withoutBom = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < withoutBom.length; i++) {
    const char = withoutBom[i];

    if (inQuotes) {
      if (char === '"') {
        if (withoutBom[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  // Trailing cell / row, when the file does not end with a newline.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/**
 * Parse into objects keyed by header, lowercased and whitespace-normalised so
 * "Full Name", "full name" and "FULL_NAME" all land on `full name`.
 */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0]!.map((h) =>
    h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "),
  );

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? "").trim();
    });
    return record;
  });
}

/** Pick the first present value among several possible header spellings. */
export function pick(
  record: Record<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value) return value;
  }
  return undefined;
}
