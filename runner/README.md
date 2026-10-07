# TestSphere

TestSphere proves that what an organization deploys is safe to rely on. That means the **apps people use** (web, Android, iOS) and the **AI agents that answer them** (BuildAI knowledge bases). You describe what should happen in plain YAML. TestSphere runs it before go-live and again on a schedule, and every run leaves a visual report and a pass/fail history.

```
THE EYE     shows how the organisation is performing and who owns each fix
BuildAI     knows what the approved procedures say to do about it
TestSphere  proves the apps and agents give the right answer, every time
```

TestSphere started as a mobile and web automation tester for the myMTN app. That still works and has been rebuilt here. What's new is that the same flows now also test agents:

| Job | What TestSphere checks | Example |
|---|---|---|
| **Pre-deployment testing** | Golden questions per department agent: the right facts, cited from the right procedure | [`examples/agents/maintenance.yaml`](examples/agents/maintenance.yaml) |
| **Boundary checks** | The agent declines questions outside its approved knowledge and cites nothing | [`examples/agents/boundaries.yaml`](examples/agents/boundaries.yaml) |
| **Ongoing monitoring** | Scheduled re-runs; every report shows each flow's recent pass rate | `runs/history.jsonl` |
| **App testing** | What people see in BuildAI's web app, or a mobile app on a real phone | [`examples/web/`](examples/web), [`examples/mobile/`](examples/mobile) |
| **THE EYE** | Its screens (the illustrative-data notice, overdue tasks, KPIs), and that it accepts TestSphere's pass rate for its KPI | [`examples/the-eye/`](examples/the-eye) |

## The console

```bash
node bin/testsphere.js console examples
```

This opens TestSphere in your browser at http://localhost:4600. Each folder of flows is a suite. Press **Run** and every step appears as it happens: the screen TestSphere sees, or the question it asked an agent, the answer and its citations, and the verdict. The console also shows:

- **Where tests run:** each target and whether it's reachable right now (BuildAI, THE EYE, Appium).
- **Agent answers passing checks:** the pass rate from the latest agent run, against the target set under `theEye:` in the config.
- **Export for THE EYE:** that pass rate as a CSV in THE EYE's KPI actuals format. In THE EYE, open Workspace settings, then Import data, then KPI actuals.
- **Recent runs:** every past run, with its full report.

The console runs one suite at a time and listens only on this computer. Name suites and add descriptions under `suites:` in the config. `--port` changes the port and `--no-open` skips opening a browser.

## Quick start

Needs Node 20+ and Chrome, Edge or Firefox. Mobile needs [Appium 2](https://appium.io) and a device.

```bash
cd runner
npm install
npm test                                    # the engine's own tests; no browser or device needed
node bin/testsphere.js init                 # in an empty folder: a config and a first flow
node bin/testsphere.js run flows/
```

### The demo, in one step

Double-click `examples\local\start-demo.cmd`, or run `node examples/local/demo.mjs`. It starts BuildAI in simulation mode, serves THE EYE, loads the sample procedures, starts the console, and opens THE EYE (in a private window), BuildAI and the console in your browser. Keep its window open; Ctrl+C stops everything it started.

The first run writes BuildAI's `.env` (simulation mode, no API key, no spend) and creates the demo account; later runs reuse them. It expects BuildAI beside the TestSphere folder and THE EYE built in `Downloads/THE_EYE_source/the-eye/dist`. Set `BUILDAI_DIR` or `THE_EYE_DIST` in `examples/.env` if yours are elsewhere. If BuildAI's `.env` has `MOCK_LLM=false` and an `ANTHROPIC_API_KEY`, the same demo gives real answers.

### Try the examples against a local BuildAI, step by step (no API key, no spend)

1. Start BuildAI in mock mode from the `BuildAI` folder. `SETUP_TOKEN` is any long random string you choose:
   ```bash
   MOCK_LLM=true SETUP_TOKEN=choose-a-long-random-string npm run dev
   ```
2. Seed it with the sample procedures. This writes `examples/.env` with a local test account:
   ```bash
   BUILDAI_SETUP_CODE=choose-a-long-random-string node examples/local/seed.mjs
   ```
3. Open the console and run the suites from there:
   ```bash
   node bin/testsphere.js console examples
   ```
   Or run them from the terminal: `node bin/testsphere.js run examples/agents examples/web`.

The THE EYE suite needs THE EYE served locally: `python -m http.server 8765 --directory <THE EYE folder>/dist`.

In mock mode BuildAI answers by quoting the passages it retrieved, so these runs exercise TestSphere and BuildAI's search, citations and interface end to end. With a real `ANTHROPIC_API_KEY`, the same suites test the actual answers.

## Writing flows

A flow is a YAML file with a `target` (where it runs) and either `steps` or `cases`.

### An app flow

```yaml
name: Sign in and ask the Maintenance agent
target: buildai-web
locators: ./buildai.locators.yaml       # readable names for selectors
steps:
  - use: ./_sign-in.yaml                # reuse another flow's steps
  - tap: nav.maintenance
  - type: { into: chat.question, text: What is the vibration alarm limit? }
  - tap: chat.send
  - expect: { visible: chat.goodAnswer }
    timeout: 90s
  - tap: chat.firstCitation
  - expect: { visible: { textContains: Pump Vibration } }   # or find elements by their visible text
```

### An agent flow

Each case is scored on its own. One failure doesn't stop the others, and the report gives a pass rate.

```yaml
name: Maintenance agent · golden questions
target: maintenance
cases:
  - name: Vibration alarm limit
    ask: What is the vibration alarm limit for centrifugal pumps?
    expect:
      mentions: ["7 mm/s"]                 # facts the answer must contain
      cites: [Pump Vibration Monitoring]   # documents it must cite
      grounded: true                       # cites the knowledge base, no web pages
      latencyUnder: 60s

  - name: Out of scope
    ask: What is the share price today?
    expect: { declines: true }             # says its documents don't cover it, cites nothing
```

Each question starts a fresh conversation, so earlier answers can't leak into the one being tested. Use `ask: { question: ..., followUp: true }` to test a follow-up in the same conversation.

### Actions

| Action | Works on | Example |
|---|---|---|
| `open` | web | `open: /login` (joined to the target's `baseUrl`), `open: https://…`, `open: ./page.html` |
| `tap` (or `click`) | web, mobile | `tap: login.submit` · `tap: { text: Sign in }` · `tap: { textContains: Sign }` |
| `type` | web, mobile | `type: { into: login.email, text: "${email}" }` (clears first; `clear: false` to append) |
| `clear` | web, mobile | `clear: login.email` |
| `select` | web | `select: { in: form.country, option: Nigeria }` |
| `scrollTo` | web, mobile | `scrollTo: footer.contact` (on a device it swipes until the element appears) |
| `swipe` | mobile | `swipe: up` |
| `back` | web, mobile | `- back` |
| `press` | web | `press: Enter` |
| `hideKeyboard` | mobile | `- hideKeyboard` |
| `screenshot` | web, mobile | `screenshot: confirmation` |
| `wait` | all | `wait: 2s` (prefer `expect`, which waits only as long as needed) |
| `ask` | buildai | `ask: How do I isolate a pump?` |
| `expect` | all | see below |
| `use` | all | `use: ./_sign-in.yaml` or `use: { flow: ./_sign-in.yaml, with: { email: … } }` |

Any step can also have `name:` (its label in the report), `timeout:` (overrides the default wait) and `optional: true` (a failure becomes a warning, which is useful for dismissing pop-ups that only sometimes appear).

### Checks

| On screens | On answers |
|---|---|
| `visible: <element>` | `mentions: [phrases]`: all must appear (case and Markdown ignored) |
| `hidden: <element>` | `mentionsAny: [phrases]`: at least one |
| `text: <element>` with `equals:` or `contains:` | `excludes: [phrases]`: none may appear |
| `url: <part of the URL>` | `cites: [document titles]`: each must be cited (a part of the title is enough) |
| | `grounded: true`: cites the knowledge base and no web pages |
| | `declines: true`: says its documents don't cover it, and cites nothing |
| | `latencyUnder: 30s` |

Screen checks retry until they pass or the timeout runs out, so you never need fixed sleeps.

`declines` recognises the usual ways of saying "the documents don't cover this", plus BuildAI's own refusal status. It's phrase-based. If an agent declines in unusual wording, check the answer in the report.

## Locators

Name your selectors once in a locator file (YAML or JSON), nested by screen, and refer to them as `screen.element`. Existing locator maps load unchanged, including the ones written for the old hand-coded scripts.

- **Web:** CSS (`#email`, `button[type=submit]`) or XPath.
- **Mobile:** XPath and `new UiSelector()…` are used as written. Any other text is an accessibility id (content-desc), exactly as the old scripts used it. `id=…`, `~…` and `-ios predicate string:…` also work.
- **Everywhere:** `{ text: … }` or `{ textContains: … }` finds an element by its visible text.

A mistyped name fails before anything runs, with a suggestion (`Did you mean "HomePage.defaultSwipeRight.buyAirtime"?`).

## Targets

`testsphere.config.yaml` names the places flows run. TestSphere uses the nearest one above the flow, or `--config`.

```yaml
defaults:
  target: chrome
  timeout: 15s
  screenshots: every-step      # every-step | on-failure | off
  video: true                  # screen recording on Android and iOS

targets:
  chrome:      { platform: web, browser: chrome, headless: true, baseUrl: https://app.example.com }
  phone-view:  { platform: web, browser: chrome, emulate: "Pixel 7" }
  android:
    platform: android
    server: http://localhost:4723
    capabilities: { appium:automationName: UiAutomator2, appium:deviceName: …, appium:appPackage: …, appium:appActivity: … }
  maintenance:
    platform: buildai
    url: ${env.BUILDAI_URL:-http://localhost:3000}
    knowledgeBase: Maintenance   # omit for "All knowledge"
    mode: fast                   # fast | best | deep
    email: ${env.BUILDAI_EMAIL}
    password: ${env.BUILDAI_PASSWORD}
```

`chrome`, `edge` and `firefox` exist without any config. Use a dedicated BuildAI test account with viewer access to the knowledge bases under test. The conversations a run creates are deleted afterwards; set `keepConversations: true` to keep them.

## Variables and secrets

`${name}` comes from the flow's `vars:`, from a parent flow's `with:`, or from `--var name=value`, in increasing priority. `${env.NAME}` reads the environment, and `${env.NAME:-fallback}` gives a default. A `.env` file beside the config is loaded too, and real environment variables win.

Anything that came from the environment is masked as `••••••` in reports. YAML values stay text, so `08032001111` keeps its leading zero.

## Reports

Each run writes `runs/<date_time>/` beside the config:

- **`report.html`**: the verdict, then every flow. Failed flows open at the step that failed, with the screen at that moment. Each step has a screenshot (← → to page through them), each answer has its text and citations, mobile flows have a screen recording, and every flow shows its recent pass rate.
- **`result.json`**: everything in the report, for dashboards.
- **`junit.xml`**: for CI (Jenkins, GitLab, Azure DevOps, GitHub Actions). Each agent question is its own test case.
- **`runs/history.jsonl`**: one line per flow per run. This is where the trend in the report comes from.

Exit codes: `0` everything passed, `1` something failed or didn't run, `2` a flow or the config needs fixing (nothing ran).

## Running on a schedule

Run the same command from CI, cron or Windows Task Scheduler, for example every six hours:

```bash
node bin/testsphere.js run flows/agents --tag pre-deployment
```

Agent questions cost what BuildAI charges for them: roughly $0.01–0.03 each in Fast mode and $0.03–0.10 in Best mode. The report shows each run's agent cost.

## Moving from the old reporter

The old flow was: write WebdriverIO by hand, call `startTest/logStep/endTest`, then copy an upload command. Now the flow file is the test. A 120-line script with fixed `pause(2000)` waits becomes about ten lines of steps, and screenshots, video, page source on failure and the report all come automatically. [`examples/mobile/android-settings.yaml`](examples/mobile/android-settings.yaml) shows a mobile flow; point the `android` target's `appPackage` and `appActivity` at your own app.

## Not yet

- **Semantic grading.** Checks are deterministic phrase and citation matches. A grader that compares an answer's meaning to an approved answer would catch paraphrased mistakes.
- **A direct THE EYE feed.** THE EYE takes TestSphere's pass rate by file import today. When THE EYE has a backend, TestSphere can send the result after every run.
- **Video for web runs**, parallel runs and automatic retries.
