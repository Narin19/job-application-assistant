const config = require('../../config/config');

/**
 * Extra client-side safety net on top of each site's own search filters —
 * confirms a job's title/location text actually matches what we asked for,
 * in case a site returns loosely-related results.
 */
function titleMatches(jobTitle = '') {
  const lower = jobTitle.toLowerCase();
  return config.search.titles.some((t) => lower.includes(t.toLowerCase()));
}

function locationMatches(jobText = '') {
  const lower = jobText.toLowerCase();
  return config.search.locations.some((l) => lower.includes(l.toLowerCase()));
}

function isRelevant(job) {
  const haystack = `${job.title} ${job.company} ${job.location || ''}`;
  return titleMatches(job.title) || locationMatches(haystack);
}

module.exports = { isRelevant, titleMatches, locationMatches };
