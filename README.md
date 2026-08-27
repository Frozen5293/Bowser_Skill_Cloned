# browser-tools (cross-platform)

Chrome DevTools Protocol tools for agent-assisted web automation. They connect to a
Chrome instance running on `:9222` with remote debugging enabled and let an AI agent
navigate pages, extract readable content as Markdown, run JavaScript, take screenshots,
inspect cookies, and pick DOM elements.

This is a **cross-platform, dependency-light** fork of the
[pi-skills `browser-tools`](https://github.com/badlogic/pi-skills) skill:

- **Auto-detects the Chrome executable** on macOS, Windows, and Linux (the original
  hardcoded the macOS path `/Applications/Google Chrome.app/...`, so it crashed on
  Windows/Linux).
- **Profile sync works everywhere** — it uses Node's `fs` to copy your Chrome profile
  instead of the macOS-only `rsync` invocation.
- **No Chromium download.** Scripts depend only on `puppeteer-core` and connect to your
  already-installed Chrome, so `npm install` is small and fast.

## Requirements

- [Node.js](https://nodejs.org/) 18+ (the scripts are ESM).
- Google Chrome (or Chromium) installed and on the default path.

## Install

### pi-coding-agent

Clone into your user skills directory (discovered recursively):

```bash
git clone https://github.com/<you>/browser-tools-skill ~/.pi/agent/skills/browser-tools
cd ~/.pi/agent/skills/browser-tools && npm install
```

Or, to install straight from a git repo as a package, add to `~/.pi/settings.json`:

```json
{ "packages": ["git:github.com/<you>/browser-tools-skill"] }
```

Or point the `skills` array at a local checkout:

```json
{ "skills": ["/path/to/browser-tools-skill"] }
```

Then invoke it with `/skill:browser-tools`.

### Claude Code

Claude Code only looks one level deep for `SKILL.md`, so symlink the skill folder:

```bash
git clone https://github.com/<you>/browser-tools-skill
mkdir -p ~/.claude/skills
ln -s "$(pwd)/browser-tools-skill" ~/.claude/skills/browser-tools
cd ~/.claude/skills/browser-tools && npm install
```

### Codex CLI / Amp / Droid

Same idea — clone, then symlink (or copy) the skill folder into the harness's
`skills/` directory and run `npm install`.

## Setup

Run once before first use:

```bash
cd browser-tools-skill
npm install
```

## Usage

All commands expect Chrome to be running on `:9222`. Start it first:

```bash
node browser-start.js            # fresh profile
node browser-start.js --profile  # copy your Chrome profile (cookies, logins)
```

Then:

```bash
node browser-nav.js https://example.com          # navigate (add --new for a new tab)
node browser-content.js https://example.com      # extract readable content as Markdown
node browser-eval.js 'document.title'            # run JavaScript in the active tab
node browser-screenshot.js                       # screenshot the viewport -> temp PNG
node browser-cookies.js                          # list cookies for the current tab
node browser-pick.js "Click the submit button"   # interactive element picker
```

In pi, the placeholders in `SKILL.md` (`{baseDir}`) are expanded to this directory at
runtime, so you can also just use `/skill:browser-tools` and let the agent drive it.

## Notes

- `browser-start.js` launches a **visible** Chrome (the intended interactive mode). On a
  headless server, add `--headless=new` to the `spawn` arguments in `browser-start.js`,
  or start Chrome yourself:

  ```bash
  chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.cache/browser-tools"
  ```

- Only `puppeteer-core` is used; the full `puppeteer` package (and its ~150&nbsp;MB
  Chromium download) is intentionally **not** a dependency.

## License

MIT — see [LICENSE](LICENSE).
