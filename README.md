<div align="center">
  <img src="src/assets/images/sagekept-favicon.svg" alt="SageKept icon" width="84">

# SageKept

### Fast, offline-first notes & hierarchical project binders — on your device or your own server

</div>

<p align="center">
  <strong>SageKept</strong> is a customized fork of <a href="https://github.com/ericerkz/kept">Kept</a> — an open-source notes and project organization app for the web, iOS, and Android. Built for speed, rich note-taking, offline-first sync, and deep hierarchical organization with nested binders.
</p>

<p align="center">
  <a href="#whats-new-in-sagekept">What's New in SageKept</a> ·
  <a href="#self-hosting">Self-host SageKept</a> ·
  <a href="#development">Development</a> ·
  <a href="#technical-documentation">Technical documentation</a>
</p>

## Use SageKept your way

### Your own server

Run SageKept with Node.js or Docker and keep full control of your data. Access your notes, checklists, and nested project binders in any modern browser.

### Offline-first & local-ready

Work seamlessly offline with local browser storage and automatic background synchronization when connected to your SageKept server.

## Screenshots

### Web app

<a href="docs/assets/images/kept-web.png"><img src="docs/assets/images/kept-web.png" alt="SageKept web app in light and dark theme" width="100%"></a>

### Mobile

<a href="docs/assets/images/kept-mobile.png"><img src="docs/assets/images/kept-mobile.png" alt="SageKept on a phone, with the note editor, code blocks and nested checklists" width="100%"></a>

### Features

<a href="docs/assets/images/kept-features.png"><img src="docs/assets/images/kept-features.png" alt="Rich notes, drawings, code blocks, reminders, colours and patterns, sharing" width="100%"></a>

## What's New in SageKept

SageKept builds directly on the full Kept platform with five targeted enhancements for cleaner visual identity, distraction-free workspaces, and multi-level project hierarchy:

1. **Nested Binders (`Binders within Binders`)**
   - Organize projects into multi-level hierarchies by nesting binders inside other binders to any depth.
   - **Expandable Sidebar Tree**: Expand or collapse parent binder branches in the left-hand navigation or click the quick **Add sub-binder** action directly on any binder row.
   - **Edit Binders Parent Selector**: Choose a parent binder when creating a new binder or reparent existing binders on the fly (with automatic cycle prevention, rename cascading, and child promotion if a parent binder is deleted).
   - **Binder Breadcrumbs & Sub-Binder Bar**: Navigating into a binder displays a full breadcrumb trail (`Binders › Parent › Child`), quick sub-binder cards with live note counts, a `+ New sub-binder` button, and a toggle between **Including sub-binders** (aggregates notes across the current binder and all descendant sub-binders) and **This binder only**.
   - **Indented Binder Menus**: Note cards, the note composer, and bulk-selection menus display your binder hierarchy with visual depth indentation.
2. **Hide All Left-Hand Sidebar Menu Items**
   - Toggle **Settings → Display & Editing → Hide all left-hand menu items** to completely hide the left-hand navigation column and menu items for a clean, distraction-free canvas.
3. **SageKept Wordmark & Modern Typography**
   - Replaced the legacy top-left image logo and script font with a clean, two-tone **SageKept** typographic wordmark set in **Sora** across the navbar, authentication screens, settings, and mobile drawer.
4. **5 Inbuilt Profile Picture Icons**
   - Choose from 5 custom built-in SVG profile avatars directly in the profile editor (**Sage Leaf**, **Mountain Peak**, **Wise Owl**, **Explorer / Astronaut**, and **Compass**), or upload a custom photo. New accounts automatically receive one of the 5 built-in icons.
5. **Modern Browser Tab Icon & PWA Icons**
   - Updated the browser tab favicon (`sagekept-favicon.svg` & `favicon.ico`) and web app manifest icons to a modern emerald-and-sage notebook emblem with a bookmark ribbon and botanical leaf accent.

## More than basic notes

- Text and rich notes, including code blocks with syntax highlighting
- Rich hyperlinks - copy and paste just a URL and a pretty whole-card preview will get created
- Nested checklists with drag-to-reorder
- Images, drawings, links and file attachments
- Labels, **nested binders (binders within binders)**, colours and backgrounds
- **Collapsible / hideable left-hand sidebar menu** via Settings for distraction-free focus
- **5 inbuilt SVG profile picture icons** plus custom image upload
- [Passcode-protected encrypted notes](#locked-note-encryption), using AES-256-GCM for note content, images and attachments
- See [Search and filters](docs/search.md) for search operators and creation-date examples.
- Customisable appearance, note density, checklist behaviour and shared-note organization
- Time-based (one-off or recurring) and location-based reminders.
- Native iOS and Android widgets
- Native sharing - share links, photos, files to kept on iOS or Android and they will automatically make a note with that captured
- Real-time collaboration and shared binders
- Offline-first sync
- Google Keep Takeout import
- Full backup and restore
- Automated scheduled database backups, with configurable retention
- OIDC / SSO
- OAuth 2.1
- Local and remote MCP access
- On-device Smart Capture on supported phones

## Capture from anywhere

Share links, photos, text and files into SageKept from other apps. On iOS and Android, Home Screen widgets let you browse notes, tick off checklist items and quickly capture something new.

## Open source, by design

Built in the open, with the immediacy of Google Keep, nested binder hierarchy for structured projects, and complete control over where your notes live.

---

# Technical documentation

## Use SageKept Locally Without a Server

With the native iOS and Android apps (or local device mode), you can use SageKept without Docker or a remote server account:

1. Open the app and choose **Use on this device** on the welcome screen.
2. Create and organize your notes and nested binders offline.

Device-only mode keeps your notes, checklists, images, drawings, attachments, labels, binders, and reminders on the device. Sharing, collaboration, web access across devices, and server integrations use a SageKept server.

In **Settings → Notes on this device**, use **Save a complete backup** to save your library, or **Restore a backup** to restore it. Save backups somewhere outside the app: deleting the app or losing the device can mean losing its local notes.

If you decide to sync across devices later, choose **Move my notes to a server** in the same section and connect to your SageKept server. This transfers your entire local library, including images and attachments.

<a id="self-hosting"></a>

## Install a Server With Docker

Requirements:

- Docker with Compose
- Git

Clone your SageKept repository and build/start the container from source:

```bash
git clone https://github.com/Sage222/SageKept.git SageKept
cd SageKept
docker compose up -d --build
```

Open `http://localhost:6767` (or `http://<your-server-ip>:6767`) and create the first admin account.

SageKept stores its SQLite database, uploads, attachments, and generated server data in `./data`. Back that folder up if you are not using the built-in backup tools.

<details>
<summary>Optional: start the container as a non-root user</summary>

By default, the container briefly starts as root to prepare the data folder, then runs the app as the user set by `PUID`/`PGID`. You can also start it as non-root from the beginning.

Add `user:` under the service in your Compose file:

```yaml
services:
  kept:
    user: "1000:1000"
```

Replace `1000:1000` with the Linux user and group IDs that should own SageKept's files. Prepare the data folder on your host before starting:

```bash
mkdir -p ./data
sudo chown -R 1000:1000 ./data
docker compose up -d --build
```

With `user:` set, the container uses that identity and keeps its supplementary groups. `PUID`/`PGID` are ignored, and file ownership is not modified automatically. The data folder and existing files must be writable by that user or one of its groups; mounted secret files must be readable. If permissions prevent access, startup stops with an error.

For Kubernetes, the equivalent pod settings are:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
```

Use IDs appropriate for your deployment. Your storage driver must support `fsGroup`, or the volume permissions need to be prepared separately. No root startup or extra user-switching capabilities are needed in this mode.

</details>

## PWA / Mobile Browser

The SageKept web app can be installed as a Progressive Web App (PWA) on desktop, iOS, and Android. For push notifications and reliable mobile installs, serve SageKept from a secure `https://` URL.

## Reverse Proxy / HTTPS

Use HTTPS if you want public access, PWA installs, OAuth redirects, or push notifications. Point your proxy at `127.0.0.1:6767` (or `127.0.0.1:3000` depending on your configured `PORT`).

Realtime presence and collaborative editing use WebSockets at `/api/realtime`, so proxy that path with WebSocket upgrade support.

Apache example:

```apache
# Required once:
# sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl
# sudo systemctl reload apache2

<VirtualHost *:80>
    ServerName sagekept.example.com
    Redirect permanent / https://sagekept.example.com/
</VirtualHost>

<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName sagekept.example.com
    ProxyRequests Off
    ProxyPreserveHost On

    ProxyPass /api/realtime ws://127.0.0.1:6767/api/realtime
    ProxyPassReverse /api/realtime ws://127.0.0.1:6767/api/realtime

    ProxyPass / http://127.0.0.1:6767/
    ProxyPassReverse / http://127.0.0.1:6767/

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/sagekept.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/sagekept.example.com/privkey.pem
</VirtualHost>
</IfModule>
```

Nginx example:

```nginx
server {
    listen 80;
    server_name sagekept.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sagekept.example.com;

    ssl_certificate /etc/letsencrypt/live/sagekept.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sagekept.example.com/privkey.pem;

    location /api/realtime {
        proxy_pass http://127.0.0.1:6767/api/realtime;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:6767;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Advanced config

#### VPN/Tailscale/WireGuard setups

If you access SageKept through Tailscale, WireGuard, another VPN, a LAN hostname/IP, or more than one reverse-proxy domain, the CORS settings may be relevant. These setups do not require special CORS settings by themselves; CORS only matters when the browser page and SageKept API are reached through different origins, or when you restrict origins with `KEPT_CORS_ORIGINS`. If you use `KEPT_CORS_ORIGINS`, include each exact browser origin you use, such as your Tailnet name, VPN-only domain, LAN IP, or public reverse-proxy domain, including the scheme and port when applicable. Same-origin access does not need extra CORS configuration. Browser sessions use HttpOnly cookies: a separate SPA origin requires an explicit `KEPT_CORS_ORIGINS` allowlist and must be on the same site as the API. `KEPT_CORS_ALLOW_ALL=1` supports bearer-authenticated native/API clients; it cannot authorize cross-origin browser cookies.

#### Custom header support in the mobile apps

The native iOS and Android app origins are allowed automatically when neither CORS option is configured. You do not need `KEPT_CORS_ALLOW_ALL=1` just to connect the mobile apps. This default allows exact app origins without cross-origin cookie credentials; API authentication is still required. Explicit CORS allowlists and wildcard mode continue to work as configured.

The native iOS and Android apps support optional custom connection headers for reverse proxies or access gateways that require them, such as Cloudflare Access service tokens or shared-secret proxy headers. Configure these only if your proxy setup requires them.

Custom headers help the mobile apps pass normal HTTP requests through a header-auth gateway, including login, loading notes, saving notes, attachments, and settings. They are not a replacement for login; users still need a SageKept account/session.

Custom headers do not apply to realtime WebSocket connections. Realtime presence and live collaboration use WebSockets at `/api/realtime`, and browser/WebView WebSockets cannot attach arbitrary custom headers. Behind gateways that require header auth on WebSocket upgrade requests, normal reads/writes should still work, but live updates may only appear after refocusing the app or manually refreshing.

#### OpenID Connect single sign-on

SageKept can use an OpenID Connect provider for optional single sign-on. Username/password login stays available by default. Set `BASE_URL`, `KEPT_OIDC_ISSUER`, and `KEPT_OIDC_CLIENT_ID`; confidential clients should also set `KEPT_OIDC_CLIENT_SECRET`. Existing users can choose **Connect SSO account** in Settings. If self-registration is enabled, new users can sign in with the provider and finish creating their SageKept account, subject to the existing approval setting. SageKept never links accounts by matching email addresses.

After linking and testing SSO for your existing users, including an administrator, you can require SSO with `KEPT_DISABLE_PASSWORD_LOGIN=1`. New users can still register through OIDC when self-registration is enabled; email invitations are paused. See the [OIDC setup guide](docs/oidc.md#require-single-sign-on) for setup and recovery instructions.

The callback URL to register with your identity provider is `https://your-sagekept.example/api/auth/oidc/callback`. OIDC sign-in is an additional authentication path, not a replacement for SageKept's own authorization rules. See the [OIDC setup guide](docs/oidc.md) for configuration and account-linking details.



## Locked-note encryption

Lock a note with a passcode to encrypt its text, checklists, images and attachments on your device before they are saved or synced. SageKept uses **AES-256-GCM authenticated encryption**, with a separate random 256-bit key for each note. Your passcode protects that key using **PBKDF2-HMAC-SHA-256 with 600,000 iterations** and a random salt. Encryption uses the platform’s built-in Web Crypto API.

Titles and basic note metadata remain visible. 

## Backups And Restore

For device-only notes, use **Settings → Notes on this device → Save a complete backup** in the native app. The backup includes notes, images, attachments, reminders, and device preferences. Use **Restore a backup** in either native app to restore that library on a device. Backup reminders are optional in-app prompts; they do not create backups automatically.

For servers, admins can choose **User management → Download a full backup** to save a ZIP containing a consistent SQLite snapshot, uploaded images, attachments, and web-push keys for all accounts. This is a server-wide backup containing private data for every user; store it somewhere private. Server environment variables and reverse-proxy configuration must be configured separately on the destination. If you supply VAPID keys through environment variables, configure those consistently on the destination too.

Scheduled daily, weekly, or monthly backups remain database-only SQLite snapshots. The readable JSON/CSV/Markdown exports in Settings are per-user exports, exclude media files, and cannot be imported back into SageKept.

<details>
<summary>See automated backup settings</summary>

<p align="center">
  <img src="docs/assets/images/scheduled-backups.png" width="760" alt="Automated database snapshot settings showing a daily backup schedule and the last completed backup">
</p>

</details>

To restore from a backup during setup:

1. Set `KEPT_ALLOW_RESTORE=1`.
2. Restart SageKept.
3. Before creating any accounts, upload the full server ZIP or an older `.sqlite` backup from the setup screen. Full ZIP backups restore images and attachments too; SQLite-only backups do not include those files. Device-only mobile backups use a different format and must be restored in a native app.
4. Remove `KEPT_ALLOW_RESTORE` and restart again.

The restore flag is intentionally opt-in so the restore endpoint is not left open on a public instance. Restore uploads and their expanded contents are limited to 20 GB by default; set `KEPT_BACKUP_UPLOAD_MAX` (for example, `40GB`) if necessary, and allow sufficient temporary disk space. A reverse proxy may impose a lower upload limit.

## Updating

```bash
cd SageKept
git pull
docker compose up -d --build
```

Your `./data` folder is not replaced by updates.

## Configuration

Useful environment variables are documented in `docker-compose.yml`. The common ones are:

- `BASE_URL`: public origin used for OAuth/callback generation. Required for remote MCP/OAuth and OIDC.
- `KEPT_OIDC_ISSUER` / `KEPT_OIDC_CLIENT_ID` / `KEPT_OIDC_CLIENT_SECRET`: optional upstream OIDC single sign-on provider.
- `KEPT_OIDC_NAME`: label shown on the sign-in button. Defaults to `Single sign-on`.
- `KEPT_OIDC_SCOPES`: scopes requested from the provider. Defaults to `openid profile email`.
- `KEPT_DISABLE_PASSWORD_LOGIN`: set to `1` to require configured OIDC sign-in after linking an enabled administrator and your users. Off by default.
- `KEPT_SESSION_TTL_DAYS`: login session lifetime. Defaults to 30 days.
- `KEPT_CORS_ALLOW_ALL` / `KEPT_CORS_ORIGINS`: CORS behavior for remote clients and native shells. Native app WebView origins are allowed automatically when using `KEPT_CORS_ORIGINS`.
- `KEPT_CALDAV_ALLOWED_PRIVATE_ORIGINS`: optional comma-separated origins for trusted CalDAV services on private networks, for example `http://calendar:5232,https://calendar.home:8443`.
- `KEPT_PUSH_ALLOWED_PRIVATE_ORIGINS`: optional comma-separated HTTPS origins for custom private web-push services. Standard browser push providers need no exception.
- `KEPT_TAKEOUT_UPLOAD_MAX`: Google Takeout ZIP upload cap. Defaults to `5GB`; only affects Takeout imports.
- `PUID` / `PGID`: choose the app user/group when the container starts as root. An explicit Compose `user:` overrides these; see the optional non-root setup above.
- `KEPT_ALLOW_RESTORE`: temporarily enables restore from backup during setup.
- `VAPID_SUBJECT`: optional public URL/contact identity for web push. SageKept auto-generates VAPID keys if you do not set them; only set this if push notifications need a more explicit public origin.

CalDAV and web-push delivery block private, loopback, link-local, and reserved destinations by default, including for previously saved integrations. If your calendar or custom push service is internal, add only its exact origin (scheme, hostname/IP, and port) to the corresponding setting above and restart SageKept. Paths, wildcards, and credentials are not accepted in these settings. An exception lets accounts on the instance reach that service; only list services you trust. CalDAV supports HTTP and HTTPS; push delivery requires HTTPS, and HTTPS certificate checks remain enabled. Use the final CalDAV URL, since redirects are not followed.

These settings govern outgoing integration requests, not the address used to access SageKept. They do not require an HTTP/LAN SageKept installation to change its own URL or reverse-proxy setup.

### Docker secrets

Secret values can come from mounted files instead of environment variables. For example, add this to your Compose configuration:

```yaml
services:
  kept:
    environment:
      KEPT_OIDC_CLIENT_SECRET_FILE: /run/secrets/oidc_client_secret
    secrets:
      - oidc_client_secret

secrets:
  oidc_client_secret:
    file: ./secrets/oidc_client_secret.txt
```

Put the secret value in that file and keep it out of version control. This example shows only the additions; keep your existing image, ports, volumes, and other settings. If your existing `environment` uses list syntax, add `- KEPT_OIDC_CLIENT_SECRET_FILE=/run/secrets/oidc_client_secret` there instead.

The `_FILE` alternative is supported for `KEPT_OIDC_CLIENT_SECRET`, `KEPT_SMTP_USER`, `KEPT_SMTP_PASS`, `KEPT_SETUP_TOKEN`, `KEPT_METRICS_TOKEN`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`. Existing direct variables continue to work. Set only one source per value; an empty direct variable is treated as unset.

Files are read once at startup and must be readable by the runtime user configured through Compose `user:` or `PUID`/`PGID`. SageKept removes trailing line endings while preserving spaces. Missing, unreadable, empty, invalid UTF-8, oversized (over 64 KiB), or conflicting secrets stop startup with an error naming the setting, without printing the value. Restart SageKept after replacing a secret. The example's `secrets/` directory is excluded from Git and Docker builds; if you use another location, keep it out of version control and the Docker build context too.

### Inviting users by email (optional)

Admins can always create accounts directly from User Management. If you'd rather send someone a link they set their own username/password from, configure an SMTP relay and an admin can turn on "Invite by email" in User Management — the option is hidden entirely until SMTP is configured, and off by default even then.

- `KEPT_SMTP_HOST`: SMTP server hostname. Leaving this unset disables invite-by-email entirely; no UI for it appears anywhere.
- `KEPT_SMTP_PORT`: SMTP port. Defaults to `587`.
- `KEPT_SMTP_SECURE`: set to `1` for implicit TLS (typically port `465`). Defaults to STARTTLS.
- `KEPT_SMTP_USER` / `KEPT_SMTP_PASS`: optional SMTP credentials.
- `KEPT_SMTP_FROM`: the `From` address on invite emails.

This works with any SMTP relay — a personal email account's SMTP, or any transactional-email provider's free tier — nothing here is tied to a specific vendor.

## OAuth, MCP, And External Access

SageKept includes an optional OAuth 2.1 authorization server for third-party apps and integrations. OAuth clients can request read-only or read/write access to the supported SageKept API without receiving a user's password or long-lived local MCP token. See [the OAuth integration guide](docs/oauth.md).

Remote MCP is one consumer of that OAuth layer. Local MCP clients can use stdio with a dedicated token; remote clients such as ChatGPT can connect to the Streamable HTTP endpoint at `/mcp`. OAuth app access and local MCP access are independent, off-by-default settings, so either can be enabled or revoked without affecting the other. Locked notes and permanent deletion have separate shared opt-in controls. See [the MCP setup and security guide](docs/mcp.md).

## Keyboard shortcuts

<details>
<summary>Show web keyboard shortcuts</summary>

Use **Ctrl** on Windows/Linux or **⌘** on Mac where both are listed. Shortcuts act on the focused field; selecting or deleting notes does not override normal text editing.

### Notes overview

| Shortcut | Action |
| --- | --- |
| Ctrl/⌘ + A | Select all notes in the current view or search, when not editing text or inside a dialog. |
| Delete / Backspace | Move selected notes to Trash on desktop. Does not permanently delete notes already in Trash. |
| Escape | Clear the selection on desktop, or save and close an open note when no popup is open. |
| Escape while dragging | Cancel dragging a note into a binder or reordering labels/binders. |

### Note editing

| Shortcut | Action |
| --- | --- |
| Ctrl/⌘ + Enter | From note text, save the note and start another. Inside a code block, leave the block instead. |
| Ctrl/⌘ + Z | Undo. |
| Ctrl/⌘ + Shift + Z | Redo. |
| Ctrl/⌘ + B / I / U | Apply bold, italic or underline in rich text; these do not format code blocks. |
| Three backticks (` ``` `) on their own line, then Enter | Insert a code block. |

### Checklists

| Shortcut | Action |
| --- | --- |
| Enter | Split the current item at the cursor and create the next row. |
| Enter in an empty “List item” field | Continue with regular text below the list. |
| Tab / Shift + Tab | Indent / outdent an item. When completed-item suggestions are visible, Tab first moves to the suggestions. |
| ↑ / ↓ | Move between checklist rows when the cursor reaches the top or bottom of a row. |
| Backspace at the start of an item | Join it with the preceding item, preserving the text. |
| Backspace / Delete in an empty checklist | Remove the list when it has no items, or only one empty item with no unfinished text below it. Undo restores it. |
| Enter / Space in a checklist menu | Activate the focused action. |
| Escape in a checklist menu | Close the menu and return focus to its button. |

### Code blocks

| Shortcut | Action |
| --- | --- |
| Tab / Shift + Tab | Insert two spaces / remove indentation. |
| Ctrl/⌘ + Enter or Escape | Leave the code block and continue writing below it. |
| Backspace in an empty code block | Replace it with an ordinary text line. |

</details>

## Development

SageKept is an Angular 21 application with a Node/Express backend and SQLite storage.

```bash
npm install
npm run dev
```

Useful scripts:

- `npm run dev` — builds the Angular bundle (if not already built) and starts the Express + SQLite server
- `npm run build` — prepares i18n catalogues, compiles the Angular production bundle to `dist/keep`, and runs PurgeCSS
- `npm run start` — starts the Node/Express server (`server/server.js`)
- `npm run lint` — runs TypeScript type-checking (`tsc -p tsconfig.app.json --noEmit`)
- `npm run api` — runs the Express backend with `nodemon`
- `npm run client` — runs the Angular dev server with translation watcher and API proxy

## Translations

Help translate the web/in-app UI and native Android/iOS screens together in this repository. See the [translation contribution guide](translations/README.md). English is currently the only shipped language.

## Build It Yourself

To build and run SageKept locally from source with Docker Compose:

```bash
git clone https://github.com/Sage222/SageKept.git SageKept
cd SageKept
docker compose up -d --build
```

Or build and run directly with Node.js:

```bash
git clone https://github.com/Sage222/SageKept.git SageKept
cd SageKept
npm install
npm run build
PORT=6767 npm run start
```

## Acknowledgement

SageKept is forked from [ericerkz/kept](https://github.com/ericerkz/kept). Kept's original UI scaffolding was forked from [aBrihoum/google-keep-clone](https://github.com/aBrihoum/google-keep-clone) and substantially rewritten and extended into a full self-hosted notes platform.
