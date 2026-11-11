# Momentum data inventory and privacy release review

This is an engineering handoff. The public user policy is `public/privacy.html`. Reconcile both against the actual deployment before launch; configuration can change the data flow without changing the visible app. Use [deployment.md](deployment.md) for the operator preflight and the files that must be configured together.

## Data map

| Data | Purpose | Default location | Release review |
| --- | --- | --- | --- |
| Candidate profile and imported resume text | Candidate-controlled evidence and application preparation | Local app/browser storage | Avoid unnecessary addresses, identity numbers, account passwords and unrelated sensitive details |
| Job descriptions and saved URLs | Role-specific preparation and opportunity organization | Local app/browser storage | URLs may contain tracking tokens or personal identifiers; strip unnecessary query data before sharing |
| Company/interviewer notes and sources | User-supplied context for preparation | Local app/browser storage | Use public professional information or information the user has permission to use; do not invent private facts |
| Answers, notes, course progress and mock sessions | Resumable learning and practice | Local app/browser storage | No analytics or remote transmission in local-only flows |
| Application and offer drafts | User-reviewed career correspondence | Local app/browser storage | Editing or exporting a draft is not authorization to submit or send it |
| Saved AI coaching notes and citations | User-selected guidance kept for later review | Local opportunity/offer records and user-exported backups | Explicit save; up to 12 notes per record with a separate size bound. New saves are blocked at the limit rather than silently replacing existing valid notes |
| Backups and exports | User-controlled portability and recovery | Temporary native app cache, then user-selected download/share destination | Exported files can include all candidate content and are not encrypted by Momentum |
| Optional public URL import | Fetch text from a user-selected public page | Configured import server and destination website | Consent, SSRF protection, redirect checks, size/time limits and logging review required |
| Optional model requests | Requested remote generation or feedback | Configured server and named model provider | Explicit opt-in; payload can include job/profile/answer data, selected lesson context, application drafts or offer amounts/priorities. Disclose the exact data and provider; check retention, geography and provider terms |
| Optional public professional research | A company/interviewer brief from public professional sources | Configured server, OpenAI and its web-search providers | Separate consent per request; job description and research context go to OpenAI, professional search terms may reach search providers; candidate profile and practice answer are excluded from this provider payload |
| Read question aloud | User-requested spoken practice prompt | Browser/operating-system speech service | Only the question is supplied; no microphone or camera recording. Voice availability and local/network processing depend on the platform; do not promise all voices are offline |
| Ordinary web requests | Deliver app, policy and support pages | Hosting provider | IP address, request metadata and access logs may be processed under the host's policy |

## Local storage is not an encryption claim

Momentum's local data is not independently encrypted by the application. Browser profiles, device access, OS backup settings and platform storage protections determine who can access it. A browser installation and an iOS app installation may not share storage. Private browsing, uninstalling, clearing app/site data or running out of storage may remove or prevent saves. An operating-system backup may include app data. Do not claim that data “never leaves the device” without considering user exports, backups and optional services.

The local delete control removes Momentum's active local records. It cannot delete a backup the user exported, an OS backup, a downloaded file, a third-party message they sent or service-provider logs. Explain the scope before deletion. There is no Momentum account to close in a local-only release.

Restoring a backup replaces the current workspace after confirmation; it is not a merge. For each opportunity, the app keeps the current mock-interview round and up to 10 previous rounds. Starting a new round beyond this limit removes the oldest history entry. The public retention explanation must include this limit rather than promising every local record remains until an explicit deletion. A workspace supports up to 100 opportunities and 100 offers, including archived opportunities; creation is blocked at the limit rather than silently removing records.

Native sharing writes a temporary export to the app's `Cache/momentum-exports` directory, opens the system share sheet, then attempts to delete the temporary file after completion, cancellation or failure. If the process terminates during sharing, the temporary file can remain until app/OS cleanup. Do not claim that sharing creates no local file. Copies saved by the selected destination remain outside Momentum's control.

Optional AI responses are not automatically a permanent local record. A user can explicitly save a coaching note, append a research brief to their notes, copy text or export a response. Saved notes and sources become workspace data and are included in backup/delete behavior. Closing an in-flight client request aborts the client's wait; it does not prove that an already-received request has stopped on the service/provider or erase previously shared data.

## Online feature release conditions

Before enabling an import or AI service in a distributed build:

- Publish the responsible operator's legal identity and private privacy contact. A public GitHub issue is appropriate for a non-sensitive technical bug, not a private data-access/deletion request.
- Name the configured hosting and AI providers and explain the relevant purposes, retention/deletion process, international processing and user rights in the public policy. Do not invent a retention period. Match the provider's contractual arrangement and any abuse-monitoring retention.
- Obtain informed consent before the first transmission and when the payload or recipient changes. Show the specific profile, job, source or answer content involved; allow the user to remove data or use the local alternative.
- Keep model credentials on the server. Prevent arbitrary public use of a production key with authentication or another suitable access mechanism, rate limits, quotas, request limits and monitoring that avoids recording candidate text.
- Avoid request-body logging and error traces containing resumes, answers, tokens or URLs with secrets. Inspect reverse proxies, hosting logs, error monitoring and provider retention separately from application code.
- Honor deletion and consent-revocation requests according to the published policy. Local reset alone does not revoke previously transmitted data from providers.
- Reassess App Store privacy labels, privacy manifests, App Tracking Transparency applicability, processor contracts and security controls after enabling a service.

Apple's current [Guideline 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing) explicitly requires disclosure and permission before sharing personal data with third parties, including third-party AI. Keep local preparation usable when the user declines.

Ordinary research assistance organizes supplied notes without browsing. Public professional web research is a separate capability, disabled unless `PRISM_ENABLE_WEB_RESEARCH=true` and the AI service is available. It also requires both `consent: true` and `webResearch: true` on the research request. The service excludes candidate profile and practice answer from that provider payload, but still sends the job description and supplied research context to OpenAI. The instructions limit search queries to public professional names, organizations, roles, URLs and relevant work; instructions alone do not guarantee what a provider will retain. Disclose search-provider sharing and review the provider contract before enabling it.

Research results require a completed provider web-search tool call and usable URL citations. Those citations establish where information was sourced, not that every claim is independently true. Encourage verification of identity, dates and source context. No live research-provider request has been tested without a configured key.

## Native privacy manifest

Inventory the actual native APIs and SDKs in the final archive. Declare required-reason API use with the appropriate approved reason, and include each required SDK's valid privacy manifest/signature. A copied list of every possible reason is not acceptable. Web storage alone does not justify claiming a native `UserDefaults` reason; inspect the Capacitor version and plugins actually bundled.

Do not request Contacts, Photos, microphone, speech, location or tracking permissions if the build does not use them. Prefer a system document picker for user-selected files. If a future feature records or transcribes speech, add the appropriate purpose strings, separate informed consent and a non-audio alternative; document any platform or remote speech processing.

## Privacy verification before upload

1. In a clean device profile, record network activity while completing every local workflow. Confirm that profile, ad, answers and drafts do not leave the app.
2. Inspect native plugin dependencies and archive manifests, not only browser source.
3. Exercise consent accepted, declined and revoked states. Check the actual request body and recipient for each online function.
4. Export, restore and delete a synthetic profile. Confirm the backup contains only expected data and deletion removes active local records after relaunch.
5. Inspect storage failure behavior: a failed save must be visible and must not claim content is safely persisted.
6. Review the final hosting, service and provider configuration with the public policy and App Store disclosures side by side.

## Official references

- [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Apple required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- [Apple App Review privacy guidelines](https://developer.apple.com/app-store/review/guidelines/#privacy)

Guidelines and requirements were reviewed on November 10, 2026. Recheck before submission.
