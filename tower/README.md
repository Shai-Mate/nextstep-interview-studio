# NextStep tower

A small service for one phone. It accepts `POST /generate` with a shared secret, runs `codex exec` with the ChatGPT login already on this machine, and returns the course JSON.

It does not log the résumé or the job ad. It stores nothing. Install it only on the tower, and only on the tailnet.

This folder is part of the NextStep repo. Run it from a clone. It uses Node's own libraries and `../course.js`. It does not need `npm install`.

## What the phone calls

`POST https://<machine>.<tailnet>.ts.net/generate`

Header: `Authorization: Bearer <the secret>`

The browser origin must be `https://shai-mate.github.io`. Any other origin is refused.

Codex is started as:

```bash
codex exec --ephemeral --skip-git-repo-check --sandbox read-only --color never \
  --output-schema <schema.json> --output-last-message <course.json> "<prompt>"
```

Those flags match the current Codex CLI reference for non-interactive mode. `--output-schema` constrains the final message. `--output-last-message` (`-o`) writes that JSON to a file. `--ephemeral` skips session files. The sandbox stays read-only. `--json` is not used: that flag is an event stream, not the course.

The run times out after 90 seconds. The body is capped at 200,000 bytes. More than 8 requests a minute get `429`.

## Install

Do this on the tower, as the user who is already signed in to Codex (`codex` works in that user's terminal). Do not run it as root. A root service would not see that login.

1. Install Node 20 or newer, the Codex CLI, and Tailscale. Sign in to Codex once, in this same user account, and confirm `codex exec --ephemeral "reply with the word ready"` prints a reply.

2. Clone the repo and leave it on disk:

   ```bash
   git clone https://github.com/Shai-Mate/nextstep-interview-studio.git "$HOME/nextstep-interview-studio"
   ```

3. Make a secret and keep it out of the repo:

   ```bash
   umask 077
   mkdir -p "$HOME/.config"
   printf 'NEXTSTEP_TOWER_SECRET=%s\nHOST=127.0.0.1\nPORT=8787\n' "$(openssl rand -hex 24)" > "$HOME/.config/nextstep-tower.env"
   chmod 600 "$HOME/.config/nextstep-tower.env"
   ```

4. Install the user service. `node` must be at `/usr/bin/node`, or edit `ExecStart` in the unit.

   ```bash
   mkdir -p "$HOME/.config/systemd/user"
   cp "$HOME/nextstep-interview-studio/tower/nextstep-tower.service" "$HOME/.config/systemd/user/nextstep-tower.service"
   systemctl --user daemon-reload
   systemctl --user enable --now nextstep-tower.service
   systemctl --user status nextstep-tower.service
   ```

   Linger lets it stay up after you log out:

   ```bash
   sudo loginctl enable-linger "$USER"
   ```

5. Publish it on the tailnet only. This listens on localhost. Tailscale Serve gives the phone an https address. It is not a public website.

   ```bash
   tailscale serve --bg 443 http://127.0.0.1:8787
   tailscale serve status
   ```

   `status` prints a URL like `https://omarchy.<tailnet>.ts.net`. That is the tower URL to type into the phone. Do not put it in the git repo.

6. Check from the tower:

   ```bash
   curl -sS http://127.0.0.1:8787/health
   ```

   You should see `{"ok":true}`.

## If you would rather bind the tailnet address

Leave `HOST=127.0.0.1` unless you have a reason not to. The phone's content security policy allows `https://*.ts.net`, which `tailscale serve` provides. A raw `http://100.x.x.x` address will not load from the phone.

To bind the tailnet interface instead:

```bash
# in ~/.config/nextstep-tower.env
HOST=tailscale
```

The process runs `tailscale ip -4` and listens on that address only. `0.0.0.0`, public IPs, and other interfaces are refused.

## On the phone

1. Open NextStep from the Home Screen icon, on the same tailnet (Tailscale connected).
2. Tap **On this device**, then **Personal course**.
3. Choose **My subscription**. Paste the `https://….ts.net` URL and the secret. Save.
4. Start a job, then fill **About you**. The lessons should name that background.

The secret stays in the phone's local storage. It is not in an exported backup.

## Updates

```bash
cd "$HOME/nextstep-interview-studio"
git pull
systemctl --user restart nextstep-tower.service
```

## Logs

`journalctl --user -u nextstep-tower.service -f`

A log line is the status code and a short reason (`ok`, `unauthorized`, `timeout`). It does not include the ad or the résumé.
