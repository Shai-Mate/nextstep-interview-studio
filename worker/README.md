# Extract Worker

A thin Cloudflare Worker. It fetches one public job page and returns plain text, plus a company and role when the page says them plainly. The practice plan is still built on the phone.

Deploy steps live in the repository README, under **Deploy the extract Worker**. Short version:

```bash
cd worker
npx --yes wrangler login
npx --yes wrangler deploy
```

Then set `window.NEXTSTEP_EXTRACT_URL` in `config.js` to the printed URL plus `/extract`, and add that origin to `connect-src` in `index.html`.

`ALLOWED_ORIGIN` in `wrangler.toml` is `https://shai-mate.github.io`. There is no API key. The Worker does not store the page.
