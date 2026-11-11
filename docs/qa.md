# Browser and data verification

Momentum includes automated tests for its local data model, preparation engine, optional service and document-import limits. Run `npm test` before a release.

## Browser journeys

Build and start the production preview:

```sh
npm run build
npm run preview -- --port 4173
```

With Python Playwright installed and Chromium available:

```sh
MOMENTUM_BASE_URL=http://127.0.0.1:4173 python tests/e2e.py
MOMENTUM_BASE_URL=http://127.0.0.1:4173 python tests/ai-flow.py
```

The main journey uses fictional data and exercises:

- PDF job-description and Word résumé import.
- Profile and editable draft persistence.
- Lesson notes, knowledge checks, stories and interviewer research.
- A complete eight-answer practice session, restart and archived answers.
- Application editing without losing keyboard focus and application tracking.
- Monthly salary normalization, separate equity, negotiation notes and checklists.
- Workspace export, confirmation-gated deletion and restored practice history.
- Offline navigation and in-progress answer recovery.
- Damaged-storage recovery that preserves the original data.
- Sample opportunities, all seven populated mobile views, and privacy/support pages.

The AI test replaces the health and coaching responses with explicit fixtures. It verifies consent, separate web-research opt-in, safe citation links, and saving research notes. **It does not verify a live AI provider, search quality, provider authentication or provider retention behavior.**

Screenshots and fictional downloaded backups are written to ignored `test-results/`. Set `MOMENTUM_ARTIFACT_DIR` to use a separate directory for a main-journey run. `CHROMIUM_PATH` overrides the Chromium executable. `MOMENTUM_BROWSER=webkit` uses an installed Playwright WebKit build; `MOMENTUM_WEBKIT_EXECUTABLE` can select a custom test launcher; it is not an iPhone simulator or a substitute for physical-device testing.

Development-only isolation flags `MOMENTUM_SKIP_OFFLINE=1` and `MOMENTUM_SKIP_PDF=1` skip the named checks. Do not count a run with those flags as full production acceptance.

## Recorded verification

The complete production journey passed in Chromium 156, including offline reload, offline privacy/support navigation, and populated mobile layouts. The same journey passed online in Playwright WebKit 26.5 with offline explicitly excluded. The mocked AI consent/research/save flow also passed in Chromium.

WebKit offline automation is unverified: Playwright’s Linux WebKit runner reports an internal navigation error when offline. A minimal reference service worker returning synthetic HTML, without Momentum code or network fetches, reproduces the same error; Chromium passes that reference. This result does not establish Safari or native offline behavior.

## Release limits

The native app requires iOS 18 or later, matching the current PDF.js legacy build’s Safari 18 baseline. Paste/text workflows are the fallback when PDF import is unavailable; older-browser PDF compatibility is not promised.

Chromium browser automation does not establish Safari, VoiceOver, native share-sheet or App Store signing behavior. Test the signed iOS build on physical devices, including the oldest supported iOS version, before submission. Live optional AI service behavior requires configured provider credentials and a controlled test deployment.

The App Store release gates and current evidence are maintained in [release.md](release.md).
