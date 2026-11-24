const config = require('../../config/config');
const logger = require('../utils/logger');
const JsonLogger = require('../utils/jsonLogger');
const CsvLogger = require('../utils/csvLogger');
const { withRetry } = require('../utils/retry');
const { isRelevant } = require('./jobMatcherService');

const appliedJson = new JsonLogger(config.logFiles.json);
const appliedCsv = new CsvLogger(config.logFiles.csv);
const reviewJson = new JsonLogger(config.logFiles.reviewJson);
const reviewCsv = new CsvLogger(config.logFiles.reviewCsv);

async function logResult(job, status, notes) {
  const record = { ...job, status, notes };

  if (status === 'manual_review' || status === 'external_apply_needed') {
    reviewJson.append(record);
    await reviewCsv.append(record);
  } else {
    appliedJson.append(record);
    await appliedCsv.append(record);
  }
}

/**
 * Given a site adapter and an already-authenticated page, finds matching
 * jobs, then attempts to apply to each new one (skipping jobs already
 * present in the logs), up to the configured per-run cap.
 */
async function runForSite(pageAdapter, page) {
  const foundJobs = await withRetry(() => pageAdapter.searchJobs(page), {
    label: `${pageAdapter.siteKey} search`,
  });

  const relevantJobs = foundJobs.filter(isRelevant);
  const newJobs = relevantJobs.filter(
    (job) => !appliedJson.exists(job.url) && !reviewJson.exists(job.url)
  );

  logger.info(
    `[${pageAdapter.siteKey}] Found ${foundJobs.length} postings, ${relevantJobs.length} relevant, ${newJobs.length} new.`
  );

  const cap = config.behaviour.maxApplicationsPerRun;
  const toProcess = newJobs.slice(0, cap);

  const summary = { applied: 0, manualReview: 0, externalApplyNeeded: 0, skipped: 0, failed: 0 };

  for (const job of toProcess) {
    try {
      const result = await withRetry(() => pageAdapter.applyToJob(page, job), {
        retries: 2,
        label: `${pageAdapter.siteKey} apply: ${job.title}`,
      });

      await logResult(job, result.status, result.notes);

      if (result.status === 'applied') summary.applied += 1;
      else if (result.status === 'manual_review') summary.manualReview += 1;
      else if (result.status === 'external_apply_needed') summary.externalApplyNeeded += 1;
      else summary.skipped += 1;

      logger.info(`[${pageAdapter.siteKey}] ${job.title} @ ${job.company} -> ${result.status}`);
    } catch (err) {
      await pageAdapter.onError(page, `apply_failed_${job.title}`);
      await logResult(job, 'failed', err.message);
      summary.failed += 1;
      logger.error(`[${pageAdapter.siteKey}] Failed to apply to "${job.title}": ${err.message}`);
    }
  }

  // Jobs beyond the cap (or filtered out) are still worth recording so the
  // monitor's CSV/JSON reflects everything that was discovered.
  const notProcessed = newJobs.slice(cap);
  for (const job of notProcessed) {
    await logResult(job, 'pending', 'Discovered but not yet processed (per-run cap reached).');
  }

  return summary;
}

module.exports = { runForSite };
