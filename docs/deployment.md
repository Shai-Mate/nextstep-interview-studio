# Deployment and operator preflight

The repository includes a deployable web/service package. A container build, a health response or an unsigned iOS compile does not establish that the public service or App Store release is ready. Record actual deployment results in [verification.md](verification.md) after running the checks.

## Choose the release configuration

| Configuration | Available behavior | Required setup |
| --- | --- | --- |
| Static web or bundled iOS | Local profile, applications, courses, research notes, practice and offers; document/text import | Serve `dist/` over HTTPS for the web, or complete native signing/device checks |
| Web app plus public-link import | The local workflows plus fetching a user-selected public job page | Same-origin service, a real HTTPS domain, operator/privacy details and an outbound network that can reach public HTTPS sites |
| Online AI, optionally with public professional research | Consent-gated coaching and source-linked professional research | Provider account, production authorization gateway, per-user quotas, finalized privacy/retention terms and live-provider verification |

The default public container configuration leaves AI and web research disabled. Public-link import does not need a model key. The repository does not implement the authenticated user gateway for paid AI. Do not enable a shared model-backed public endpoint by putting its service token in the browser or native app.

## Deployment package

- [Dockerfile](../Dockerfile): builds the app, then runs a non-root Node server with the bundled app files. Development dependencies are not copied into the runtime image.
- [deploy/compose.yaml](../deploy/compose.yaml) and [deploy/Caddyfile](../deploy/Caddyfile): keep the app port private and expose Caddy on ports 80/443 for HTTPS. Caddy certificate state uses persistent named volumes.
- [deploy/.env.example](../deploy/.env.example): operator configuration template. Its `.example` hostname is deliberately not a working company domain.
- [server/static.js](../server/static.js): serves only the built app directory alongside `/api` on the same origin.
- [server/healthcheck.js](../server/healthcheck.js) and [server/smoke.mjs](../server/smoke.mjs): readiness and read-only route/header checks. The smoke script makes no AI, search or external job-page request.
- [server/README.md](../server/README.md): endpoint contracts, network restrictions, limits and online-provider requirements.

## Before the first public deployment

- [ ] Confirm the operator's legal name, a company-controlled domain and a working private support/privacy contact. Do not substitute a guessed address. GitHub issues remain a public technical-support route, not a place for candidate documents or private access/deletion requests.
- [ ] Update `public/privacy.html` and `public/support.html` with the real operator/contact and applicable hosting/provider terms, then rebuild. The `PRISM_OPERATOR_NAME`, `PRISM_PRIVACY_URL` and `PRISM_SUPPORT_*` variables populate service metadata; they do **not** rewrite those public pages.
- [ ] Choose the enabled capabilities. Leave `OPENAI_API_KEY` and `PRISM_SERVICE_TOKEN` empty and `PRISM_ENABLE_WEB_RESEARCH=false` for the default local-plus-import configuration. If a service token is configured, it protects both POST endpoints; the public client cannot call them without an authorized gateway.
- [ ] Point DNS at the intended host. Configure its firewall for Caddy's ports 80/443, keep the app's 8787 port private, and confirm the host can obtain TLS certificates and reach public HTTPS pages. Keep certificate validation enabled.
- [ ] Set `MOMENTUM_DOMAIN` to the owned hostname and `PRISM_ALLOWED_ORIGINS` to its exact HTTPS origin, without a path or trailing slash. Add `capacitor://localhost` explicitly only if the native app will call this service. Do not add a wildcard origin.
- [ ] Review hosting, proxy and provider logs. The application service does not persist candidate request/response bodies; that does not determine the host's or provider's retention. Publish the real retention/deletion process and avoid body logging.
- [ ] Retain the source revision, dependency lockfile and previous image/release for rollback. Rebuild when public policy files or app assets change. Preserve Caddy certificate volumes during routine updates; do not use volume deletion as a routine restart.

## Start and check the same-origin deployment

Use a host you control with Docker Engine and Compose v2. From the repository root:

```sh
cp deploy/.env.example deploy/.env
```

Edit `deploy/.env` with the reviewed real values before starting. It is excluded from Git and the Docker build context. Keep provider keys and gateway tokens on the service host, never in `VITE_*` variables or a mobile binary.

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
```

Set `MOMENTUM_PUBLIC_ORIGIN` in the operator's shell to the actual HTTPS origin, then run:

```sh
: "${MOMENTUM_PUBLIC_ORIGIN:?Set the deployed HTTPS origin}"
node server/smoke.mjs "$MOMENTUM_PUBLIC_ORIGIN"
```

Use `config --quiet` for validation so expanded environment values are not printed. A successful `/api/ready` indicates that the configured app assets loaded; it does not prove legal metadata, domain ownership, model access or user authorization. Inspect `/api/health` for the intended capabilities and accurate public operator metadata.

Open the public origin in a clean browser and complete a fictional job/profile/practice flow. Import a public job page, review the extracted text, test an unsupported/login-only page, and confirm that paste text remains available. Export and restore a fictional backup, then check offline reload and the public policy/support links. Confirm `/.env` and `/server/index.js` are inaccessible. Verify the deployment from outside the host, not only through localhost.

The built-in request counters use the TCP peer address and do not trust forwarded client-IP headers. Behind Caddy, users share that peer-level limit. Monitor real usage and apply appropriate edge/per-user controls before scaling; in-memory counters reset on restart and are not a distributed billing safeguard.

## Before enabling AI or public research

- [ ] Provide an authenticated gateway that authorizes each user, applies quotas and injects the private service token upstream. The checked-in Caddy proxy is not that gateway.
- [ ] Configure the provider account, model and spending limits. Test real coaching responses against the same deployed service path; fixture tests do not verify the provider account.
- [ ] For public research, separately enable `PRISM_ENABLE_WEB_RESEARCH=true`, verify model/tool compatibility and confirm actual source citations. Confirm that research starts unselected, changing its scope resets consent, and candidate profile/answers are absent from the research provider payload.
- [ ] Check action-specific consent for profile/résumé, job text, lesson context, application drafts, offer figures and research notes. Disclose OpenAI and search-provider sharing where applicable. Declining must leave local preparation usable.
- [ ] Finalize provider/host retention, deletion handling, private contact and App Store privacy disclosures. Saving an AI note locally does not delete the original provider request; closing an in-flight request cannot recall data already sent.

## Native handoff is separate

Use [ios-build.md](ios-build.md) and the actual [iOS compile workflow](../.github/workflows/ios.yml) for repeatable unsigned compilation. A successful workflow is evidence for compilation only. Signing, archive validation, physical-device testing, TestFlight and App Store submission remain the gates in [release.md](release.md). Publish the actual privacy/support URLs in the store metadata only after the deployed pages are working and complete.
