const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const logger = require('../utils/logger');
const { randomDelay } = require('../utils/retry');
const { captureScreenshot } = require('../utils/screenshot');

/**
 * Shared behaviour for every site-specific Page Object (Naukri, LinkedIn,
 * Indeed). Concrete subclasses must implement:
 *   - login(page)
 *   - searchJobs(page)          -> returns [{ title, company, url, source }]
 *   - openApplication(page, job)
 *   - applyToJob(page, job)     -> returns { status, notes }
 */
class BasePage {
  constructor(siteKey, siteConfig) {
    this.siteKey = siteKey;
    this.siteConfig = siteConfig;
  }

  /**
   * Restores a saved storage state (cookies/localStorage) if one exists.
   */
  hasSavedSession() {
    return fs.existsSync(this.siteConfig.storageStatePath);
  }

  async saveSession(context) {
    fs.mkdirSync(path.dirname(this.siteConfig.storageStatePath), { recursive: true });
    await context.storageState({ path: this.siteConfig.storageStatePath });
    logger.info(`[${this.siteKey}] Session saved to ${this.siteConfig.storageStatePath}`);
  }

  /**
   * Human-like pause between actions, using the configured delay range.
   */
  async pace() {
    await randomDelay(config.behaviour.minActionDelayMs, config.behaviour.maxActionDelayMs);
  }

  async safeGoto(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await this.pace();
  }

  async onError(page, contextLabel) {
    return captureScreenshot(page, `${this.siteKey}_${contextLabel}`);
  }

  // eslint-disable-next-line no-unused-vars
  async login(page) {
    throw new Error(`login() not implemented for ${this.siteKey}`);
  }

  // eslint-disable-next-line no-unused-vars
  async searchJobs(page) {
    throw new Error(`searchJobs() not implemented for ${this.siteKey}`);
  }

  // eslint-disable-next-line no-unused-vars
  async applyToJob(page, job) {
    throw new Error(`applyToJob() not implemented for ${this.siteKey}`);
  }
}

module.exports = BasePage;
