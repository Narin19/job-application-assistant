const BasePage = require('./BasePage');
const config = require('../../config/config');
const logger = require('../utils/logger');

/**
 * Page object for linkedin.com/jobs, targeting "Easy Apply" postings only.
 *
 * IMPORTANT: LinkedIn actively detects and restricts automated behaviour,
 * and its Terms of Service prohibit scraping/automation. Use a long,
 * human-like pace (see config.behaviour.*ActionDelayMs), run headed
 * (HEADLESS=false), keep MAX_APPLICATIONS_PER_RUN low, and be prepared to
 * solve checkpoints/CAPTCHAs manually — automating those is intentionally
 * not implemented here. Consider this adapter a starting point that needs
 * careful, conservative use rather than a "set and forget" bot.
 */
class LinkedInPage extends BasePage {
  constructor() {
    super('linkedin', config.sites.linkedin);
  }

  async login(page) {
    await this.safeGoto(page, this.siteConfig.loginUrl);

    if (!page.url().includes('/login')) {
      logger.info('[linkedin] Already logged in via restored session.');
      return;
    }

    // Use accessible label/role locators instead of hardcoded IDs — LinkedIn
    // changes its internal element IDs periodically, but the visible labels
    // ("Email or phone", "Password", "Sign in") are far more stable.
    // LinkedIn renders a visually-hidden duplicate input (used for
    // passkey/password-manager syncing) alongside the visible one. Target
    // only the visible element so we don't fill/wait on the hidden mirror.
    const emailField = page.locator('input[type="email"]:visible').first();
    const passwordField = page.locator('input[type="password"]:visible').first();
    const signInButton = page.locator('button:visible', { hasText: /^sign in$/i }).first();

    await emailField.waitFor({ state: 'visible', timeout: 30000 });
    await emailField.fill(this.siteConfig.email);
    await this.pace();
    await passwordField.fill(this.siteConfig.password);
    await this.pace();
    await signInButton.click();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const checkpoint = page.url().includes('/checkpoint/');
    if (checkpoint) {
      logger.warn(
        '[linkedin] Security checkpoint detected. Please complete verification manually in the open browser window.'
      );
      await page.waitForURL((url) => !url.toString().includes('/checkpoint/'), {
        timeout: 120000,
      });
    }

    logger.info('[linkedin] Login successful.');
  }

  buildSearchUrl(title, location) {
    const params = new URLSearchParams({
      keywords: title,
      location,
      f_AL: 'true', // Easy Apply filter only
    });
    return `${this.siteConfig.baseUrl}/jobs/search/?${params.toString()}`;
  }

  async searchJobs(page) {
    const results = [];

    for (const title of config.search.titles) {
      for (const location of config.search.locations) {
        const url = this.buildSearchUrl(title, location);
        logger.info(`[linkedin] Searching: "${title}" in "${location}"`);

        try {
          await this.safeGoto(page, url);
          await page.waitForSelector('.jobs-search__results-list, .scaffold-layout__list', {
            timeout: 15000,
          });

          const cards = await page.locator('li:has(a.job-card-container__link)').all();
          for (const card of cards) {
            const linkEl = card.locator('a.job-card-container__link').first();
            const jobTitle = (await linkEl.textContent().catch(() => ''))?.trim();
            const href = await linkEl.getAttribute('href').catch(() => null);
            const company = (
              await card
                .locator('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle')
                .first()
                .textContent()
                .catch(() => '')
            )?.trim();

            if (!href || !jobTitle) continue;
            const jobUrl = href.startsWith('http') ? href : `${this.siteConfig.baseUrl}${href}`;

            results.push({
              title: jobTitle,
              company: company || 'Unknown',
              url: jobUrl.split('?')[0],
              source: 'linkedin',
              timeFound: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.warn(`[linkedin] Search failed for "${title}" in "${location}": ${err.message}`);
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

  /**
   * Runs LinkedIn's "Easy Apply" multi-step modal. Each step is clicked
   * through only while it contains fields already resolvable from the
   * stored profile/resume (i.e. no free-text questions). The moment a
   * required text/select question appears that we can't safely answer,
   * we stop and flag the job for manual review.
   */
  async applyToJob(page, job) {
    await this.safeGoto(page, job.url);

    const easyApplyBtn = page.locator('button.jobs-apply-button:has-text("Easy Apply")');
    if (!(await easyApplyBtn.first().isVisible().catch(() => false))) {
      return { status: 'skipped', notes: 'Not an Easy Apply listing.' };
    }

    await easyApplyBtn.first().click();
    await this.pace();

    const maxSteps = 6;
    for (let step = 0; step < maxSteps; step += 1) {
      const hasFreeTextQuestion = await page
        .locator('.jobs-easy-apply-form-section__grouping textarea, input[type="text"]:not([value])')
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

      const submitBtn = page.locator('button:has-text("Submit application")');
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await this.pace();
        return { status: 'applied', notes: 'Easy Apply submitted.' };
      }

      const nextBtn = page.locator('button:has-text("Next"), button:has-text("Review")');
      if (await nextBtn.first().isVisible().catch(() => false)) {
        await nextBtn.first().click();
        await this.pace();
      } else {
        break;
      }
    }

    await this.onError(page, 'manual_review');
    return { status: 'manual_review', notes: 'Could not complete Easy Apply flow automatically.' };
  }
}

module.exports = LinkedInPage;
