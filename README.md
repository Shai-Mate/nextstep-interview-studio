# Momentum by Prism

A career-preparation workspace that takes someone from a job opportunity to a stronger application, a practised interview and a considered offer. Built with React 19, Vite 6 and Capacitor 8, with an iOS project and an installable offline web edition.

This is a web release candidate with a native scaffold. It has **not** been signed, archived in Xcode, tested on a physical iPhone or submitted to the App Store. The remaining release gates are in [docs/release.md](docs/release.md).

## What works

- Add a job by pasting its description or importing a text-based PDF, Word `.docx` or text file. Optional public-link import is available through the included service.
- Build a candidate profile from résumé text, skills, achievements and preferences. Create and edit profile, résumé and application drafts using the facts supplied.
- Keep separate opportunities and application stages, with interview dates and notes.
- Work through eight tailored preparation lessons and their knowledge checks, collect evidence, and keep sourced company/interviewer research notes.
- Practise eight interview questions with saved answers, structure feedback, resumable drafts and previous-session history.
- Compare annualized offer inputs, separate base pay from uncertain bonus/equity, edit a negotiation draft and track a signing checklist.
- Export, restore or delete the local workspace. Previous Next Step backups are supported. Native exports use the iOS share sheet.

Core courses, drafts and feedback use local rules and templates; they are not live LLM output or verified employer research. Optional OpenAI coaching and separately enabled public professional web research are implemented behind explicit consent and service configuration, but no live AI/search request has been verified in this environment. Search results require provider citations and should still be checked against the original sources. Momentum does not connect LinkedIn/Indeed accounts, edit external profiles, submit applications, send messages or sign offers.

## Run locally

Use **Node 24.5 or later** and npm. This also satisfies the optional service's Node networking requirements.

```sh
npm ci
npm run dev
```

Vite prints the local address, normally `http://localhost:5173`. No account, model key or backend is needed for the local workflows. The fictional sample opportunity is available from the overview.

For a production build:

```sh
npm run build
npm run preview
```

The build regenerates third-party notices, bundles the app into `dist/`, and creates an offline service worker from the actual build assets. Preview normally serves `http://localhost:4173`. Offline installation requires HTTPS or localhost and a completed first online load. Core app assets are cached; candidate data stays in local storage and API responses are not cached. Development mode does not install the production service worker.

Deploy the contents of `dist/` to an HTTPS static host. Relative asset paths support a subdirectory. The privacy, support and license pages are included. The public support route currently points to this repository's GitHub issue tracker; do not post candidate documents there.

## Optional online service

In a second terminal:

```sh
npm run server
```

The Node service listens on `127.0.0.1:8787`. Vite's development server proxies `/api` to it; the production preview server does not. `GET /api/health` reports actual import and AI capabilities. In this managed environment, live import testing used `PRISM_TRUST_ENV_PROXY=1` because the environment's controlled outbound proxy independently enforces network restrictions. Do not enable that flag on an untrusted proxy.

For a separately hosted API, set the public `VITE_API_BASE_URL` before building and configure exact allowed origins on the service. **Never put model keys or service tokens in a `VITE_` variable or mobile bundle.** Production AI requires a trusted authenticated gateway, per-user quotas, provider configuration, and finalized operator/privacy details; that gateway and user authentication are not included. Public professional research additionally requires `PRISM_ENABLE_WEB_RESEARCH=true` and separate consent for each search. It is off by default. Local preparation remains usable without these services.

See [server/README.md](server/README.md) for endpoints, environment configuration, network protections, rate limits, consent, provider retention and deployment requirements. A live public-page import was verified; a mocked AI contract test is not evidence that a production model connection is working.

## Verify

```sh
npm run format:check
npm test
npm run build
```

The Node tests cover the preparation engine, truthful drafts and feedback, legacy migration, backup validation, malformed storage, offer persistence, URL import boundaries, consent, rate limits and the model request/response contract.

The browser suite uses Python Playwright and Chromium. With a built app running through `npm run preview`:

```sh
MOMENTUM_BASE_URL=http://127.0.0.1:4173 python tests/e2e.py
```

Install Playwright in an isolated Python environment if it is not already available. The test runner defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` when Chromium is elsewhere. It exercises PDF/Word import, the main career journey, export/restore/delete, offline resume, small-screen layouts, public pages and safe handling of damaged storage. Test fixtures are fictional. Screenshots are written to the ignored `test-results/` directory. Record the actual run result; the presence of a test script does not establish that it passed on another device.

## iOS handoff

```sh
npm run native:sync
npx cap open ios
```

Sync rebuilds the web app and copies it into the iOS project. Opening and building the project requires a Mac. The scaffold uses **iOS 18** as its deployment target, version **1.0.0**, build **1**, and provisional bundle ID **`com.prism.momentum`**. Confirm ownership and permanence of that identifier with Prism's Apple Developer account before distributing the app. The iOS 18 minimum matches the supported Safari baseline of the bundled PDF reader; document import on the web requires a supported current browser.

Use Xcode 26 or later with the iOS 26 SDK or later under Apple's current upload requirements. Configure the correct signing team, archive a Release build, test on supported physical devices and through TestFlight, and complete the release checklist. Browser emulation and static plist validation do not replace native-device testing.

- [Engineering verification record](docs/verification.md)
- [Release gates and native acceptance checklist](docs/release.md)
- [App Store listing and review-note draft](docs/app-store.md)
- [Data inventory and privacy review](docs/privacy.md)
- [Optional service deployment guide](server/README.md)

## Data and dependencies

Workspace data is local to this installation and is not independently encrypted by Momentum. Device backups may include it. Exported files contain private candidate information. Restoring a backup replaces the current workspace after confirmation; keep a separate copy first. Clearing data cannot delete exports or information already shared with other services. The storage key retains its original internal name, `prism.workspace.v1`, to preserve existing work; the current workspace schema is version 3.

DM Sans and Manrope are bundled locally from the Google Fonts projects under the SIL Open Font License 1.1. Their license texts are in `public/fonts/` and are also included in `public/third-party-notices.txt`. The build generates notices for installed production dependencies and bundled fonts. These licenses apply to the named third-party components; no license for Momentum's original application code is implied.
