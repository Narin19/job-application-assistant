const config = require('../../config/config');
const logger = require('../utils/logger');
const { launchContext, ensureLoggedIn } = require('./sessionService');
const { runForSite } = require('./applicationService');

const NaukriPage = require('../pages/NaukriPage');
const LinkedInPage = require('../pages/LinkedInPage');
const IndeedPage = require('../pages/IndeedPage');

function buildEnabledAdapters() {
  const adapters = [];
  if (config.sites.naukri.enabled) adapters.push(new NaukriPage());
  if (config.sites.linkedin.enabled) adapters.push(new LinkedInPage());
  if (config.sites.indeed.enabled) adapters.push(new IndeedPage());
  return adapters;
}

/**
 * Runs one full pass: for every enabled site, log in (restoring session if
 * possible), search for matching jobs, and attempt straightforward
 * applications. Each site's browser context is closed before moving to the
 * next, keeping memory use predictable.
 */
async function runOnce() {
  const adapters = buildEnabledAdapters();
  if (adapters.length === 0) {
    logger.warn('No sites are enabled — check your .env *_ENABLED flags.');
    return;
  }

  const totals = { applied: 0, manualReview: 0, externalApplyNeeded: 0, skipped: 0, failed: 0 };

  for (const adapter of adapters) {
    logger.info(`=== Starting run for ${adapter.siteKey} ===`);
    const { browser, context, page } = await launchContext(adapter);

    try {
      await ensureLoggedIn(adapter, page, context);
      const summary = await runForSite(adapter, page);

      totals.applied += summary.applied;
      totals.manualReview += summary.manualReview;
      totals.externalApplyNeeded += summary.externalApplyNeeded;
      totals.skipped += summary.skipped;
      totals.failed += summary.failed;
    } catch (err) {
      logger.error(`[${adapter.siteKey}] Run failed: ${err.message}`);
      await adapter.onError(page, 'run_failed');
    } finally {
      await context.close();
      await browser.close();
    }
  }

  logger.info(
    `=== Run complete === applied=${totals.applied} manual_review=${totals.manualReview} external_apply_needed=${totals.externalApplyNeeded} skipped=${totals.skipped} failed=${totals.failed}`
  );
  return totals;
}

/**
 * Repeats runOnce() forever, waiting the configured poll interval between
 * passes. Intended to be started with `npm run monitor` and left running.
 */
async function startPolling() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await runOnce();
    const waitMs = config.behaviour.pollIntervalMinutes * 60 * 1000;
    logger.info(`Sleeping ${config.behaviour.pollIntervalMinutes} minutes until next run...`);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

module.exports = { runOnce, startPolling, buildEnabledAdapters };
