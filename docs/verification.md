# Momentum verification record

This records checks performed in the managed Linux workspace on November 11, 2026. It is engineering evidence for the release candidate, not an App Store approval or a signed native build.

## Automated and browser checks

- **64 Node tests:** preparation content and role detection, grounded drafts, negotiation arithmetic, document bounds, legacy migration, storage recovery, backup validation, SSRF protections, service authorization, rate limits, AI consent and provider response validation.
- **Production build:** Vite bundles the application, deferred PDF/Word readers, local fonts, public policies and generated license notices. The generated service worker caches known static assets only. Production HTML includes a content-security policy; API responses and candidate content are not put in the service-worker cache.
- **Chromium 156, full production journey:** PDF job import, Word résumé import, profile drafts, course completion and knowledge checks, story/research notes, all eight interview questions, interrupted draft recovery, previous-round history, application typing, application tracking, monthly/annual offer arithmetic, edited negotiations, signing checklist, workspace export, delete and restore.
- **Offline Chromium:** fresh production installation and reload retain the saved practice draft. Privacy and support pages remain reachable offline. A discovered `Vary: Origin` static-cache mismatch was fixed and retested.
- **WebKit 26.5, online:** the same main journey, PDF/Word parsing, storage, export/restore, populated mobile views, damaged-storage recovery, sample workspace and public pages passed. The test environment used locally extracted runtime libraries; this is a Linux WebKit browser, not an iPhone.
- **Optional AI UI, fixture responses:** no request is sent before consent; web research starts unselected and changing its choice clears consent; citations are rendered as safe external links; the research brief appends to notes and survives reload. Provider responses were mocked. No live OpenAI request was made.
- **Accessibility:** axe-core WCAG 2 A/AA and WCAG 2.1 AA checks found no automated violations in 27 desktop/mobile states, including empty and populated views, job intake, preparation tabs, an interview in progress and mobile navigation. This does not replace VoiceOver, text-scaling or usability testing.
- **Responsive layout:** populated routes were checked at 320×568, 375×667, 390×844, 844×390 and 1024×768, with desktop workflows at 1440px. No horizontal page overflow was found. Privacy/support pages were also checked at 320, 390 and 1440px.
- **Dependencies and formatting:** production dependency audit reported zero known vulnerabilities at the time checked. Prettier checks and `git diff --check` pass. An audit is a point-in-time dependency check, not a security certification.

## Native packaging evidence

Capacitor iOS sync succeeds. The Xcode project is present with Momentum branding, the final opaque 1024px icon, bundled app assets, four registered native plugins and a privacy manifest. Project/plist/storyboard structure has been checked. No development-server URL, model key, service secret or ATS exception is baked into the native configuration.

The deployment target is iOS 18. PDF.js's current legacy build officially supports Safari 18 or later; a synthetic older-API test showed that the legacy build alone does not establish iOS 15 support. The native minimum was raised to the documented supported baseline. Application code also avoids newer `Object.hasOwn`, `Array.at` and regular-expression lookbehind requirements, but these compatibility changes are not a claim that the PDF dependency supports older Safari. Actual minimum-device behavior remains a physical-device release check. Export-compliance answers must be completed for the final binary; the repository does not pre-answer that owner declaration in Info.plist.

## Unverified or intentionally absent

- No macOS/Xcode compilation, signed archive, physical iPhone installation, VoiceOver pass or TestFlight upload was possible in this Linux environment.
- WebKit's Playwright offline emulation returned an internal reload error even for an isolated synthetic service worker that performs no network/cache operations. Chromium passed that baseline. WebKit offline behavior is therefore **unverified**, not passed; check Safari/Home Screen and the native bundle on a real device.
- A real public HTML import succeeded through the controlled environment proxy. Live OpenAI coaching and public web research remain unverified because no provider credential is configured.
- The authenticated production gateway, production service hosting, public policy URLs and private operator contact require deployment configuration. Online AI and web research are disabled by default.
- LinkedIn/Indeed account connections, automatic profile edits and automatic application submission are not implemented. Momentum creates materials and tracks the user's own submissions.

Use [release.md](release.md) for the remaining release gates and [app-store.md](app-store.md) for the listing/review draft. Browser screenshots are product previews, not a substitute for screenshots captured from the signed release build.
