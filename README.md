# AI Adoption Coverage Tracker

A single-page JavaScript application for tracking client progress through CGI's AI adoption journey.

## Features

### Coverage Tracking tab
| Column | Description |
|---|---|
| **Client** | Editable client name (click to edit inline) |
| **AI Permissions** | Four boolean flags per client |
| ↳ Work Questions | Can use AI for work-related questions |
| ↳ Artifacts | Can use AI for producing artifacts |
| ↳ Agentic (Own) | Can use AI for agentic access on their own systems |
| ↳ Agentic (Mixed) | Can use AI for agentic access on mixed systems |
| **AI Applied** | AI is actively applied in the client's workflow |
| **AI Benefits** | Measurable AI benefits have been achieved |
| **Progress** | Visual step indicator: Permissions → Applied → Benefits |

### Summary tab
Horizontal bar chart showing each client's overall adoption percentage, colour-coded by stage.

## Data storage
All data is persisted in the browser's `localStorage` — no backend required.

## Deployment

### GitHub Pages (automatic)
Push to `main` and the included GitHub Actions workflow (`.github/workflows/pages.yml`) will build and deploy the site automatically.

**One-time setup:**
1. Go to **Settings → Pages** in your GitHub repository.
2. Set **Source** to *GitHub Actions*.
3. Push to `main` — the workflow handles the rest.

### Local development
Open `index.html` directly in a browser — no build step needed.
