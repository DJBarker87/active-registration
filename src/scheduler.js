const logger = require('./logger');

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
 * Check if a notification should be sent for a lesson right now
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

  return currentTime.hours === notifyTime.hours &&
         currentTime.minutes === notifyTime.minutes;
}

/**
 * Get all lessons that should trigger a notification right now
 * @param {Array} lessons - Array of today's lessons
 * @param {object} periods - Periods object from timetable
 * @param {number} offsetMinutes - Minutes after lesson start to notify
 * @param {object} currentTime - { hours, minutes }
 * @returns {Array} Array of lessons that should notify now
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
  getLessonsToNotify
};
