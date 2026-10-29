# Next Step Interview Studio

A free, phone-installable interview-preparation web app.

## Install
Open the published site on your phone.
- iPhone: open in Safari, tap Share → Add to Home Screen.
- Android: open in Chrome, use the menu → Install app or Add to Home screen.

Install first, then start your preparations from the Home Screen icon. No account, Python, app store or API key is needed. Wait for “Ready for offline use” once before going offline.

## Prepare
Paste the actual job-ad text, optionally save its URL as a reference, complete the quick setup, then work through Study, Answer bank, Quiz, Mock interview and Role map. Create separate preparations for different jobs. Notes and interrupted mock drafts save automatically on your device. Export backups through Storage & privacy.

## Privacy and limits
All typed preparations stay in browser-local storage. No analytics, remote model calls or automatic cloud sync. The web host receives normal app-file requests, not candidate answers. Local storage is not encrypted and can be lost when site/app data is cleared. Backups include private answers, so keep them private. Safari and a Home Screen installation may not share storage: install before starting, or use export/import.

This is rules-based local preparation, not AI interviewing. Mock feedback is a structure checklist, not hiring advice or technical grading. The free static phone edition does not import websites automatically; paste the ad text instead. Offline use works after the initial online load and service-worker setup.

## Implementation
Static HTML, CSS and JavaScript, version 2; preparation storage schema 1. Relative paths support a project subdirectory on GitHub Pages. No package installation or build step. No source-person identities, original employer data, keys or candidate datasets are included.

Verified in Chromium with mobile emulation, service-worker control, offline navigation and mock draft resume. Physical iPhone/Safari Home Screen installation still needs a real-device check.
