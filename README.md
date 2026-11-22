# NextStep Interview Studio

Free interview practice for any job, on your phone.

Paste a job link and NextStep turns it into a short practice plan: what the job is really about, the skills the ad mentions, the questions you're likely to get, and a mock interview with a practice grade on how your answers are built. It works for any kind of job: shops and retail, trades and apprenticeships, care work, hospitality, office and tech roles.

**Open it: https://shai-mate.github.io/nextstep-interview-studio/**

- **Free.** No account, no ads, no trial.
- **Private.** Your answers stay on your phone. No tracking, no AI calls. A job link, and the text of that public page, are sent to our server so the plan can be built. See [Privacy](#privacy).
- **Works offline** for practice after your first visit, even in airplane mode. Reading a new job link needs a connection.

## Put it on your phone

Add it to your Home Screen before you start, then always open it from the icon. It opens like an app and keeps your practice in one place.

**iPhone**
1. Open the link in **Safari**. If it opened inside Instagram, Facebook, LinkedIn or Messenger, tap **•••** and choose **Open in Safari** (or **Open in external browser**).
2. Tap **Share** (the square with an arrow). If you can't see it, tap **•••** first.
3. Tap **Add to Home Screen** (scroll down or tap **More** if it's hidden), then **Add**.
4. Open NextStep from your Home Screen.

On iPhone, work saved in Safari doesn't move to the Home Screen app. If you already started in Safari, tap **On this device**, then **Export backup**, and use **Restore a backup** in the Home Screen app.

**Android**
1. Open the link in **Chrome**.
2. Tap **How** on the first screen and then **Install app**, or use Chrome's menu **⋮** and tap **Install app** or **Add to Home screen**.
3. Open NextStep from your Home Screen or app list.

Open it once while you're online. When the **How** sheet says "Ready to work offline", it works without internet.

## How it works

1. Paste a link to the job. Company, role and requirements are read from the public page, and the plan is built on your phone. Nothing else is required.
2. If the page cannot be read (a sign-in wall such as LinkedIn or Indeed, or a blocked or empty page), paste the ad text instead. That text stays on your phone.
3. After the plan exists, you can add an interview date and how many minutes a day you want. Practise a little each day: short lessons, your answer bank, a quick quiz, a mock interview and a map of the role.

Make a separate preparation for each job. Notes and unfinished mock answers save automatically. Each typed answer gets a practice grade from the structure checklist (Situation, Task, Action, Result). Progress shows an overall practice score. Neither one is hiring advice, and neither one says whether you would get the job.

### Practice grade

100 points on one typed answer:

| Part | Points | What it uses |
| --- | --- | --- |
| STAR structure | 40 (10 each) | situation, task, action, result |
| Ownership | 15 | "I" and what you did |
| Evidence | 15 | a real result or detail |
| Relevance | 15 | words from the ad, only if the checklist can see them |
| Delivery | 15 | length (about 50 to 250 words for a story) and clarity |

A question that is not a story (why this job, what you would do, how you would learn it, questions you would ask) uses that question's own shape. If that check passes, structure is still 40.

Bands for one answer: Starting, Building, Strong, Polished.

The practice score on Progress is lessons 25%, answer bank 20%, quiz 15%, the average practice grade 30%, and the role map 10%. Bands: Building, Getting there, Interview ready.

### Pace

With an interview date, the minutes still left in the lessons are split across the days from today through the interview day. That day counts. A missed day keeps its minutes in the pot, so the minutes you need each day go up. Today and Progress show this as a small chart. With no date, there is no schedule. Minutes a day (15, 30 or 60) is optional and only changes how long Today is.

## Privacy

- Notes and practice answers are saved in this browser on your device. They are not uploaded, and they don't sync between devices.
- A job link, and the text of the public page, are sent to our extract server for that request only. We do not keep them. If you paste the ad instead, that text stays on your phone.
- No account, no analytics, no trackers, no AI calls. Building the plan and the practice grade run on your phone with plain rules.
- GitHub Pages hosts the app files and sees ordinary requests for them, not your answers.
- Back up or delete any time: in the app, tap **On this device** on the first screen (or **Privacy and your data** under Progress). A backup file contains your answers, so keep it private.
- Clearing your browser's data for this site deletes your work, so export a backup first.

Read more: [How your data stays private](privacy.html).

## Feedback

Tried it for a real interview? Something confusing, or a job it didn't understand well? [Open a GitHub issue](https://github.com/Shai-Mate/nextstep-interview-studio/issues/new). GitHub issues are public, so please don't paste private answers or personal details.

Made by Prism.

## Deploy the extract Worker

The phone cannot read most job pages itself. `worker/` is a Cloudflare Worker with one route, `POST /extract`. It fetches the public page, returns plain text plus a company and role when the page says them plainly, and stores nothing. Course generation still runs on the phone.

Until `config.js` has a URL, or the phone cannot reach it, the app shows the paste box and still builds the plan. You do not need this Worker to try the app.

This uses Cloudflare's free Workers tier. It does not add a paid product, and there is no API key.

1. From this repo, log in and deploy. Wrangler will ask you to sign in to Cloudflare the first time:

   ```bash
   cd worker
   npx --yes wrangler login
   npx --yes wrangler deploy
   ```

2. Wrangler prints a URL like `https://nextstep-extract.<your-subdomain>.workers.dev`.

3. In `config.js`, set the full extract URL, including `/extract`:

   ```js
   window.NEXTSTEP_EXTRACT_URL = 'https://nextstep-extract.<your-subdomain>.workers.dev/extract';
   ```

4. In `index.html`, change the Content-Security-Policy `connect-src` from `'self'` to the exact origin Wrangler printed (no path):

   ```
   connect-src 'self' https://nextstep-extract.<your-subdomain>.workers.dev
   ```

   `privacy.html` does not call the Worker, so its policy stays as it is.

5. Commit those two edits and ship GitHub Pages the way you already do, from `main`, after you have tried it.

6. Check a public Greenhouse, Lever, Ashby or company career page, then a LinkedIn link. The first should build a plan. The second should show the paste box.

`worker/wrangler.toml` sets `ALLOWED_ORIGIN` to `https://shai-mate.github.io`. Change that only if the site moves. Do not put secrets in `config.js` or in git.

The Worker allows only `http` and `https`, blocks private and local addresses (including a name that resolves to one), does not follow a redirect onto a private address, and caps size and time. A name that changes address after the check can still point somewhere private. If the URL is abused, turn on a Cloudflare rate limit as well. The Worker already slows a single isolate to 30 requests a minute.

## Implementation notes

- Static HTML, CSS and JavaScript, version 10. Preparation storage schema 1. No build step and no package installs for the app. `config.js` holds the extract URL and is empty until you deploy the Worker. Old backups still restore: `dayLog` and `dailyMinutes` are optional fields on schema 1.
- Classic scripts, loaded in this order: `config.js` (extract URL only), `engine.js` (reads the job ad and builds the plan; pure, also runs in Node; `schedule` paces lessons once a date is set), `coach.js` (on-device feedback, practice grade and readiness score; pure), `orb.js` (the orb: a WebGL ray-traced glass sphere in liquid light, with molecules that scatter and re-form and a voice pulse in the mock interview; it loads `orb-2d.js`, the Canvas 2D orb, only when WebGL is unavailable or fails), `app.js` (screens, local storage, backups), `flow.js` (first-run flow), `interview.js` (mock interview), `pwa.js` (service worker registration and install help).
- `pwa.js` tailors the install sheet to iPhone Safari, other iPhone browsers, in-app browsers, Android and computers, and exposes `window.NextStepInstall = { canPrompt(), prompt(), platform, installed }`. `platform` is `ios-safari`, `ios-browser`, `in-app`, `android` or `desktop`; `prompt()` resolves to `accepted`, `dismissed` or `unavailable`; a `nextstep-install-change` event fires on `window` when `canPrompt()` or `installed` may have changed.
- Styles: `styles.css`, `flow.css`, `interview.css`, `launch.css` (install sheet and privacy page). `privacy.html` is a static page with no scripts.
- Offline: `sw.js` precaches the app files in cache `nextstep-phone-v10` (`?v=10` URLs) and removes older `nextstep-phone-*` caches. Install fetches each file from the network with a reload, so a new cache name updates phones instead of mixing versions. Pages are then served as themselves from the cache first, then the network; offline, unknown pages fall back to the app. `/extract` is not cached. `share-card.png` (link previews only) and `nextstep_icon_1024.png` (read from the manifest at install time) are not precached.
- `orb-gl.js` from version 8 is no longer loaded or cached and can be deleted.
- Content Security Policy: this site's own files (`default-src 'self'`), no inline scripts or inline styles. `connect-src` stays `'self'` until the Worker origin is added, as in the deploy steps above. The ribbon M icon is `nextstep_icon.svg`.
- Relative paths everywhere, so it runs from the GitHub Pages project folder. The link-preview tags in `index.html` use the absolute public URL because scrapers need it; the app never fetches them.
- Design: the v7 phone design, with a plum field, cream and amber type, DM Sans and Newsreader (SIL Open Font License, in `fonts/`) and the liquid-light orb. Everything works with reduced motion.
- Sample ads and all data in this repository are fictional.
