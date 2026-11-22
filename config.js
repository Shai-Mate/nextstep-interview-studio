/* Where the phone asks our server to read a public job page.
   Leave this empty until the Cloudflare Worker is deployed. The app then asks
   you to paste the ad instead, and nothing is fetched.
   Set the full URL, including /extract. No secrets belong in this file.
   Example, after you deploy:
   window.NEXTSTEP_EXTRACT_URL = 'https://nextstep-extract.YOUR-SUBDOMAIN.workers.dev/extract'; */
window.NEXTSTEP_EXTRACT_URL = '';
