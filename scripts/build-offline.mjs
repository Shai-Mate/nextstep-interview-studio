import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve("dist");
const htmlPath = path.join(root, "index.html");
const html = await readFile(htmlPath, "utf8");
const policy =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data: blob:; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
await writeFile(
  htmlPath,
  html.replace(
    "<head>",
    '<head>\n  <meta http-equiv=\"Content-Security-Policy\" content=\"' +
      policy +
      '\" />',
  ),
);
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    ),
  );
  return paths.flat();
}
const files = (await walk(root))
  .filter((p) => !p.endsWith("/sw.js"))
  .map((p) => path.relative(root, p).replaceAll(path.sep, "/"))
  .sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(path.join(root, file)));
const version = hash.digest("hex").slice(0, 12);
await writeFile(
  path.join(root, "sw.js"),
  `/* Momentum offline shell. No candidate data or API responses are cached. */
const CACHE='momentum-${version}';
const FILES=${JSON.stringify(files)};
const BASE=new URL('./',self.location.href);
const STATIC_URLS=new Set(FILES.map(file=>new URL(file,BASE).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new URL(file,BASE).href)))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('momentum-')||key.startsWith('nextstep-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==BASE.origin||url.pathname.includes('/api/')||!url.href.startsWith(BASE.href))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match(event.request,{ignoreVary:true})||cache.match(new URL('index.html',BASE).href,{ignoreVary:true});}));
  return;
 }
 if(!STATIC_URLS.has(url.href))return;
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true})).then(cached=>cached||fetch(event.request)));
});
`,
);
console.log(`Offline shell: ${files.length} files, release ${version}`);
