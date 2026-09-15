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

Install directly from the git repository (it is a valid pi package with a `pi.skills`
manifest entry and a conventional `skills/` directory):

```bash
pi install git:github.com/Frozen5293/Bowser_Skill_Cloned
```

pi clones the package and runs `npm install` automatically, then discovers
`skills/browser-tools/SKILL.md`. Invoke it with `/skill:browser-tools`.

Alternatively, clone the repo into your user skills directory:

```bash
git clone https://github.com/Frozen5293/Bowser_Skill_Cloned ~/.pi/agent/skills/browser-tools-src
```

Or point the `skills` array at a local checkout:

```json
{ "skills": ["/path/to/browser-tools-skill"] }
```

### Claude Code

Claude Code only looks one level deep for `SKILL.md`, so symlink the skill folder:

```bash
git clone https://github.com/Frozen5293/Bowser_Skill_Cloned
mkdir -p ~/.claude/skills
ln -s "$(pwd)/Bowser_Skill_Cloned/skills/browser-tools" ~/.claude/skills/browser-tools
cd ~/.claude/skills/browser-tools && npm install
```

### Codex CLI / Amp / Droid

Same idea — clone, then symlink (or copy) the skill folder into the harness's
`skills/` directory and run `npm install`.

## Setup

If you installed with `pi install`, dependencies are already installed. Otherwise run
once before first use:

```bash
npm install
```

## Usage

All commands expect Chrome to be running on `:9222`. Start it first:

```bash
node skills/browser-tools/browser-start.js            # fresh profile
node skills/browser-tools/browser-start.js --profile  # copy your Chrome profile (cookies, logins)
```

Then:

```bash
node skills/browser-tools/browser-nav.js https://example.com          # navigate (add --new for a new tab)
node skills/browser-tools/browser-content.js https://example.com      # extract readable content as Markdown
node skills/browser-tools/browser-eval.js 'document.title'            # run JavaScript in the active tab
node skills/browser-tools/browser-screenshot.js                       # screenshot the viewport -> temp PNG
node skills/browser-tools/browser-cookies.js                          # list cookies for the current tab
node skills/browser-tools/browser-pick.js "Click the submit button"   # interactive element picker
```

In pi, the placeholders in `SKILL.md` (`{baseDir}`) are expanded to the skill directory
at runtime, so you can also just use `/skill:browser-tools` and let the agent drive it.

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
