const BasePage = require('./BasePage');
const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Page object for in.indeed.com, targeting "Indeed Apply" postings.
 * Same selector-drift caveat as the other adapters applies: verify
 * selectors in headed mode before trusting this in production.
 */
class IndeedPage extends BasePage {
  constructor() {
    super('indeed', config.sites.indeed);
  }

  async login(page) {
    await this.safeGoto(page, this.siteConfig.loginUrl);

    const alreadyLoggedIn = await page
      .locator('[data-gnav-element-name="AccountMenu"]')
      .isVisible()
      .catch(() => false);
    if (alreadyLoggedIn) {
      logger.info('[indeed] Already logged in via restored session.');
      return;
    }

    // Automated typing on Indeed's login form has proven unreliable (likely
    // bot-detection interfering with synthetic input events). Rather than
    // fight that, we pause here and let you log in by hand — entering your
    // email, password/code, and clearing any CAPTCHA yourself in the open
    // browser window. Once you land anywhere off the sign-in domain, we
    // detect that and save the session so this only has to be done once.
    logger.warn(
      '[indeed] Please log in to Indeed manually in the browser window that just opened — ' +
        'enter your email and password (or one-time code) yourself. You have up to 5 minutes.'
    );
    await page.waitForURL((url) => !url.toString().includes('secure.indeed.com'), {
      timeout: 300000,
    });

    logger.info('[indeed] Manual login detected as complete.');
  }

  buildSearchUrl(title, location) {
    const params = new URLSearchParams({
      q: title,
      l: location,
    });
    return `${this.siteConfig.baseUrl}/jobs?${params.toString()}`;
  }

  async searchJobs(page) {
    const results = [];

    for (const title of config.search.titles) {
      for (const location of config.search.locations) {
        const url = this.buildSearchUrl(title, location);
        logger.info(`[indeed] Searching: "${title}" in "${location}"`);

        try {
          await this.safeGoto(page, url);
          await page.waitForSelector('.jobsearch-ResultsList, #mosaic-provider-jobcards', {
            timeout: 15000,
          });

          const cards = await page.locator('.job_seen_beacon, .cardOutline').all();
          for (const card of cards) {
            const linkEl = card.locator('a.jcs-JobTitle, h2.jobTitle a').first();
            const jobTitle = (await linkEl.textContent().catch(() => ''))?.trim();
            const href = await linkEl.getAttribute('href').catch(() => null);
            const company = (
              await card
                .locator('[data-testid="company-name"]')
                .first()
                .textContent()
                .catch(() => '')
            )?.trim();

            if (!href || !jobTitle) continue;
            const jobUrl = href.startsWith('http') ? href : `${this.siteConfig.baseUrl}${href}`;

            results.push({
              title: jobTitle,
              company: company || 'Unknown',
              url: jobUrl,
              source: 'indeed',
              timeFound: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.warn(`[indeed] Search failed for "${title}" in "${location}": ${err.message}`);
          await this.onError(page, `search_${title}_${location}`);
        }
      }
    }

    return this.dedupe(results);
  }

  dedupe(jobs) {
    const seen = new Set();
    return jobs.filter((j) => {
      if (seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });
  }

  async applyToJob(page, job) {
    await this.safeGoto(page, job.url);

    const applyBtn = page.locator('button:has-text("Apply now"), #indeedApplyButton');
    if (!(await applyBtn.first().isVisible().catch(() => false))) {
      return { status: 'skipped', notes: 'Indeed Apply button not found.' };
    }

    await applyBtn.first().click();
    await this.pace();

    // Indeed Apply typically opens an iframe-based multi-step form.
    const frame = page.frameLocator('iframe[title*="Apply"], iframe#indeedapply-modal-iframe');

    const maxSteps = 6;
    for (let step = 0; step < maxSteps; step += 1) {
      const hasFreeTextQuestion = await frame
        .locator('textarea, input[type="text"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (hasFreeTextQuestion) {
        await this.onError(page, 'manual_review');
        return {
          status: 'manual_review',
          notes: `Extra screening question at step ${step + 1} — needs manual input.`,
        };
      }

      const submitBtn = frame.locator('button:has-text("Submit your application")');
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await this.pace();
        return { status: 'applied', notes: 'Indeed Apply submitted.' };
      }

      const continueBtn = frame.locator('button:has-text("Continue")');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
        await this.pace();
      } else {
        break;
      }
    }

    await this.onError(page, 'manual_review');
    return { status: 'manual_review', notes: 'Could not complete Indeed Apply flow automatically.' };
  }
}

module.exports = IndeedPage;
