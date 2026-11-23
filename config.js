/* Where the phone asks our server to read a public job page.
   Leave this empty until the Cloudflare Worker is deployed. The app then asks
   you to paste the ad instead, and nothing is fetched.
   Set the full URL, including /extract. No secrets belong in this file.
   Example, after you deploy:
   window.NEXTSTEP_EXTRACT_URL = 'https://nextstep-extract.YOUR-SUBDOMAIN.workers.dev/extract'; */
window.NEXTSTEP_EXTRACT_URL = 'https://nextstep-extract.shaimate.workers.dev/extract';

/* Extra tower origins for My subscription, comma-separated.
   https://*.ts.net is already allowed in the page policy, so leave this empty when the
   tower is a Tailscale Serve address. A different origin must also be added to connect-src
   in index.html, or the phone will refuse the call. Do not put the secret here. */
window.NEXTSTEP_TOWER_ORIGINS = '';
