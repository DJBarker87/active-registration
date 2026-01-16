const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Path to deduplication file
const DEDUP_FILE = path.join(__dirname, '..', 'logs', 'notified-today.json');

/**
 * Load the deduplication data from file
 * @returns {object} Deduplication data { [key]: { date, notifiedAt } }
 */
function loadDedupData() {
  try {
    if (fs.existsSync(DEDUP_FILE)) {
      const data = fs.readFileSync(DEDUP_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger.warn('Failed to load dedup file, starting fresh', { error: err.message });
  }
  return {};
}

/**
 * Save the deduplication data to file
 * @param {object} data - Deduplication data
 */
function saveDedupData(data) {
  try {
    const logDir = path.dirname(DEDUP_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(DEDUP_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('Failed to save dedup file', { error: err.message });
  }
}

/**
 * Check if a lesson has already been notified today
 * @param {object} lesson - Lesson object with class and period properties
 * @param {string} date - Today's date string (YYYY-MM-DD)
 * @returns {boolean} True if already notified today
 */
function hasBeenNotified(lesson, date) {
  const dedupData = loadDedupData();
  const key = `${lesson.class}|${lesson.period}`;
  const entry = dedupData[key];
  return entry && entry.date === date;
}

/**
 * Mark a lesson as notified
 * Also clears old entries from previous days
 * @param {object} lesson - Lesson object with class and period properties
 * @param {string} date - Today's date string (YYYY-MM-DD)
 */
function markNotified(lesson, date) {
  const dedupData = loadDedupData();
  const key = `${lesson.class}|${lesson.period}`;

  // Clear old entries (from previous days)
  for (const k of Object.keys(dedupData)) {
    if (dedupData[k].date !== date) {
      delete dedupData[k];
    }
  }

  // Add new entry
  dedupData[key] = {
    date,
    notifiedAt: new Date().toISOString(),
    class: lesson.class,
    period: lesson.period
  };

  saveDedupData(dedupData);
  logger.info('Marked lesson as notified', { class: lesson.class, period: lesson.period, date });
}

module.exports = {
  hasBeenNotified,
  markNotified
};
