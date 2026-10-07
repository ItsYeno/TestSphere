# TestSphere

**Assurance testing for the apps and AI agents an organization deploys.**

TestSphere is the trust layer of the platform:

- **THE EYE** shows how the organisation is performing and who owns each fix.
- **BuildAI** knows what the approved procedures say to do about it.
- **TestSphere** proves the apps and agents give the right, safe answer, before go-live and on every scheduled run after it.

You describe what should happen in plain YAML: a journey through a web or mobile app, or a set of questions a department agent must answer from its approved documents. TestSphere runs it in Chrome, Edge or Firefox, on Android or iOS through Appium, or against a BuildAI knowledge base. Every run gives a visual report, a JUnit file for CI, and a pass/fail history, so trust is measured rather than assumed.

```yaml
name: Maintenance agent · golden questions
target: maintenance
cases:
  - ask: What is the vibration alarm limit for centrifugal pumps?
    expect:
      mentions: ["7 mm/s"]
      cites: [Pump Vibration Monitoring]
      grounded: true
  - ask: What is the share price today?
    expect: { declines: true }
```

To see it, open the console: `node runner/bin/testsphere.js console runner/examples`.

**Start here: [`runner/README.md`](runner/README.md)**

## What's in this repository

| Folder | What it is |
|---|---|
| [`runner/`](runner) | **TestSphere 2.** The engine, the CLI and the TestSphere Console, with the BuildAI connector, reports and example suites for BuildAI and THE EYE. |
| [`legacy/`](legacy) | **TestSphere 1.** The results dashboard and upload CLI first built for MTN's app teams, kept for reference. |
