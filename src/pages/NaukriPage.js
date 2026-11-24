const BasePage = require('./BasePage');
const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Page object for naukri.com.
 *
 * NOTE ON SELECTORS: Naukri frequently changes its DOM/class names. The
 * selectors below reflect the site's structure at the time this was written
 * and are collected in one place (this file) so they are easy to update.
 * Before relying on this in production, open the site in headed mode
 * (HEADLESS=false) and confirm each selector still matches.
 */
class NaukriPage extends BasePage {
  constructor() {
    super('naukri', config.sites.naukri);
  }

  async login(page) {
    await this.safeGoto(page, this.siteConfig.loginUrl);

    if (!page.url().includes('nlogin/login')) {
      logger.info('[naukri] Already logged in via restored session.');
      return;
    }

    // Automated typing into Naukri's login fields consistently failed to
    // register, suggesting anti-bot script interference similar to what we
    // hit on Indeed. Rather than keep fighting it, pause and let you log in
    // by hand in the open browser window — the session gets saved either
    // way. We detect completion via URL change rather than a specific
    // profile-menu element, since that markup has proven unreliable.
    logger.warn(
      '[naukri] Please log in to Naukri manually in the browser window that just opened — ' +
        'enter your email and password (and solve any CAPTCHA) yourself. You have up to 5 minutes.'
    );
    await page.waitForURL((url) => !url.toString().includes('nlogin/login'), {
      timeout: 300000,
    });

    logger.info('[naukri] Manual login detected as complete.');
  }

  buildSearchUrl(title, location) {
    const slugTitle = encodeURIComponent(title.trim());
    const slugLocation = encodeURIComponent(location.trim());
    return `${this.siteConfig.baseUrl}/${slugTitle.replace(/%20/g, '-')}-jobs-in-${slugLocation.replace(/%20/g, '-')}`;
  }

  /**
   * Runs a search for every (title x location) combination configured in
   * .env and returns a de-duplicated list of job postings found.
   */
  async searchJobs(page) {
    const results = [];

    for (const title of config.search.titles) {
      for (const location of config.search.locations) {
        const url = this.buildSearchUrl(title, location);
        logger.info(`[naukri] Searching: "${title}" in "${location}"`);

        try {
          await this.safeGoto(page, url);
          await page.waitForSelector('.srp-jobtuple-wrapper, .jobTuple', { timeout: 15000 });

          const cards = await page.locator('.srp-jobtuple-wrapper, .jobTuple').all();
          for (const card of cards) {
            const titleEl = card.locator('a.title, a.title.fw500');
            const jobTitle = (await titleEl.first().textContent().catch(() => ''))?.trim();
            const jobUrl = await titleEl.first().getAttribute('href').catch(() => null);
            const company = (
              await card
                .locator('.comp-name, a.subTitle')
                .first()
                .textContent()
                .catch(() => '')
            )?.trim();
            const expText = (
              await card
                .locator('.exp-wrap, .expwdth')
                .first()
                .textContent()
                .catch(() => '')
            )?.trim();

            if (!jobUrl || !jobTitle) continue;
            if (!this.experienceMatches(expText)) continue;

            results.push({
              title: jobTitle,
              company: company || 'Unknown',
              url: jobUrl,
              source: 'naukri',
              timeFound: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.warn(`[naukri] Search failed for "${title}" in "${location}": ${err.message}`);
          await this.onError(page, `search_${title}_${location}`);
        }
      }
    }

    return this.dedupe(results);
  }

  experienceMatches(expText = '') {
    if (!expText) return true; // let it through if unparseable; the apply flow will still gate on questions
    const numbers = (expText.match(/\d+/g) || []).map(Number);
    if (numbers.length === 0) return true;
    const [lo, hi] = numbers.length === 1 ? [numbers[0], numbers[0]] : numbers;
    return hi >= config.search.minExperience && lo <= config.search.maxExperience;
  }

  dedupe(jobs) {
    const seen = new Set();
    return jobs.filter((j) => {
      if (seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });
  }

  /**
   * Opens a job and attempts the "one-click" Naukri apply flow. If any
   * screening question or textarea appears that isn't a simple yes/no
   * already answered on the profile, we stop and flag for manual review
   * rather than guessing an answer.
   */
  async applyToJob(page, job) {
    await this.safeGoto(page, job.url);

    // Some Naukri listings are just mirrors of a job posted on the
    // company's own site — clicking "Apply" there redirects off-platform.
    // Every external site is different, so we can't generically automate
    // that; flag it clearly instead of letting it look like a plain skip.
    const isExternalListing = await page
      .locator('text=/posted on external site/i')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isExternalListing) {
      return {
        status: 'external_apply_needed',
        notes: 'Job is hosted on an external company site — apply manually via the URL.',
      };
    }

    const applyButton = page.locator('button:has-text("Apply"), #apply-button');
    if (!(await applyButton.first().isVisible().catch(() => false))) {
      return { status: 'skipped', notes: 'Apply button not found (may already be applied).' };
    }

    await applyButton.first().click();
    await this.pace();

    // Naukri sometimes opens a "chatbot" style screening flow for extra
    // questions. If we see any question inputs, stop for manual review.
    const hasExtraQuestions = await page
      .locator('.chatbot_MessageContainer, [class*="chat-bot"], textarea')
      .first()
      .isVisible()
      .catch(() => false);

    if (hasExtraQuestions) {
      await this.onError(page, 'manual_review');
      return {
        status: 'manual_review',
        notes: 'Extra screening questions detected — needs manual input.',
      };
    }

    const confirmed = await page
      .locator('text=Application sent, text=Your application has been sent')
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (confirmed) {
      return { status: 'applied', notes: 'One-click apply confirmed.' };
    }

    return { status: 'manual_review', notes: 'Could not confirm application status.' };
  }
}

module.exports = NaukriPage;
