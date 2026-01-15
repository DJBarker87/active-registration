require('dotenv').config();

const logger = require('./logger');
const { loadSettings, loadTimetable, validateTimetable, getTodayLessons } = require('./timetable');
const { getCurrentTime, getLessonsToNotify, markAsNotified, getTodayDateString } = require('./scheduler');
const { sendNotifications } = require('./notifications');

async function main() {
  logger.info('Checking for notifications...');

  // Load configuration
  let settings;
  try {
    settings = loadSettings();
  } catch (err) {
    logger.error('Failed to load settings', { error: err.message });
    process.exit(1);
  }

  // Load active timetable
  let timetable;
  try {
    timetable = loadTimetable(settings.activeTimetable);
  } catch (err) {
    logger.error('Failed to load timetable', { error: err.message, timetable: settings.activeTimetable });
    process.exit(1);
  }

  // Validate timetable
  const validation = validateTimetable(timetable);
  if (!validation.valid) {
    logger.warn('Timetable validation warnings', { errors: validation.errors });
  }

  // Get current time
  const currentTime = getCurrentTime(settings.timezone);
  logger.info('Current time', {
    time: `${String(currentTime.hours).padStart(2, '0')}:${String(currentTime.minutes).padStart(2, '0')}`,
    day: currentTime.dayOfWeek
  });

  // Get today's lessons
  const lessons = getTodayLessons(timetable);
  if (lessons.length === 0) {
    logger.info('No lessons today');
    logger.info('Complete');
    return;
  }

  // Check for notifications (with deduplication)
  const lessonsToNotify = getLessonsToNotify(
    lessons,
    timetable.periods,
    settings.notificationOffset,
    currentTime,
    settings.timezone
  );

  if (lessonsToNotify.length === 0) {
    logger.info('No notifications at this time');
    logger.info('Complete');
    return;
  }

  // Send notifications for each matching lesson
  const todayDate = getTodayDateString(settings.timezone);

  for (const lesson of lessonsToNotify) {
    logger.info('Match found', { class: lesson.class, subject: lesson.subject });

    try {
      const result = await sendNotifications(lesson, settings);
      logger.info('Notification result', result);

      // Mark as notified to prevent duplicates within the 5-minute window
      markAsNotified(lesson.class, lesson.period, todayDate);
    } catch (err) {
      logger.error('Failed to send notifications', { error: err.message });
      // Don't mark as notified if sending failed, so retry is possible
    }
  }

  logger.info('Complete');
}

main().catch(err => {
  logger.error('Unhandled error in main', { error: err.message });
  process.exit(1);
});
