# Momentum verification record

This records completed engineering checks for Momentum's release candidate. Most local checks run in the managed Linux workspace; native compilation uses the separate GitHub macOS workflow. This is not App Store approval or evidence of a signed native build.

Latest completed local pass: **82 Node tests**, `npm run native:sync`, and generated web release **`341fdc49b0e6`**. The full Chromium/WebKit/accessibility regression and cross-tab regression for the latest UI changes are running; their earlier completed baseline is recorded below. Unsigned native compilation passed for source commit `ea7b1da`; the final delivery revision still needs its own compile result.

## Automated and browser checks

- **82 Node tests:** preparation content and role detection, grounded drafts, negotiation arithmetic, document bounds, legacy migration, storage recovery, backup validation, saved coaching-note limits/round trips, SSRF protections, service authorization, rate/concurrency limits, deployment boundaries, AI consent and provider response validation.
- **Production build:** Vite bundles the application, deferred PDF/Word readers, local fonts, public policies and generated license notices. The generated service worker caches known static assets only. Production HTML includes a content-security policy; API responses and candidate content are not put in the service-worker cache.
- **Chromium 156, full production journey:** PDF job import, Word résumé import, profile drafts, course completion and knowledge checks, story/research notes, all eight interview questions, interrupted draft recovery, previous-round history, application typing, application tracking, monthly/annual offer arithmetic, edited negotiations, signing checklist, workspace export, delete and restore.
- **Offline Chromium:** fresh production installation and reload retain the saved practice draft. Privacy and support pages remain reachable offline. A discovered `Vary: Origin` static-cache mismatch was fixed and retested.
- **WebKit 26.5, online:** the same main journey, PDF/Word parsing, storage, export/restore, populated mobile views, damaged-storage recovery, sample workspace and public pages passed. The test environment used locally extracted runtime libraries; this is a Linux WebKit browser, not an iPhone.
- **Optional AI UI, fixture responses:** the expanded coaching flow passed consent and context resets, selected-lesson/application/offer context, safe source links, and saving/reloading reviewed coaching notes. Web research starts unselected and changing its choice clears consent; the research brief can append to user notes. Profile import/edit contracts also passed. Provider responses were mocked. No live OpenAI request was made.
- **Accessibility:** axe-core WCAG 2 A/AA and WCAG 2.1 AA checks found no automated violations in 27 desktop/mobile states, including empty and populated views, job intake, preparation tabs, an interview in progress and mobile navigation. This does not replace VoiceOver, text-scaling or usability testing.
- **Responsive layout:** populated routes were checked at 320×568, 375×667, 390×844, 844×390 and 1024×768, with desktop workflows at 1440px. No horizontal page overflow was found. Privacy/support pages were also checked at 320, 390 and 1440px.
- **Dependencies and formatting:** production dependency audit reported zero known vulnerabilities at the time checked. Prettier checks and `git diff --check` pass. An audit is a point-in-time dependency check, not a security certification.

## Service and container evidence

The deployment package in commit [`3a377b1`](https://github.com/Shai-Mate/nextstep-interview-studio/commit/3a377b1) was built and run locally. The multi-stage Docker build succeeded; a non-root container started with a read-only filesystem, all Linux capabilities dropped and `no-new-privileges`. The container health check and `server/smoke.mjs` passed against the loopback-published service. The smoke verifies the built app/API routes, readiness, MIME/cache/security headers and inaccessible private paths; it does not call an AI provider or import an external page.

The backend/deployment subset passed 28 tests, including static traversal/symlink restrictions, bounded concurrency and large Unicode payload handling. Caddy's HTTPS configuration and the Compose configuration validated. Caddy validation used no network; public deployment, DNS, ACME certificate issuance and an internet-facing service were **not** verified. Use [deployment.md](deployment.md) for the remaining operator preflight.

## Native packaging evidence

Capacitor iOS sync succeeds. The Xcode project is present with Momentum branding, the final opaque 1024px icon, bundled app assets, four registered native plugins and a privacy manifest. Project/plist/storyboard structure has been checked. No development-server URL, model key, service secret or ATS exception is baked into the native configuration.

The [GitHub macOS run 43003354634](https://github.com/Shai-Mate/nextstep-interview-studio/actions/runs/43003354634) successfully compiled an **unsigned generic-device Release build** from source commit `ea7b1da` using **Xcode 26.6**. That commit aligns the generated iOS 18 package with Swift tools 6. The result validates compilation of that source revision; the newer uncommitted UI changes are not covered by this run. The final delivery revision must receive its own compile result. This is not a signed archive, device installation or App Store upload. See [ios-build.md](ios-build.md) for the retained evidence and repeatable procedure.

The deployment target is iOS 18. PDF.js's current legacy build officially supports Safari 18 or later; a synthetic older-API test showed that the legacy build alone does not establish iOS 15 support. The native minimum was raised to the documented supported baseline. Application code also avoids newer `Object.hasOwn`, `Array.at` and regular-expression lookbehind requirements, but these compatibility changes are not a claim that the PDF dependency supports older Safari. Actual minimum-device behavior remains a physical-device release check. Export-compliance answers must be completed for the final binary; the repository does not pre-answer that owner declaration in Info.plist.

## Unverified or intentionally absent

- The final delivery revision has not yet supplied its own native compile result; the successful unsigned compile is tied to `ea7b1da`. No signed archive, physical iPhone installation, VoiceOver pass or TestFlight upload has been verified.
- WebKit's Playwright offline emulation returned an internal reload error even for an isolated synthetic service worker that performs no network/cache operations. Chromium passed that baseline. WebKit offline behavior is therefore **unverified**, not passed; check Safari/Home Screen and the native bundle on a real device.
- A real public HTML import succeeded through the controlled environment proxy. Live OpenAI coaching and public web research remain unverified because no provider credential is configured.
- The owner still needs a Prism Apple Developer identity/signing setup, permanent bundle-ID confirmation, complete public policy/support URLs and a real private operator contact. The authenticated production AI gateway and live provider configuration are not included in the successful local-container checks. Online AI and web research are disabled by default.
- LinkedIn/Indeed account connections, automatic profile edits and automatic application submission are not implemented. Momentum creates materials and tracks the user's own submissions.

Use [release.md](release.md) for the remaining release gates and [app-store.md](app-store.md) for the listing/review draft. Browser screenshots are product previews, not a substitute for screenshots captured from the signed release build.
