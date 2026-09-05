import { describe, expect, it } from "vitest";
import { selectOrphanedBlobs, type BlobSummary } from "./orphaned-resumes";

/**
 * These guard a destructive operation. Every test here is really asking the
 * same question: can this delete a resume somebody still needs?
 */

const NOW = new Date("2026-08-22T12:00:00Z");
const GRACE_MS = 24 * 60 * 60 * 1000;

function blob(pathname: string, hoursAgo: number): BlobSummary {
  return {
    pathname,
    uploadedAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000),
  };
}

describe("selectOrphanedBlobs", () => {
  it("deletes an old blob that no student row references", () => {
    const result = selectOrphanedBlobs({
      blobs: [blob("abandoned.pdf", 48)],
      referencedKeys: new Set(),
      now: NOW,
      graceMs: GRACE_MS,
    });

    expect(result).toEqual(["abandoned.pdf"]);
  });

  it("never deletes a referenced blob, however old", () => {
    const result = selectOrphanedBlobs({
      blobs: [blob("in-use.pdf", 24 * 365)],
      referencedKeys: new Set(["in-use.pdf"]),
      now: NOW,
      graceMs: GRACE_MS,
    });

    expect(result).toEqual([]);
  });

  /**
   * The dangerous case: a student picked a file two minutes ago and is still
   * typing. The blob is real, unreferenced, and must survive.
   */
  it("never deletes a blob inside the grace period", () => {
    const result = selectOrphanedBlobs({
      blobs: [blob("still-filling-the-form.pdf", 0.03)],
      referencedKeys: new Set(),
      now: NOW,
      graceMs: GRACE_MS,
    });

    expect(result).toEqual([]);
  });

  it("treats the grace boundary as exclusive — exactly 24h old survives", () => {
    const result = selectOrphanedBlobs({
      blobs: [blob("boundary.pdf", 24)],
      referencedKeys: new Set(),
      now: NOW,
      graceMs: GRACE_MS,
    });

    expect(result).toEqual([]);
  });

  it("separates orphans from the rest in a mixed set", () => {
    const result = selectOrphanedBlobs({
      blobs: [
        blob("orphan-old.pdf", 72),
        blob("referenced-old.pdf", 72),
        blob("orphan-but-recent.pdf", 1),
        blob("another-orphan.pdf", 25),
      ],
      referencedKeys: new Set(["referenced-old.pdf"]),
      now: NOW,
      graceMs: GRACE_MS,
    });

    expect(result.sort()).toEqual(["another-orphan.pdf", "orphan-old.pdf"]);
  });

  /**
   * The store holds JD documents as well as resumes, and the sweep scans the
   * whole store — a JD's key must protect it exactly like a resume's does.
   * (The caller's referenced set unions job_openings.jd_blob_key for this.)
   */
  it("never deletes a referenced JD blob, however old", () => {
    const result = selectOrphanedBlobs({
      blobs: [blob("jd/backend-intern.pdf", 72), blob("jd/stale-orphan.pdf", 72)],
      referencedKeys: new Set(["jd/backend-intern.pdf"]),
      now: NOW,
      graceMs: GRACE_MS,
    });

    expect(result).toEqual(["jd/stale-orphan.pdf"]);
  });

  it("returns nothing for an empty store", () => {
    expect(
      selectOrphanedBlobs({
        blobs: [],
        referencedKeys: new Set(),
        now: NOW,
        graceMs: GRACE_MS,
      }),
    ).toEqual([]);
  });

  /**
   * If the reference query somehow returned nothing when rows do exist, a naive
   * implementation would delete every resume in the store. Callers must pass a
   * verified set — this test documents that the function itself cannot tell,
   * which is why the caller aborts on a suspicious read.
   */
  it("deletes every old blob when told nothing is referenced", () => {
    const result = selectOrphanedBlobs({
      blobs: [blob("a.pdf", 48), blob("b.pdf", 48)],
      referencedKeys: new Set(),
      now: NOW,
      graceMs: GRACE_MS,
    });

    expect(result.sort()).toEqual(["a.pdf", "b.pdf"]);
  });
});
