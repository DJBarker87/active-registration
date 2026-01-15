const fs = require('fs');
const path = require('path');

// Path to log file (relative to project root)
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'activity.log');

/**
 * Ensure the logs directory exists
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Format a log entry
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} message - Log message
 * @param {object} [data] - Optional data object
 * @returns {string} Formatted log entry
 */
function formatLogEntry(level, message, data) {
  const timestamp = new Date().toISOString();
  let entry = `${timestamp} [${level}] ${message}`;
  if (data !== undefined) {
    entry += ` ${JSON.stringify(data)}`;
  }
  return entry;
}

/**
 * Write log entry to console and file
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} [data] - Optional data object
 */
function log(level, message, data) {
  const entry = formatLogEntry(level, message, data);

  // Always write to console
  if (level === 'ERROR') {
    console.error(entry);
  } else if (level === 'WARN') {
    console.warn(entry);
  } else {
    console.log(entry);
  }

  // Attempt to write to file
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, entry + '\n');
  } catch (err) {
    // If file write fails, log to console only
    console.error(`Failed to write to log file: ${err.message}`);
  }
}

const logger = {
  /**
   * Log an informational message
   * @param {string} message - Log message
   * @param {object} [data] - Optional data object
   */
  info(message, data) {
    log('INFO', message, data);
  },

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {object} [data] - Optional data object
   */
  warn(message, data) {
    log('WARN', message, data);
  },

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {object} [data] - Optional data object
   */
  error(message, data) {
    log('ERROR', message, data);
  }
};

module.exports = logger;
