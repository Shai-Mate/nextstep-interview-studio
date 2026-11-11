# Momentum release checklist

This repository is a release candidate, not an App Store submission. A web build or a generated iOS project does not establish that the native app builds, works on an iPhone, or has passed App Review.

## Release gates

| Gate | Required evidence | Current status |
| --- | --- | --- |
| Production web build | Clean dependency install, automated checks, production build, browser smoke test | Build, Node checks and production Chromium end-to-end journey passed |
| Native scaffold | Packaged assets, native project configuration, icon, manifests and plugin sync | Capacitor build/sync and static project/plist validation passed; this is not an Xcode compile |
| Real-device quality | Current iPhone, supported older iPhone/iOS, iPad if distributed as universal, VoiceOver, text size, keyboard, resume after backgrounding, offline launch | Requires a physical-device pass |
| Native archive | Release archive built with current required Xcode/SDK, validated in Organizer | Requires macOS and Xcode |
| Apple identity | Prism-owned Developer Program membership, registered bundle ID, correct signing team, distribution profile | Requires the owner's Apple account |
| Public support and privacy | Live HTTPS pages, working support route, private privacy contact, policy matching deployed services | Public pages are included; production URLs and private contact must be finalized |
| Network service | Production HTTPS service, rate limits, abuse protection, provider contract/retention review, declared provider in consent | Live public-page import verified in development; AI has no configured live key; production authenticated gateway and operator details remain required |
| Store metadata | Accurate screenshots, description, age rating, privacy answers, export compliance, rights, review notes | Drafts are in `docs/app-store.md` |
| TestFlight | Uploaded archive installed and tested from TestFlight; reviewer can reach all advertised features | Requires signed upload |

Apple's [current upload requirements](https://developer.apple.com/news/upcoming-requirements/), checked November 10, 2026, require Xcode 26 or later and the iOS 26 SDK or later. Since September 9, 2026, iOS apps must target iOS 13 or later; Momentum uses iOS 18 as its deployment target, matching the bundled PDF reader's supported Safari baseline. Recheck these requirements on the actual submission date.

## Engineering verification

- The Node suite passed checks covering the preparation engine, storage/migration and optional service security/contract behavior. Run `npm test` for the current test inventory after later changes.
- The Vite production build and Capacitor iOS sync completed. The native project contains a 1024-pixel opaque app icon, bundled app assets, a privacy manifest and native sharing support. Xcode compilation, signing and archive validation have not run on this Linux host.
- A live public-page import succeeded using the managed environment's policy-enforcing outbound proxy. OpenAI tests use a mock provider; no live model request, public-search request or production AI deployment was verified. Optional professional web research is off by default, requires separate consent, excludes candidate profile/answer from its provider payload and requires provider-generated URL citations.
- The production Chromium suite in `tests/e2e.py` passed PDF job import, Word résumé import, profile edits and persistence, lessons/knowledge checks, story/research notes, the full eight-question mock with restart/history, application drafts, offer calculations, negotiation drafts, export/deletion/restore and saved-draft reload while offline.
- Corrected mobile testing seeded the workspace and reloaded the app before checking all seven populated views at 390 pixels; they showed no horizontal page overflow or runtime errors. Privacy and support pages passed 320-, 390- and 1440-pixel layout checks; the license page returned successfully. Damaged-storage originals were preserved. Screenshots are saved to `test-results/`.
- A production-dependency audit reported no known vulnerabilities at the time of the handoff. This does not replace security review or future dependency updates.
- Physical iPhone/iPad, Safari, VoiceOver and TestFlight validation remain open. An automated Chromium run cannot close these gates.

The shipped default experience uses local templates and writing checklists. The optional server does not include user authentication or an authorized production gateway; never embed its shared service token in the distributed client. Production online assistance is a separate release gate, not a hidden prerequisite for the local app.

## Native release procedure

1. Choose a permanent Prism-owned reverse-DNS bundle identifier. The scaffold's `com.prism.momentum` is provisional and must be checked against the owner's Apple account. Do this before publishing; a published app's bundle identifier cannot be changed. Do not substitute an unrelated developer's identifier.
2. On a Mac, install the required Xcode version and its command-line tools. Accept the license and select the intended Xcode installation. Install the project's documented Node version and dependencies with the lockfile.
3. Run `npm test`, the browser acceptance suite and `npm run native:sync`. Native sync runs the production build, including license-notice generation and the offline asset manifest. Inspect the generated native project after every plugin/dependency update. The generated `public/third-party-notices.txt` is bundled and linked from Settings, support and privacy pages; it includes dependency licenses and the SIL OFL 1.1 notices for the locally bundled DM Sans and Manrope fonts. Review any new dependency that lacks license text before distributing it.
4. Open the iOS project in Xcode. Set the Prism signing team, permanent bundle identifier, display name, version and monotonically increasing build number. Confirm the deployment target, device families, orientations and safe-area appearance.
5. Inspect `Info.plist`, entitlements and `PrivacyInfo.xcprivacy`. Declare only capabilities and required-reason APIs actually used. Review all bundled third-party SDK manifests. Do not add microphone, speech, photo-library or tracking permissions merely because a future feature might need them.
6. Confirm that the build contains packaged app assets and no development server URL, secrets, test accounts, sample private data, debug-only menus or unsupported claims. Client configuration may contain a public service origin; model API keys belong on the server.
7. Test a Release build on physical devices using the checklist below. Capture screenshots from the release build using fictional, clearly non-identifying sample content.
8. Archive for a generic iOS device. In Xcode Organizer, validate and distribute the archive to App Store Connect. Resolve upload warnings, including privacy-manifest and required-reason API warnings.
9. Install through TestFlight and repeat the critical journey. A simulator build is insufficient evidence for file pickers, sharing, keyboard behavior, storage persistence and offline use.
10. Complete App Store Connect metadata, attach the tested build and submit for review using the notes in `docs/app-store.md`. Keep any advertised service available during review.

## Real-device acceptance

- [ ] Fresh install opens into a clear useful first action; no account or paid service is required for local preparation.
- [ ] A new candidate can add a job from pasted text, complete profile details, and understand the next action without instruction.
- [ ] Document import handles supported formats and reports unsupported, empty, oversized and damaged files clearly.
- [ ] Optional URL import handles public HTML, redirects, denied/unsupported pages, timeouts, empty extraction and unavailable service. Pasting text remains available.
- [ ] Company/interviewer notes clearly distinguish user-provided evidence from generated suggestions. Unsupported personal or employer claims are never presented as research facts.
- [ ] Course progress, notes, application drafts and interrupted interview practice survive navigation, backgrounding, a force quit and relaunch.
- [ ] Mock practice can be completed, reviewed and restarted without accidentally losing a saved session.
- [ ] Export opens the system sharing or save UI and produces a recoverable file. Restore is validated, understandable and does not silently destroy current data.
- [ ] Delete controls explain their scope and remove the selected local data. A full reset does not leave candidate content visible after relaunch.
- [ ] Offline use works after installation; online-only features display an actionable offline state instead of a spinner that never ends.
- [ ] External employer and source links open safely. No third-party login credentials are requested or stored by Momentum.
- [ ] At large text size and 200% zoom, important content remains readable and primary controls remain reachable.
- [ ] VoiceOver announces navigation, headings, form labels, selected state, progress, dialogs and errors in a sensible order.
- [ ] Keyboard focus is visible; modal focus cannot escape; closing a modal returns focus to its trigger.
- [ ] Reduced Motion is respected; contrast is sufficient; status is never communicated by color alone.
- [ ] No personal text appears in network requests or console/server logs during local-only flows.
- [ ] Every network feature identifies what will be sent before consent. Declining leaves the local feature path usable.
- [ ] Privacy and support links open from both the app and App Store listing.

## App Review risks to resolve deliberately

The [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) require on-device testing and final content (2.1), accurate metadata (2.3), adequate lasting utility beyond a repackaged website (4.2), a real support contact (1.5), an accessible privacy policy (5.1.1), and explicit permission before sharing personal data with a third party, including an AI provider (5.1.2).

The local candidate workspace, persistent job pipeline, editable application materials, structured learning and resumable interview practice are the product's lasting utility. Describe and demonstrate those completed workflows; a wrapper alone does not satisfy 4.2. Apple decides whether the submitted product satisfies its rules.

Do not advertise automatic LinkedIn/Indeed profile editing, platform account connections, submission of applications, live employer research, salary-market verification, AI interviewing or job-placement guarantees unless the submitted build actually provides that capability and its access has been approved. User-reviewed drafts and interview technique checklists are useful features in their own right.

## After launch

Retain the exact source revision, dependency lockfile, archive, symbols, privacy answers and screenshots for every release. Monitor the published support route. Test migration using an export from the previous version before shipping a storage-schema change. Reassess privacy disclosures whenever a service, model provider, analytics SDK, purchase or account feature is introduced.
