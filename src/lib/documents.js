const MAX_SIZE = 5 * 1024 * 1024;

/** Inspect ZIP directory sizes before Word parsing so a small compressed file cannot expand without bounds. */
export function validateDocxArchive(buffer) {
  const view = new DataView(buffer);
  let end = -1;
  for (
    let offset = view.byteLength - 22;
    offset >= Math.max(0, view.byteLength - 65557);
    offset--
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0)
    throw new Error(
      "This Word document is damaged or unsupported. Try saving a new .docx copy.",
    );
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    expanded = 0,
    documentFound = false;
  if (entries > 3000)
    throw new Error(
      "This Word document contains too many items. Paste the relevant text instead.",
    );
  for (let index = 0; index < entries; index++) {
    if (
      offset + 46 > view.byteLength ||
      view.getUint32(offset, true) !== 0x02014b50
    )
      throw new Error(
        "This Word document could not be read. Try saving a new copy.",
      );
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    expanded += size;
    if (size > 20 * 1024 * 1024 || expanded > 30 * 1024 * 1024)
      throw new Error(
        "This Word document expands to a large file. Remove embedded images or paste the relevant text.",
      );
    if (offset + 46 + nameLength + extraLength + commentLength > end)
      throw new Error(
        "This Word document has an invalid file directory. Try saving a new copy.",
      );
    const name = new TextDecoder().decode(
      new Uint8Array(buffer, offset + 46, nameLength),
    );
    if (name === "word/document.xml") documentFound = true;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!documentFound)
    throw new Error(
      "This file is not a readable Word document. Use a .docx, PDF, or text file.",
    );
  return true;
}

export async function extractDocument(file) {
  if (!file) throw new Error("Choose a document first.");
  if (file.size > MAX_SIZE) throw new Error("Choose a file smaller than 5 MB.");
  const extension = file.name.split(".").pop().toLowerCase();
  let text = "";
  if (["txt", "md", "csv"].includes(extension)) text = await file.text();
  else if (extension === "pdf") {
    if (typeof Object.hasOwn !== "function")
      throw new Error(
        "PDF import needs a newer browser. Use Safari 18 or later, update your browser, or paste the document text instead.",
      );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const worker =
      await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    });
    const timer = setTimeout(() => loadingTask.destroy(), 25000);
    try {
      const pdf = await loadingTask.promise;
      if (pdf.numPages > 35)
        throw new Error("Choose a document with 35 pages or fewer.");
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) => item.str + (item.hasEOL ? "\n" : " "))
            .join(""),
        );
      }
      text = pages.join("\n\n");
    } catch (error) {
      if (error.name === "PasswordException")
        throw new Error(
          "This PDF needs a password. Use an unlocked copy or paste the text.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
      await loadingTask.destroy();
    }
  } else if (extension === "docx") {
    const buffer = await file.arrayBuffer();
    validateDocxArchive(buffer);
    const module = await import("mammoth/mammoth.browser.js");
    const mammoth = module.default || module;
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    text = result.value;
  } else throw new Error("Use a PDF, Word (.docx), or text document.");
  text = text.replace(/\u0000/g, "").trim();
  if (text.length < 20)
    throw new Error(
      "We couldn’t find enough selectable text. For a scanned document, copy its text here instead.",
    );
  if (text.length > 60000)
    throw new Error(
      "This document is too long. Use the relevant pages or paste a shorter excerpt.",
    );
  return text;
}
