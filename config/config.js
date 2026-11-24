const path = require('path');
require('dotenv').config();

/**
 * Splits a comma-separated env var into a trimmed array of strings.
 */
function csvToArray(value = '') {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

const ROOT_DIR = path.resolve(__dirname, '..');

const config = {
  rootDir: ROOT_DIR,
  sessionsDir: path.join(ROOT_DIR, 'sessions'),
  logsDir: path.join(ROOT_DIR, 'logs'),
  screenshotsDir: path.join(ROOT_DIR, 'logs', 'screenshots'),

  search: {
    titles: csvToArray(process.env.JOB_TITLES || 'React JS,React Native,Frontend Developer'),
    locations: csvToArray(process.env.LOCATIONS || 'Mumbai,Navi Mumbai,Thane'),
    minExperience: toInt(process.env.MIN_EXPERIENCE, 2),
    maxExperience: toInt(process.env.MAX_EXPERIENCE, 4),
  },

  behaviour: {
    autoSubmit: toBool(process.env.AUTO_SUBMIT, true),
    headless: toBool(process.env.HEADLESS, false),
    pollIntervalMinutes: toInt(process.env.POLL_INTERVAL_MINUTES, 30),
    maxApplicationsPerRun: toInt(process.env.MAX_APPLICATIONS_PER_RUN, 15),
    minActionDelayMs: toInt(process.env.MIN_ACTION_DELAY_MS, 800),
    maxActionDelayMs: toInt(process.env.MAX_ACTION_DELAY_MS, 2200),
  },

  sites: {
    naukri: {
      enabled: toBool(process.env.NAUKRI_ENABLED, true),
      email: process.env.NAUKRI_EMAIL || '',
      password: process.env.NAUKRI_PASSWORD || '',
      baseUrl: 'https://www.naukri.com',
      loginUrl: 'https://www.naukri.com/nlogin/login',
      storageStatePath: path.join(ROOT_DIR, 'sessions', 'naukri.json'),
    },
    linkedin: {
      enabled: toBool(process.env.LINKEDIN_ENABLED, true),
      email: process.env.LINKEDIN_EMAIL || '',
      password: process.env.LINKEDIN_PASSWORD || '',
      baseUrl: 'https://www.linkedin.com',
      loginUrl: 'https://www.linkedin.com/login',
      storageStatePath: path.join(ROOT_DIR, 'sessions', 'linkedin.json'),
    },
    indeed: {
      enabled: toBool(process.env.INDEED_ENABLED, true),
      email: process.env.INDEED_EMAIL || '',
      password: process.env.INDEED_PASSWORD || '',
      baseUrl: 'https://in.indeed.com',
      loginUrl: 'https://secure.indeed.com/account/login',
      storageStatePath: path.join(ROOT_DIR, 'sessions', 'indeed.json'),
    },
  },

  logFiles: {
    json: path.join(ROOT_DIR, 'logs', 'applications.json'),
    csv: path.join(ROOT_DIR, 'logs', 'applications.csv'),
    reviewJson: path.join(ROOT_DIR, 'logs', 'manual_review.json'),
    reviewCsv: path.join(ROOT_DIR, 'logs', 'manual_review.csv'),
    activity: path.join(ROOT_DIR, 'logs', 'activity.log'),
  },
};

module.exports = config;
