# browser-tools (cross-platform)

Chrome DevTools Protocol (CDP) tools for agent-assisted web automation. The scripts
connect to a Chrome instance running with remote debugging on `:9222` and let an AI agent
navigate pages, extract readable content as Markdown, run JavaScript, take screenshots,
inspect cookies, pick DOM elements, and scrape Hacker News.

This is a **cross-platform, dependency-light** fork of the
[pi-skills `browser-tools`](https://github.com/badlogic/pi-skills) skill:

- **Auto-detects the Chrome executable** on macOS, Windows, and Linux (the original
  hardcoded the macOS path `/Applications/Google Chrome.app/...`, so it crashed on
  Windows/Linux).
- **Profile sync works everywhere** — it uses Node's `fs` to copy your Chrome profile
  instead of the macOS-only `rsync` invocation.
- **No Chromium download.** Scripts depend only on `puppeteer-core` and connect to your
  already-installed Chrome, so `npm install` is small and fast.
- **Robust CDP connection layer** — a shared `browser-connect.js` probes the endpoint,
  fails fast when Chrome is down, and connects straight to the websocket instead of
  relying on `puppeteer`'s fragile `browserURL` discovery (see
  [Connection & reliability](#connection--reliability)).

---

## Requirements

- [Node.js](https://nodejs.org/) **18+** (the scripts are ESM and use `fetch` /
  `AbortSignal.timeout`).
- Google Chrome (or Chromium) installed and on the default path.

---

## Install

### pi-coding-agent (recommended)

This repo is a valid pi package (it declares `pi.skills` in `package.json` and has a
conventional `skills/` directory), so a single command is enough:

```bash
pi install git:github.com/Frozen5293/Bowser_Skill_Cloned
```

pi clones the package to `~/.pi/agent/git/github.com/Frozen5293/Bowser_Skill_Cloned`,
runs `npm install` automatically, and discovers `skills/browser-tools/SKILL.md` as the
**`browser-tools`** skill. Inside a pi session, invoke it with:

```
/skill:browser-tools
```

or just describe the task; the agent loads the skill on demand.

### Manual / other harnesses

```bash
git clone https://github.com/Frozen5293/Bowser_Skill_Cloned
cd Bowser_Skill_Cloned && npm install
```

Then point your harness at `skills/browser-tools/`:

- **pi** — add to `~/.pi/agent/settings.json`:
  ```json
  { "skills": ["/abs/path/to/Bowser_Skill_Cloned/skills/browser-tools"] }
  ```
- **Claude Code** — only looks one level deep for `SKILL.md`, so symlink the folder:
  ```bash
  mkdir -p ~/.claude/skills
  ln -s "$PWD/skills/browser-tools" ~/.claude/skills/browser-tools
  ```
- **Codex CLI / Amp / Droid** — copy or symlink `skills/browser-tools/` into the
  harness's skills directory, then run `npm install` in the repo root.

> **Note:** `browser-hn-scraper.js` is a plain Node script (uses `cheerio` + `fetch`) and
> does **not** need Chrome or the CDP connection.

---

## Quick start

```bash
# 1. (pi install already did this) install dependencies
npm install

# 2. launch Chrome with remote debugging on :9222
node skills/browser-tools/browser-start.js

# 3. drive it
node skills/browser-tools/browser-nav.js https://example.com
node skills/browser-tools/browser-content.js https://example.com
node skills/browser-tools/browser-eval.js 'document.title'
node skills/browser-tools/browser-screenshot.js
node skills/browser-tools/browser-pick.js "Click the submit button"
```

Inside pi you normally don't call these directly — the skill's `SKILL.md` tells the agent
how, and `{baseDir}` is expanded to the skill directory at runtime.

---

## Tools reference

All scripts take Chrome's existing session on `:9222`. Unless noted, they connect with
the shared helper, so they fail fast (~0.15s) with a clear message if Chrome isn't
running.

### `browser-start.js [--profile]`

Launch Chrome with remote debugging enabled.

| Flag | Effect |
|------|--------|
| *(none)* | Fresh, isolated profile at `~/.cache/browser-tools` |
| `--profile` | Copy your real Chrome profile (cookies, logins) first |

- Idempotent: if Chrome is already reachable on `:9222`, it prints
  `✓ Chrome already running` and exits.
- Launches a **visible** window (interactive mode is the point of this skill).
- Detects the Chrome binary per platform; falls back to `google-chrome` on PATH.
- Removes stale `SingletonLock` files and skips volatile session files when copying a
  profile.
- **Headless servers:** start Chrome yourself with `--headless=new`, e.g.
  ```bash
  google-chrome --headless=new --remote-debugging-port=9222 \
    --user-data-dir="$HOME/.cache/browser-tools"
  ```

### `browser-nav.js <url> [--new] [--reload]`

Navigate the active tab.

| Flag | Effect |
|------|--------|
| `--new` | Open the URL in a **new** tab |
| `--reload` | Force a reload after navigating |

Uses `waitUntil: "domcontentloaded"` (fast; JS-heavy pages may need a follow-up
`browser-eval.js` or a short `sleep`).

### `browser-eval.js '<js>'`

Evaluate JavaScript in the active tab. Code runs in an **async** context, so `await` is
allowed. The value of the last expression is printed.

```bash
node browser-eval.js 'document.title'
node browser-eval.js 'document.querySelectorAll("a").length'
node browser-eval.js '(async () => (await fetch("/api")).status)()'
```

> **Efficiency tip:** prefer one big IIFE over many small calls. Return a JSON string and
> inspect the DOM directly instead of screenshotting.

```bash
node browser-eval.js '(function(){
  return JSON.stringify(Array.from(document.querySelectorAll("button"))
    .map(b => ({ id: b.id, text: b.textContent.trim() })));
})()'
```

### `browser-content.js <url>`

Navigate to a URL and extract the **readable article** as Markdown (Mozilla Readability +
Turndown, with a GFM plugin). Prints:

```
URL: <final url>
Title: <article title>

<markdown>
```

Waits up to `CONTENT_NAV_TIMEOUT` (default 10000 ms) for the page, then parses the DOM via
CDP (works even with TrustedScriptURL restrictions). Falls back to a heuristic
`main`/`article` extraction when Readability fails.

### `browser-screenshot.js`

Capture the current viewport. Prints the path to a temporary PNG in your OS temp dir
(e.g. `/tmp/screenshot-<timestamp>.png`). Use it to visually verify UI state, not to read
page structure.

### `browser-cookies.js`

Print all cookies for the active tab with domain, path, `httpOnly`, and `secure` flags.
Useful for debugging auth/session state.

### `browser-pick.js '<message>'`

Launch an **interactive element picker** in the visible page. The banner shows your
message. The user hovers to highlight, **click** to select one element, or
**Cmd/Ctrl+click** to select several, then **Enter** to finish (**Esc** to cancel).

Returns, for each selected element:

| Field | Meaning |
|-------|---------|
| `tag` | Lowercase tag name |
| `id` | Element id or `null` |
| `class` | `className` or `null` |
| `text` | Trimmed text content (max 200 chars) |
| `html` | `outerHTML` (max 500 chars) |
| `parents` | Ancestor chain, e.g. `div.card > ul > li` |

Use this when the page structure is complex or ambiguous and you need exact selectors.

### `browser-hn-scraper.js [--limit <n>]`

Standalone Hacker News front-page scraper (no Chrome needed). Default limit 30. Prints a
JSON array to **stdout** and a summary line to **stderr**:

```json
[
  { "id": "41234567", "title": "...", "url": "...", "points": 123,
    "author": "...", "time": "...", "comments": 45,
    "hnUrl": "https://news.ycombinator.com/item?id=41234567" }
]
```

---

## Connection & reliability

All CDP scripts share `skills/browser-tools/browser-connect.js`:

- `probeBrowser()` — `GET /json/version` with a short timeout (`CDP_PROBE_TIMEOUT`,
  default 2000 ms). Lets every script **fail in ~0.15s** when Chrome is down instead of
  hanging for seconds.
- `connectBrowser()` — probes first, then connects **directly to
  `webSocketDebuggerUrl`** with `puppeteer.connect({ browserWSEndpoint })`. This avoids
  `puppeteer`'s `browserURL` discovery step, which can hang once Chrome has accumulated
  extra targets (`chrome://` pages, recaptcha workers). Connection timeout:
  `CDP_CONNECT_TIMEOUT` (default 15000 ms).
- `getActivePage(browser)` — returns the last real page, skipping `about:blank` and
  `chrome://` targets (so it won't accidentally select an Omnibox `browser_ui` target),
  and opens a new tab if there is none.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CDP_HOST` | `http://localhost:9222` | Debug endpoint for all scripts |
| `CDP_PROBE_TIMEOUT` | `2000` | Reachability probe timeout (ms) |
| `CDP_CONNECT_TIMEOUT` | `15000` | WebSocket connect / protocol timeout (ms) |
| `CONTENT_NAV_TIMEOUT` | `10000` | `browser-content.js` page-wait (ms) |
| `CONTENT_TIMEOUT` | `30000` | `browser-content.js` overall timeout (ms) |

> **Chrome died mid-session?** Just re-run `browser-start.js`. It probes first and will
> relaunch a fresh instance; no manual cleanup needed.

---

## Recipes

**Extract today's headlines from a news site**

```bash
node skills/browser-tools/browser-nav.js https://techcrunch.com/
node skills/browser-tools/browser-eval.js '(function(){
  return JSON.stringify(Array.from(document.querySelectorAll("h2 a, h3 a"))
    .slice(0, 20).map(a => ({ t: a.textContent.trim(), h: a.href })));
})()'
```

**Read a full article as Markdown**

```bash
node skills/browser-tools/browser-content.js https://example.com/article > article.md
```

**Batch interactions in one call**

```bash
node skills/browser-tools/browser-eval.js '(function(){
  ["btn-login","btn-accept"].forEach(id => document.getElementById(id)?.click());
  return "clicked";
})()'
```

**Let the user point at elements, then act on the selectors**

```bash
node skills/browser-tools/browser-pick.js "Select the product cards"
# -> returns selectors, then:
node skills/browser-tools/browser-eval.js 'document.querySelectorAll("<selector>").length'
```

---

## Repository layout

```
.
├── package.json                 # deps + pi.skills manifest
├── README.md
├── LICENSE
└── skills/
    └── browser-tools/
        ├── SKILL.md             # loaded by pi as the "browser-tools" skill
        ├── browser-connect.js   # shared CDP connection helper
        ├── browser-start.js
        ├── browser-nav.js
        ├── browser-eval.js
        ├── browser-content.js
        ├── browser-screenshot.js
        ├── browser-cookies.js
        ├── browser-pick.js
        └── browser-hn-scraper.js
```

---

## Notes

- Only `puppeteer-core` is used; the full `puppeteer` package (and its ~150 MB Chromium
  download) is intentionally **not** a dependency.
- `browser-start.js` launches a **visible** Chrome.
- Review skill/script content before use — these tools execute arbitrary JavaScript in
  your logged-in browser. Use the fresh profile unless you actually need your logins.

## License

MIT — see [LICENSE](LICENSE).
