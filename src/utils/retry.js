const logger = require('./logger');

/**
 * Runs `fn` with automatic retries and exponential backoff.
 * Dependency-free (avoids ESM-only packages, which break under
 * CommonJS `require`).
 *
 * @param {Function} fn - async function to run
 * @param {Object} opts
 * @param {number} opts.retries - number of retry attempts (default 3)
 * @param {string} opts.label - human-readable label for logging
 * @param {number} opts.baseDelayMs - base backoff delay (default 1000)
 */
async function withRetry(fn, opts = {}) {
  const { retries = 3, label = 'operation', baseDelayMs = 1000 } = opts;

  let lastError;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (err) {
      lastError = err;
      const attemptsLeft = retries + 1 - attempt;
      if (attemptsLeft <= 0) break;

      logger.warn(
        `${label} failed (attempt ${attempt}/${retries + 1}): ${err.message}. Retrying...`
      );

      const delay = baseDelayMs * 2 ** (attempt - 1);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Sleeps for a random duration between min and max milliseconds.
 * Used to add human-like pacing between actions.
 */
function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry, randomDelay };
