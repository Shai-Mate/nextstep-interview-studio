# NextStep Interview Studio

Free interview practice for any job, on your phone.

Paste a job ad and NextStep turns it into a short practice plan: what the job is really about, the skills the ad mentions, the questions you're likely to get, and a mock interview with kind, clear feedback on how your answers are built. It works for any kind of job: shops and retail, trades and apprenticeships, care work, hospitality, office and tech roles.

**Open it: https://shai-mate.github.io/nextstep-interview-studio/**

- **Free.** No account, no ads, no trial.
- **Private.** Everything you type stays on your phone. No tracking, no AI calls.
- **Works offline** after your first visit, even in airplane mode.

## Put it on your phone

Add it to your Home Screen before you start, then always open it from the icon. It opens like an app and keeps your practice in one place.

**iPhone**
1. Open the link in **Safari**. If it opened inside Instagram, Facebook, LinkedIn or Messenger, tap **•••** and choose **Open in Safari** (or **Open in external browser**).
2. Tap **Share** (the square with an arrow). If you can't see it, tap **•••** first.
3. Tap **Add to Home Screen** (scroll down or tap **More** if it's hidden), then **Add**.
4. Open NextStep from your Home Screen.

On iPhone, work saved in Safari doesn't move to the Home Screen app. If you already started in Safari, export a backup from Privacy and restore it in the app.

**Android**
1. Open the link in **Chrome**.
2. Tap **How** on the first screen and then **Install app**, or use Chrome's menu **⋮** and tap **Install app** or **Add to Home screen**.
3. Open NextStep from your Home Screen or app list.

Open it once while you're online and wait for "Ready to work offline". After that it works without internet.

## How it works

1. Paste the text of a job ad, or try a sample ad first.
2. Answer a few quick questions about your interview, or skip them.
3. Practise a little each day: short lessons, your answer bank, a quick quiz, a mock interview and a map of the role.

Make a separate preparation for each job. Notes and unfinished mock answers save automatically. The feedback is a checklist for the structure of your answers (Situation, Task, Action, Result), not hiring advice and not a score of you.

## Privacy

- Job ads, notes and answers are saved in this browser on your device. They are never uploaded, and they don't sync between devices.
- No account, no analytics, no trackers, no AI calls. Reading the ad, building the plan and the feedback all run on your phone with plain rules.
- GitHub Pages hosts the app files and sees ordinary requests for them, never what you type.
- Back up or delete any time: in the app, tap **On this device** on the first screen (or **Privacy and your data** under Progress). A backup file contains your answers, so keep it private.
- Clearing your browser's data for this site deletes your work, so export a backup first.

Read more: [How your data stays private](privacy.html).

## Feedback

Tried it for a real interview? Something confusing, or a job it didn't understand well? [Open a GitHub issue](https://github.com/Shai-Mate/nextstep-interview-studio/issues/new). GitHub issues are public, so please don't paste private answers or personal details.

Made by Prism.

## Implementation notes

- Static HTML, CSS and JavaScript, version 8. Preparation storage schema 1. No build step, no package installs, no server code, no remote calls.
- Classic scripts, loaded in this order: `engine.js` (reads the job ad and builds the plan; pure, also runs in Node), `coach.js` (on-device feedback on answer structure; pure), `orb.js` (Canvas 2D liquid-light orb), `app.js` (screens, local storage, backups), `flow.js` (first-run flow), `interview.js` (mock interview), `pwa.js` (service worker registration and install help).
- `pwa.js` tailors the install sheet to iPhone Safari, other iPhone browsers, in-app browsers, Android and computers, and exposes `window.NextStepInstall = { canPrompt(), prompt(), platform, installed }`. `prompt()` resolves to `accepted`, `dismissed` or `unavailable`.
- Styles: `styles.css`, `flow.css`, `interview.css`, `launch.css` (install sheet and privacy page). `privacy.html` is a static page with no scripts.
- Offline: `sw.js` precaches the app files in cache `nextstep-phone-v8` (`?v=8` URLs) and removes older `nextstep-phone-*` caches. Pages are served as themselves from the cache first, then the network; offline, unknown pages fall back to the app. `share-card.png` (link previews only) and `nextstep_icon_1024.png` (read from the manifest at install time) are not precached.
- Content Security Policy: only this site's own files (`default-src 'self'`), no inline scripts or inline styles.
- Relative paths everywhere, so it runs from the GitHub Pages project folder. The link-preview tags in `index.html` use the absolute public URL because scrapers need it; the app never fetches them.
- Design: the v7 phone design, with a plum field, cream and amber type, DM Sans and Newsreader (SIL Open Font License, in `fonts/`) and the liquid-light orb. Everything works with reduced motion.
- Sample ads and all data in this repository are fictional.
