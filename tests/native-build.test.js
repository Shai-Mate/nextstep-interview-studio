import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);

test("iOS 18 package generation uses a compatible PackageDescription version", async () => {
  const config = JSON.parse(
    await readFile(new URL("capacitor.config.json", projectRoot), "utf8"),
  );
  const configuredTools = config.experimental?.ios?.spm?.swiftToolsVersion;
  assert.ok(
    Number.parseFloat(configuredTools) >= 6,
    "Capacitor defaults to Swift tools 5.9, where the .v18 platform constant is unavailable",
  );
  const manifest = await readFile(
    new URL("ios/App/CapApp-SPM/Package.swift", projectRoot),
    "utf8",
  );
  const generatedTools = manifest.match(
    /^\/\/ swift-tools-version:\s*(\d+\.\d+)/,
  )?.[1];
  assert.equal(
    generatedTools,
    configuredTools,
    "Run native:sync after changing native configuration",
  );
  assert.match(manifest, /platforms:\s*\[\.iOS\(\.v18\)\]/);
});
