# Job Application Assistant

A Playwright + Node.js tool that monitors Naukri, LinkedIn, and Indeed for
React JS / React Native / Frontend roles (Mumbai, Navi Mumbai, Thane; 2–4
years experience), and helps with straightforward, one-click/Easy-Apply
application flows. Whenever a posting has extra screening questions the bot
can't safely answer, it **stops and logs the job for manual review** instead
of guessing.

## ⚠️ Before you use this

- **Terms of Service**: LinkedIn, Naukri, and Indeed all restrict automated
  activity on their platforms in their Terms of Service. Automating logins
  and applications can trigger account flags, CAPTCHAs, or bans — this is
  true even with careful, human-paced automation. Use your own account, keep
  volumes low (`MAX_APPLICATIONS_PER_RUN`), and expect to intervene manually
  when checkpoints appear.
- **Selectors drift**: job sites change their HTML frequently. The CSS
  selectors in `src/pages/*.js` reflect each site's structure at the time
  this project was written and **will need periodic updates**. Run with
  `HEADLESS=false` the first few times so you can watch what happens and fix
  any broken selectors quickly.
- This tool is a starting point/framework, not a polished, guaranteed-working
  scraper — treat it as something you'll maintain.

## Features

- Clean separation of `config/`, `src/services/`, `src/pages/`, `src/utils/`
- Session persistence via Playwright `storageState` (log in once per site)
- Search across configurable title/location/experience combinations
- Auto-applies to simple one-click/Easy Apply postings only
- Stops and flags jobs with extra screening questions for manual review
- JSON **and** CSV logs (company, title, URL, time found, status, notes)
- Retries with backoff on transient failures (`p-retry`)
- Automatic screenshots on errors and manual-review cases
- ESLint + Prettier configured

## Folder structure

```
job-application-assistant/
├── config/
│   └── config.js          # Loads .env, exposes typed config object
├── src/
│   ├── index.js            # CLI entry point (login / apply / monitor modes)
│   ├── pages/               # Site-specific Playwright page objects
│   │   ├── BasePage.js
│   │   ├── NaukriPage.js
│   │   ├── LinkedInPage.js
│   │   └── IndeedPage.js
│   ├── services/
│   │   ├── sessionService.js       # Browser/context bootstrap + login
│   │   ├── jobMatcherService.js    # Title/location relevance filtering
│   │   ├── applicationService.js   # Apply flow orchestration + logging
│   │   └── monitorService.js       # Polling loop across all sites
│   └── utils/
│       ├── logger.js        # Winston console + file logger
│       ├── jsonLogger.js    # JSON-array log store, dedupe by URL
│       ├── csvLogger.js     # CSV append helper
│       ├── retry.js         # p-retry wrapper + human-like random delay
│       └── screenshot.js    # Error/review screenshot capture
├── logs/                    # Generated: applications.json/csv, screenshots/
├── sessions/                # Generated: storageState.json per site
├── .env.example             # Copy to .env and fill in
├── .eslintrc.json
├── .prettierrc
└── package.json
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`: set your credentials, job titles, locations, experience
   range, and behaviour flags (`AUTO_SUBMIT`, `HEADLESS`,
   `MAX_APPLICATIONS_PER_RUN`, etc.).

3. **Log in to each site once** (headed, so you can solve any CAPTCHA/2FA):

   ```bash
   npm run login:naukri
   npm run login:linkedin
   npm run login:indeed
   ```

   This saves a `storageState` file under `sessions/` so future runs reuse
   the session instead of logging in again.

## Usage

- **Run once** (search + apply, then exit):

  ```bash
  npm run apply
  ```

- **Run continuously**, polling every `POLL_INTERVAL_MINUTES`:

  ```bash
  npm run monitor
  ```

- **Lint / format**:

  ```bash
  npm run lint
  npm run format
  ```

## How "extra questions" detection works

Each site adapter's `applyToJob()` walks through the apply flow step by
step. If it encounters a free-text input, textarea, or chatbot-style
screening question it can't confidently fill in from your saved profile, it:

1. Takes a screenshot (`logs/screenshots/`)
2. Logs the job with `status: "manual_review"` to
   `logs/manual_review.json` / `.csv`
3. Moves on to the next job — it never submits a guessed answer

Review `logs/manual_review.csv` periodically and apply to those manually.

## Logs

| File | Contents |
|---|---|
| `logs/applications.json` / `.csv` | Jobs successfully applied to (or skipped) |
| `logs/manual_review.json` / `.csv` | Jobs needing your manual input |
| `logs/activity.log` | Full run log (info/warn/error) |
| `logs/screenshots/` | Screenshots taken on errors or manual-review cases |

Each record includes: `company`, `title`, `url`, `source`, `timeFound`,
`status` (`applied` / `manual_review` / `skipped` / `pending` / `failed`),
and `notes`.

## Extending to a new site

1. Create `src/pages/NewSitePage.js` extending `BasePage`, implementing
   `login()`, `searchJobs()`, and `applyToJob()`.
2. Add its config block to `config/config.js` (`sites.newsite`).
3. Register it in `buildEnabledAdapters()` in `src/services/monitorService.js`
   and in `adapterForSite()` in `src/index.js`.
