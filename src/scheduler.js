const logger = require('./logger');
const fs = require('fs');
const path = require('path');

// Path to deduplication file
const DEDUP_FILE = path.join(__dirname, '..', 'logs', 'last-notified.json');

// Notification window in minutes (handles cron drift)
const NOTIFICATION_WINDOW_MINUTES = 5;

/**
 * Parse a time string in HH:MM format
 * @param {string} timeString - Time in "HH:MM" format
 * @returns {object} { hours: number, minutes: number }
 * @throws {Error} If format is invalid
 */
function parseTime(timeString) {
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: "${timeString}" (expected HH:MM)`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time values: "${timeString}"`);
  }

  return { hours, minutes };
}

/**
 * Add minutes to a time object
 * @param {object} time - { hours, minutes }
 * @param {number} minutesToAdd - Minutes to add
 * @returns {object} New time object with minutes added
 */
function addMinutes(time, minutesToAdd) {
  const totalMinutes = time.hours * 60 + time.minutes + minutesToAdd;
  return {
    hours: Math.floor(totalMinutes / 60) % 24,
    minutes: totalMinutes % 60
  };
}

/**
 * Get current time in specified timezone
 * @param {string} timezone - Timezone string (e.g., "Europe/London")
 * @returns {object} { hours, minutes, dayOfWeek }
 */
function getCurrentTime(timezone) {
  const now = new Date();

  // Get localized time string in the specified timezone
  const options = {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hour12: false
  };

  const formatter = new Intl.DateTimeFormat('en-GB', options);
  const parts = formatter.formatToParts(now);

  let hours = 0;
  let minutes = 0;
  let dayOfWeek = '';

  for (const part of parts) {
    if (part.type === 'hour') {
      hours = parseInt(part.value, 10);
    } else if (part.type === 'minute') {
      minutes = parseInt(part.value, 10);
    } else if (part.type === 'weekday') {
      dayOfWeek = part.value.toLowerCase();
    }
  }

  return { hours, minutes, dayOfWeek };
}

/**
 * Convert time object to total minutes since midnight
 * @param {object} time - { hours, minutes }
 * @returns {number} Total minutes since midnight
 */
function timeToMinutes(time) {
  return time.hours * 60 + time.minutes;
}

/**
 * Get today's date string in YYYY-MM-DD format
 * @param {string} timezone - Timezone string
 * @returns {string} Date string
 */
function getTodayDateString(timezone) {
  const now = new Date();
  const options = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD format
  return formatter.format(now);
}

/**
 * Load the deduplication data from file
 * @returns {object} Deduplication data { [className]: { date, period } }
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
 * Check if we've already notified for this lesson today
 * @param {string} className - Class name
 * @param {string} period - Period name
 * @param {string} todayDate - Today's date string
 * @returns {boolean} True if already notified
 */
function hasAlreadyNotified(className, period, todayDate) {
  const dedupData = loadDedupData();
  const key = `${className}|${period}`;
  const entry = dedupData[key];
  return entry && entry.date === todayDate;
}

/**
 * Mark a lesson as notified
 * @param {string} className - Class name
 * @param {string} period - Period name
 * @param {string} todayDate - Today's date string
 */
function markAsNotified(className, period, todayDate) {
  const dedupData = loadDedupData();
  const key = `${className}|${period}`;
  dedupData[key] = { date: todayDate, notifiedAt: new Date().toISOString() };

  // Clean up old entries (older than today)
  for (const k of Object.keys(dedupData)) {
    if (dedupData[k].date !== todayDate) {
      delete dedupData[k];
    }
  }

  saveDedupData(dedupData);
  logger.info('Marked lesson as notified', { class: className, period, date: todayDate });
}

/**
 * Check if a notification should be sent for a lesson right now
 * Uses a 5-minute window after the notification time to handle cron drift
 * @param {object} lesson - Lesson object with period property
 * @param {object} periods - Periods object from timetable
 * @param {number} offsetMinutes - Minutes after lesson start to notify
 * @param {object} currentTime - { hours, minutes }
 * @returns {boolean} True if notification should be sent now
 */
function shouldNotifyNow(lesson, periods, offsetMinutes, currentTime) {
  const period = periods[lesson.period];
  if (!period) {
    logger.warn('Unknown period in lesson', { period: lesson.period });
    return false;
  }

  const periodStart = parseTime(period.start);
  const notifyTime = addMinutes(periodStart, offsetMinutes);

  // Convert times to minutes since midnight for comparison
  const currentMinutes = timeToMinutes(currentTime);
  const notifyMinutes = timeToMinutes(notifyTime);
  const windowEndMinutes = notifyMinutes + NOTIFICATION_WINDOW_MINUTES;

  // Check if current time is within the notification window
  // (at or after notification time, but before window end)
  return currentMinutes >= notifyMinutes && currentMinutes < windowEndMinutes;
}

/**
 * Get all lessons that should trigger a notification right now
 * Filters by time window and deduplication (skip if already notified today)
 * @param {Array} lessons - Array of today's lessons
 * @param {object} periods - Periods object from timetable
 * @param {number} offsetMinutes - Minutes after lesson start to notify
 * @param {object} currentTime - { hours, minutes }
 * @param {string} timezone - Timezone string for date calculation
 * @returns {Array} Array of lessons that should notify now
 */
function getLessonsToNotify(lessons, periods, offsetMinutes, currentTime, timezone) {
  const todayDate = getTodayDateString(timezone);

  return lessons.filter(lesson => {
    // First check if we're in the notification window
    if (!shouldNotifyNow(lesson, periods, offsetMinutes, currentTime)) {
      return false;
    }

    // Then check if we've already notified for this lesson today
    if (hasAlreadyNotified(lesson.class, lesson.period, todayDate)) {
      logger.info('Skipping duplicate notification', {
        class: lesson.class,
        period: lesson.period,
        date: todayDate
      });
      return false;
    }

    return true;
  });
}

module.exports = {
  parseTime,
  addMinutes,
  getCurrentTime,
  shouldNotifyNow,
  getLessonsToNotify,
  getTodayDateString,
  hasAlreadyNotified,
  markAsNotified,
  NOTIFICATION_WINDOW_MINUTES
};
