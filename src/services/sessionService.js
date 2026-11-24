const { chromium } = require('playwright');
const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Launches a browser + context for a given site adapter, restoring a saved
 * storage state (cookies/localStorage) when available so we don't have to
 * log in on every run.
 */
async function launchContext(pageAdapter) {
  const browser = await chromium.launch({ headless: config.behaviour.headless });

  const contextOptions = {
    viewport: { width: 1366, height: 850 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  if (pageAdapter.hasSavedSession()) {
    contextOptions.storageState = pageAdapter.siteConfig.storageStatePath;
    logger.info(`[${pageAdapter.siteKey}] Restoring saved session.`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  return { browser, context, page };
}

async function ensureLoggedIn(pageAdapter, page, context) {
  try {
    await pageAdapter.login(page);
    await pageAdapter.saveSession(context);
  } catch (err) {
    // Always leave a screenshot behind on login failure so it's possible to
    // see exactly what the site showed (cookie banner, CAPTCHA, changed
    // layout, etc.) without having to reproduce the failure live.
    await pageAdapter.onError(page, 'login_failed');
    throw err;
  }
}

module.exports = { launchContext, ensureLoggedIn };
