const logger = require('./utils/logger');
const { launchContext, ensureLoggedIn } = require('./services/sessionService');
const { runOnce, startPolling } = require('./services/monitorService');

const NaukriPage = require('./pages/NaukriPage');
const LinkedInPage = require('./pages/LinkedInPage');
const IndeedPage = require('./pages/IndeedPage');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { mode: 'monitor', site: null };

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'mode') parsed.mode = value;
    if (key === 'site') parsed.site = value;
  }
  return parsed;
}

function adapterForSite(site) {
  switch (site) {
    case 'naukri':
      return new NaukriPage();
    case 'linkedin':
      return new LinkedInPage();
    case 'indeed':
      return new IndeedPage();
    default:
      throw new Error(`Unknown site "${site}". Use naukri, linkedin, or indeed.`);
  }
}

/**
 * `login` mode: opens a single site headed, logs in (or lets you complete
 * 2FA/CAPTCHA manually), then saves the session so later runs can skip
 * login entirely. Run this once per site before using `apply`/`monitor`.
 */
async function runLogin(site) {
  const adapter = adapterForSite(site);
  const { browser, context, page } = await launchContext(adapter);
  try {
    await ensureLoggedIn(adapter, page, context);
    logger.info(`[${site}] Login flow complete — session saved for future runs.`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const { mode, site } = parseArgs();

  switch (mode) {
    case 'login':
      if (!site) throw new Error('Specify --site=naukri|linkedin|indeed for login mode.');
      await runLogin(site);
      break;

    case 'apply':
      await runOnce();
      break;

    case 'monitor':
      await startPolling();
      break;

    default:
      logger.error(`Unknown mode "${mode}". Use login, apply, or monitor.`);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.stack || err.message}`);
  process.exitCode = 1;
});
