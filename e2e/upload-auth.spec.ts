import { expect, test } from "@playwright/test";

/**
 * The resume upload endpoint writes to the private blob store, so an identity
 * is required before a single byte lands. This is an API contract, not a page:
 * the anonymous answer must be 401 with a JSON error the form can display —
 * never a redirect (the client is an XHR, not a navigation) and never 2xx.
 */

test("anonymous resume upload is refused with 401 JSON", async ({ request }) => {
  const response = await request.post("/api/resume/upload", {
    multipart: {
      file: {
        name: "resume.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 not a real resume"),
      },
    },
  });

  expect(response.status()).toBe(401);

  const body = (await response.json()) as { error?: string; key?: string };
  expect(body.key).toBeUndefined();
  expect(body.error).toMatch(/sign in/i);
});
