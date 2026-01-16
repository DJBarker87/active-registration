const logger = require('./logger');

// Notification window in minutes (handles GitHub Actions scheduling drift)
const NOTIFICATION_WINDOW_MINUTES = 15;

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
 * Check if a notification should be sent for a lesson right now
 * Returns true if current time is between 0 and 15 minutes AFTER the notification time
 * @param {object} lesson - Lesson object with period property
 * @param {object} periods - Periods object from timetable
 * @param {number} offsetMinutes - Minutes after lesson start to notify
 * @param {object} currentTime - { hours, minutes }
 * @returns {boolean} True if within notification window
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
 * Get all lessons that are within the notification time window
 * Note: Deduplication is handled separately in index.js using the dedup module
 * @param {Array} lessons - Array of today's lessons
 * @param {object} periods - Periods object from timetable
 * @param {number} offsetMinutes - Minutes after lesson start to notify
 * @param {object} currentTime - { hours, minutes }
 * @returns {Array} Array of lessons within notification window
 */
function getLessonsToNotify(lessons, periods, offsetMinutes, currentTime) {
  return lessons.filter(lesson =>
    shouldNotifyNow(lesson, periods, offsetMinutes, currentTime)
  );
}

module.exports = {
  parseTime,
  addMinutes,
  getCurrentTime,
  shouldNotifyNow,
  getLessonsToNotify,
  getTodayDateString,
  NOTIFICATION_WINDOW_MINUTES
};
