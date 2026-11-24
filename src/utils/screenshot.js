const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const logger = require('./logger');

fs.mkdirSync(config.screenshotsDir, { recursive: true });

/**
 * Captures a full-page screenshot of the given Playwright page, tagged with
 * a context label and timestamp. Used whenever an error occurs, or when a
 * job posting is flagged for manual review, so it is easy to see exactly
 * what the bot saw.
 */
async function captureScreenshot(page, contextLabel = 'error') {
  const safeLabel = contextLabel.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);
  const filename = `${Date.now()}_${safeLabel}.png`;
  const filePath = path.join(config.screenshotsDir, filename);

  try {
    await page.screenshot({ path: filePath, fullPage: true });
    logger.info(`Screenshot saved: ${filePath}`);
    return filePath;
  } catch (err) {
    logger.error(`Failed to capture screenshot: ${err.message}`);
    return null;
  }
}

module.exports = { captureScreenshot };
