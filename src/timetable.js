const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Paths relative to project root
const PROJECT_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'settings.json');
const TIMETABLES_DIR = path.join(PROJECT_ROOT, 'timetables');

/**
 * Load and parse settings.json
 * @returns {object} Parsed settings object
 * @throws {Error} If file missing or invalid JSON
 */
function loadSettings() {
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Settings file not found: ${CONFIG_PATH}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in settings file: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Load and parse a timetable file
 * @param {string} timetableName - Name of timetable (without .json extension)
 * @returns {object} Parsed timetable object
 * @throws {Error} If file missing or invalid JSON
 */
function loadTimetable(timetableName) {
  const timetablePath = path.join(TIMETABLES_DIR, `${timetableName}.json`);
  try {
    const content = fs.readFileSync(timetablePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Timetable file not found: ${timetablePath}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in timetable file ${timetableName}: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Validate timetable structure
 * @param {object} timetable - Timetable object to validate
 * @returns {object} { valid: true } or { valid: false, errors: [...] }
 */
function validateTimetable(timetable) {
  const errors = [];
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  // Check meta.name
  if (!timetable.meta || typeof timetable.meta.name !== 'string') {
    errors.push('Missing or invalid meta.name');
  }

  // Check periods
  if (!timetable.periods || typeof timetable.periods !== 'object') {
    errors.push('Missing or invalid periods object');
  } else {
    const periodNames = Object.keys(timetable.periods);
    if (periodNames.length === 0) {
      errors.push('Periods object is empty - must have at least one period');
    }

    for (const periodName of periodNames) {
      const period = timetable.periods[periodName];
      if (!period.start || !timeRegex.test(period.start)) {
        errors.push(`Period "${periodName}" has invalid start time: ${period.start}`);
      }
      if (!period.end || !timeRegex.test(period.end)) {
        errors.push(`Period "${periodName}" has invalid end time: ${period.end}`);
      }
    }
  }

  // Check schedule
  if (!timetable.schedule || typeof timetable.schedule !== 'object') {
    errors.push('Missing or invalid schedule object');
  } else {
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const periodNames = timetable.periods ? Object.keys(timetable.periods) : [];

    for (const day of Object.keys(timetable.schedule)) {
      if (!validDays.includes(day)) {
        errors.push(`Invalid day key in schedule: "${day}"`);
        continue;
      }

      const lessons = timetable.schedule[day];
      if (!Array.isArray(lessons)) {
        errors.push(`Schedule for ${day} is not an array`);
        continue;
      }

      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        if (!lesson.period) {
          errors.push(`Lesson ${i + 1} on ${day} is missing period`);
        } else if (!periodNames.includes(lesson.period)) {
          errors.push(`Lesson ${i + 1} on ${day} references unknown period: "${lesson.period}"`);
        }
      }
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Get lessons for today
 * @param {object} timetable - Timetable object
 * @returns {Array} Array of lesson objects for today (empty if no lessons)
 */
function getTodayLessons(timetable) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];

  const lessons = timetable.schedule[today];
  return Array.isArray(lessons) ? lessons : [];
}

module.exports = {
  loadSettings,
  loadTimetable,
  validateTimetable,
  getTodayLessons
};
