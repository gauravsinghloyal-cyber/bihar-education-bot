# Copilot Instructions for Bihar Education Bot

## Project Overview
- **Purpose:** Telegram bot for Bihar government jobs, university info, exam results, admit cards, and study materials.
- **Main file:** `bot.js` (all logic, data, and integrations are here)
- **Bot Username:** `@BiharEducationBot`

## Architecture & Data Flow
- **Single-file architecture:** All bot logic, data stores, scraping, and handlers are in `bot.js`.
- **Data sources:**
  - Hardcoded job, admit card, result, and university data arrays
  - Web scraping (BPSC, BSSC, CSBC, BPSSC, FreeJobAlert)
  - Data is updated via scheduled cron jobs and on bot startup
- **User state:** Managed in-memory via Maps (`users`, `subscribers`, `userProfiles`, etc.)
- **Bot commands:** Handled via regex and message listeners; keyboard buttons trigger main features

## Developer Workflows
- **Install dependencies:** `npm install`
- **Run bot:** `npm start` (starts polling Telegram and Express server)
- **No tests or build steps** (no test framework or transpilation)
- **Environment variables:**
  - `TELEGRAM_BOT_TOKEN`, `ADMIN_IDS`, `CHANNEL_ID`, `PORT` (use `.env` file)

## Key Patterns & Conventions
- **Job/Result/Admit Card/University data:**
  - Use arrays of objects with consistent fields (see top of `bot.js`)
  - Scraped jobs are merged into these arrays, deduped by title
- **Web scraping:**
  - Use `axios` + `cheerio` for HTML parsing
  - Scraping selectors are customized per site (see `targetWebsites`)
  - Scraping runs on schedule (cron) and at startup
- **Telegram UI:**
  - Inline keyboards for navigation, actions, and external links
  - Markdown formatting for messages
  - Callback data for navigation and actions
- **User interaction:**
  - State managed via `userStates` Map
  - Search, subscribe, and profile features via message text and keyboard

## Integration Points
- **Telegram:** via `node-telegram-bot-api` (polling mode)
- **Express:** used for web server (minimal usage)
- **External sites:** scraped for job notifications and updates

## Examples
- **Add a new job source:** Update `targetWebsites` array and scraping logic
- **Add a new feature:** Implement as a new keyboard button and handler in `bot.on('message', ...)`
- **Change notification format:** Edit message templates in `postJobToChannel` and related functions

## Important Files
- `bot.js`: All bot logic, data, scraping, and handlers
- `.env`: Store secrets and config (not checked in)
- `package.json`: Dependencies (`node-telegram-bot-api`, `express`, `node-cron`, `axios`, `cheerio`)

---
If any section is unclear or missing, please specify what needs improvement or more detail.