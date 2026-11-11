import test from "node:test";
import assert from "node:assert/strict";
import { extractDocument, validateDocxArchive } from "../src/lib/documents.js";
function directory(entries) {
  const names = entries.map((e) => new TextEncoder().encode(e.name));
  const length = entries.reduce((sum, e, i) => sum + 46 + names[i].length, 0);
  const buffer = new ArrayBuffer(length + 22),
    view = new DataView(buffer);
  let offset = 0;
  entries.forEach((entry, i) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint32(offset + 24, entry.size, true);
    view.setUint16(offset + 28, names[i].length, true);
    new Uint8Array(buffer, offset + 46, names[i].length).set(names[i]);
    offset += 46 + names[i].length;
  });
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 16, 0, true);
  return buffer;
}
test("document import reads useful plain text without remote processing", async () => {
  const content =
    "My experience includes customer service and thoughtful communication.";
  assert.equal(
    await extractDocument(new File([content], "resume.txt")),
    content,
  );
});
test("document import rejects oversized, unsupported, and empty text files", async () => {
  await assert.rejects(
    extractDocument({ name: "big.txt", size: 6 * 1024 * 1024 }),
    /smaller than 5 MB/,
  );
  await assert.rejects(
    extractDocument(new File(["short"], "short.txt")),
    /selectable text/,
  );
  await assert.rejects(
    extractDocument(new File(["unsupported content"], "photo.png")),
    /PDF, Word/,
  );
});
test("Word directory validates document presence before unpacking", () => {
  assert.equal(
    validateDocxArchive(directory([{ name: "word/document.xml", size: 2000 }])),
    true,
  );
  assert.throws(
    () =>
      validateDocxArchive(directory([{ name: "unrelated.txt", size: 2000 }])),
    /not a readable Word/,
  );
  assert.throws(
    () => validateDocxArchive(new ArrayBuffer(10)),
    /damaged or unsupported/,
  );
});
test("Word expansion limits reject small archives with oversized contents", () => {
  assert.throws(
    () =>
      validateDocxArchive(
        directory([{ name: "word/document.xml", size: 21 * 1024 * 1024 }]),
      ),
    /expands to a large file/,
  );
  assert.throws(
    () =>
      validateDocxArchive(
        directory([
          { name: "word/document.xml", size: 16 * 1024 * 1024 },
          { name: "word/media/image.png", size: 16 * 1024 * 1024 },
        ]),
      ),
    /expands to a large file/,
  );
});

test("older browsers get an actionable PDF fallback before loading the reader", async () => {
  const original = Object.hasOwn;
  try {
    Object.hasOwn = undefined;
    await assert.rejects(
      extractDocument({ name: "resume.pdf", size: 100 }),
      /Safari 18 or later.*paste/,
    );
  } finally {
    Object.hasOwn = original;
  }
});
