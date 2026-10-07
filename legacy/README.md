# TestSphere 1 (legacy)

The original TestSphere: a results dashboard built for MTN's app teams. Testers wrote WebdriverIO and Appium scripts by hand, recorded steps with the reporter, and uploaded the results through the CLI to an Express and Postgres backend with a React dashboard.

It's kept here for reference. TestSphere 2, in [`../runner`](../runner), replaces it: flows are written in YAML, runs happen in the TestSphere Console, and reports are generated without a server.

| Folder | What it is |
|---|---|
| `backend/` | Express API with Postgres (Sequelize): users, teams, projects, test runs and uploads |
| `frontend/` | React and Material UI dashboard |
| `testsphere-cli/` | Upload CLI and per-framework result parsers |
| `docs/`, `docker-compose.yml`, `package.json`, `run.txt` | Setup for the dashboard (`npm run install:all`, then `npm run dev`, from this folder) |

Paths inside this folder are unchanged, so the commands in `docs/SETUP.md` work when run from `legacy/`.

The unfinished work on this dashboard (sign-up with admin approval, an admin panel, video handling, a CLI manual page, and the hand-written myMTN test and its locator map) is on the `v1-dashboard-wip` branch. That branch is local to this computer.
