import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directories = execFileSync(
  "npm",
  ["ls", "--omit=dev", "--all", "--parseable"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .slice(1);
const seen = new Set();
const sections = [];

function noticeFiles(directory, depth = 0) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.isFile() &&
      /^(licen[cs]e|copying|notice)(?:[._-]|$)/i.test(entry.name)
    )
      return [join(directory, entry.name)];
    if (
      entry.isDirectory() &&
      depth < 3 &&
      !["node_modules", ".git"].includes(entry.name)
    )
      return noticeFiles(join(directory, entry.name), depth + 1);
    return [];
  });
}

for (const directory of directories) {
  const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const identity = `${pkg.name}@${pkg.version}`;
  if (seen.has(identity)) continue;
  seen.add(identity);
  let files = noticeFiles(directory);
  const notices = [];
  if (!files.length && pkg.name === "isarray") {
    const readme = readFileSync(join(directory, "README.md"), "utf8");
    const start = readme.indexOf("## License");
    if (start < 0) throw new Error(`License section missing for ${identity}`);
    notices.push(
      `Source: README.md, License section\n\n${readme.slice(start).replace(/&lt;/g, "<").replace(/&gt;/g, ">")}`,
    );
  } else if (!files.length && pkg.name.startsWith("@napi-rs/canvas-")) {
    const parent = join(root, "node_modules/@napi-rs/canvas");
    const parentPackage = JSON.parse(
      readFileSync(join(parent, "package.json"), "utf8"),
    );
    if (pkg.version !== parentPackage.version)
      throw new Error(`Canvas license version mismatch: ${identity}`);
    notices.push(
      `Source: @napi-rs/canvas ${pkg.version} LICENSE (same project and release)\n\n${readFileSync(join(parent, "LICENSE"), "utf8")}`,
    );
  } else {
    if (!files.length)
      throw new Error(
        `No license text found for ${identity}; review this dependency before shipping.`,
      );
    for (const file of files.sort()) {
      let text = readFileSync(file, "utf8");
      if (pkg.name === "jszip" && /LICENSE\.markdown$/.test(file)) {
        // JSZip expressly permits choosing MIT instead of GPL. Preserve the
        // entire MIT grant and copyright while recording that choice here.
        const end = text.indexOf("\nGPL version 3");
        if (end < 0)
          throw new Error(
            "JSZip license format changed; review its licensing choice.",
          );
        text = `Momentum uses JSZip under its MIT option.\n\n${text.slice(0, end).trim()}`;
      }
      notices.push(`Source: ${relative(directory, file)}\n\n${text.trim()}`);
    }
  }
  if (pkg.name === "pako") {
    const source = readFileSync(join(directory, "lib/zlib/deflate.js"), "utf8");
    const header = source.match(/\/\/ \(C\)[\s\S]*?(?=\n\nvar )/)?.[0];
    if (!header)
      throw new Error(
        "Pako zlib notice format changed; review its attribution.",
      );
    notices.push(
      `Source: lib/zlib/deflate.js, zlib copyright and notice\n\n${header.replace(/^\/\/ ?/gm, "")}`,
    );
  }
  sections.push({
    identity,
    text: `${"=".repeat(72)}\n${identity}\nDeclared license: ${pkg.license || JSON.stringify(pkg.licenses || "See notices below")}\n${"=".repeat(72)}\n\n${notices.join("\n\n---\n\n")}\n`,
  });
}

for (const [name, filename] of [
  ["DM Sans", "dm-sans-license.txt"],
  ["Manrope", "manrope-license.txt"],
]) {
  const noticePath = join(root, "public/fonts", filename);
  const notice = readFileSync(noticePath, "utf8").replace(/\r\n/g, "\n").trim();
  sections.push({
    identity: `${name} font`,
    text: `${"=".repeat(72)}\n${name} font\nDeclared license: SIL Open Font License 1.1\nSource: public/fonts/${filename}\n${"=".repeat(72)}\n\n${notice}\n`,
  });
}

sections.sort((a, b) => a.identity.localeCompare(b.identity, "en"));
const header = `MOMENTUM BY PRISM — THIRD-PARTY NOTICES\n\nMomentum is built with open-source software. The notices below retain the\ncopyright and license information supplied by the installed production\ndependencies, including supporting libraries that may not be used by every\nplatform edition. These licenses apply to the named components, not to\nMomentum's original application code.\n\nGenerated from the installed dependency lockfile by:\n  node scripts/generate-notices.mjs\n\n`;
mkdirSync(join(root, "public"), { recursive: true });
const noticeText = header + sections.map((section) => section.text).join("\n");
writeFileSync(join(root, "public/third-party-notices.txt"), noticeText);
const escapeHTML = (value) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
writeFileSync(
  join(root, "public/licenses.html"),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#f5f6f0">
  <meta name="description" content="Open-source software and font licenses included with Momentum by Prism.">
  <title>Open-source licenses · Momentum</title>
  <link rel="stylesheet" href="./legal.css">
  <style>h1{font-size:clamp(30px,6vw,62px)}.notices{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px;margin:28px 0 36px;tab-size:2}@media(max-width:600px){.notices{padding:16px;font-size:12px}}</style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="./" aria-label="Momentum home">momentum</a>
    <a class="header-link" href="./">Back to Momentum →</a>
  </header>
  <main class="page" id="main">
    <div class="intro">
      <p class="eyebrow">Built with open-source software.</p>
      <h1>Acknowledgments<br>and licenses.</h1>
      <p class="lede">Momentum includes work from open-source projects and font designers. Their copyright notices and license terms are preserved below.</p>
    </div>
    <pre class="notices" aria-label="Third-party copyright notices and license terms">${escapeHTML(noticeText)}</pre>
    <a class="button-link" href="./">Back to Momentum <span aria-hidden="true">→</span></a>
  </main>
  <footer class="site-footer"><span>Momentum by Prism</span><a href="./support.html">Support</a><a href="./privacy.html">Privacy</a><a href="./licenses.html" aria-current="page">Open-source licenses</a></footer>
</body>
</html>
`,
);
console.log(
  `Generated plain-text and HTML notices for ${seen.size} production dependencies and 2 bundled fonts.`,
);
