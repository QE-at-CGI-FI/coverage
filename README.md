# AI Native Development Coverage Tracker

A single-page JavaScript application for tracking client progress through CGI's AI adoption journey.

## Features

### Coverage Tracking tab

**Toolbar**

- Add Client, Anonymize (hide real names), Export (JSON), Import (JSON), and Search

**Stats cards** — live aggregate counts at the top:
| Card | Description |
|---|---|
| Total Clients | Number of tracked clients |
| With Permissions | % of clients with at least one permission |
| AI Applied | % of clients with AI actively applied |
| AI Benefits | % of clients with measurable AI benefits |

**Table columns**
| Column | Description |
|---|---|
| **Client** | Editable client name (click to edit inline); colour indicates classification (red / purple / grey) |
| **AI Permissions** | Five boolean flags per client |
| ↳ Work Questions | Can use AI for work-related questions |
| ↳ Specs | Can use AI for specs |
| ↳ Code | Can use AI for code |
| ↳ Agentic | Can use AI for agentic access |
| ↳ Secrets | Can use AI with secrets |
| **AI Applied** | Three sub-flags: Generative, Agentic, Dark Factory |
| **AI Benefits** | Three sub-flags: Task, Individual, Project |
| **Progress** | Visual step indicator: Not started → Permissions → Applied → Benefits |
| **Actions** | Open Limitations or Attention modals for the client |

**Limitations modal** — per-client flags grouped into:

- _Tools_: GitHub Copilot, Amazon Q, Codex, Claude Code, Atlassian Rovo
- _Settings_: MCP control, Confidential Test Data, No internet access

**Attention modal** — flags items that need action (e.g. Use without permissions)

### Summary tab

Horizontal bar chart showing each client's overall adoption percentage, colour-coded by stage (Permissions / Applied / Benefits).

## Data storage

All data is persisted in the browser's `localStorage` — no backend required.

## Deployment

### GitHub Pages (automatic)

Push to `main` and the included GitHub Actions workflow (`.github/workflows/pages.yml`) will build and deploy the site automatically.

**One-time setup:**

1. Go to **Settings → Pages** in your GitHub repository.
2. Set **Source** to _GitHub Actions_.
3. Push to `main` — the workflow handles the rest.

### Local development

Open `index.html` directly in a browser — no build step needed.
