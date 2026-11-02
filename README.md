# Next Step Interview Studio

A free, phone-installable interview-preparation app. Version 3 builds a role-specific practice from one job. Version 2 preparations saved in this browser still open, and they stay labeled as v2 rules practice.

The public site on `main` is unchanged until this version is approved. Nothing in this repo deploys a backend.

## Install

Open the published site on your phone.

- iPhone: open in Safari, tap Share, then Add to Home Screen.
- Android: open in Chrome, use the menu, then Install app or Add to Home screen.

Install first, then start your preparations from the Home Screen icon. Wait for "Ready for offline use" once before going offline.

## Prepare

Paste a job link, paste the job ad, or attach a PDF, Word, or text file. One of those is enough.

If a preparation service address is saved under Storage & privacy, that service reads the job and builds the practice. If no address is saved, the app opens a saved practice pack only when the link or text matches one. Three packs are included so you can try the full flow with nothing deployed: a youth AI mentor, a senior backend engineer, and a retail store manager.

You then answer a few multiple-choice questions drawn from that role. The course, quiz, role-play, and grade follow those choices. A short sitting and a career-change answer change which lessons and scenes you get.

Each job is saved on its own. Notes, quiz choices, role-play drafts, and grades save on this device. Export a backup from Storage & privacy. An imported backup is added as separate copies. A v2 backup still imports as v2.

## Privacy and limits

With no service address, job text and answers stay in this browser. With a service address, the job text and the answers you submit are sent only to that address.

Local storage is not encrypted. Backups include private answers, so keep them private. Safari and a Home Screen installation may not share storage: install before starting, or use export and import.

Grades are practice feedback. They are not a hiring decision, and the scenes are not a prediction of the employer's questions. Facts taken from the ad are labeled. General practice notes are labeled separately. If a link is a job list, a login wall, or a private address, the app says so and does not invent a course.

Offline use works after the first online load. Role-play against a remote service needs the network. Saved preparations and saved packs still open offline.

## Point the app at a preparation service

1. Deploy the worker with the steps below. Copy the `https://your-name.workers.dev` address.
2. Open the app, then Storage & privacy.
3. Paste that address and choose Save service address.
4. Start a new preparation. The link or text is sent to that address.

Leave the box empty to go back to saved packs only.

## Deploy the worker once

This uses Cloudflare's free Workers plan and the Workers AI binding. Do not add a payment method, and do not turn on a paid tier. No key is stored in this repo.

1. Install Node.js 22 or newer.
2. Create a free Cloudflare account and sign in:

   ```bash
   cd worker
   npx wrangler@4 login
   ```

3. In the Cloudflare dashboard, open Workers AI and accept the model terms if the site asks. Confirm the account is on the free plan. The default model is `@cf/meta/llama-3.1-8b-instruct`. You can change `MODEL_ID` in `worker/wrangler.toml` to another model that your free allowance includes.
4. Deploy:

   ```bash
   npx wrangler@4 deploy
   ```

5. Copy the workers.dev URL Wrangler prints. Paste it into Storage & privacy, as above.

`wrangler.toml` has no account id and no route. The first deploy may ask you to choose the account you just signed in to. That choice stays on your machine, not in git.

To try the worker on your own computer before a public URL, run `npx wrangler@4 dev` from `worker/` and paste `http://127.0.0.1:8787` into Storage & privacy. Only that computer can use an http localhost address.

## What is untested here

Live fetches of Indeed, and a real Workers AI call, are not run from this repo. The URL tests use saved HTML. The model tests use a stand-in adapter. A phone-width browser run covers the saved-pack flow. A physical iPhone install still needs a device check. The worker checks DNS and blocks private addresses, but the Cloudflare fetch cannot pin the socket to that DNS answer the way the old local Python server did.

## Tests

```bash
npm install
npm test
npm run test:e2e
```

`npm test` does not need a browser. The end-to-end script uses the Chrome already on the machine.

## Implementation

Static HTML, CSS, and JavaScript for the phone app, plus a Cloudflare Worker under `worker/`. The worker validates model JSON, checks it against the job text, and tries once more before it gives up. Job text is passed to the model as data, not as instructions. PDF reading uses a local copy of PDF.js. Word files are read in the browser. No candidate text is written to the worker log.
