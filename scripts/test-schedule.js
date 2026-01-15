const { loadSettings, loadTimetable, getTodayLessons } = require('../src/timetable');
const { parseTime, addMinutes, getCurrentTime } = require('../src/scheduler');

function formatTime(time) {
  return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
}

function padRight(str, len) {
  return str.padEnd(len);
}

function main() {
  // Load settings and timetable
  let settings, timetable;
  try {
    settings = loadSettings();
    timetable = loadTimetable(settings.activeTimetable);
  } catch (err) {
    console.error('Error loading configuration:', err.message);
    process.exit(1);
  }

  // Get current time
  const currentTime = getCurrentTime(settings.timezone);
  const currentTimeStr = formatTime(currentTime);

  // Get today's lessons
  const lessons = getTodayLessons(timetable);
  const dayCapitalized = currentTime.dayOfWeek.charAt(0).toUpperCase() + currentTime.dayOfWeek.slice(1);

  console.log(`\nToday's Schedule (${dayCapitalized})`);
  console.log('===========================\n');

  if (lessons.length === 0) {
    console.log('No lessons scheduled for today\n');
    return;
  }

  // Calculate notification times and sort lessons
  const lessonsWithTimes = lessons.map(lesson => {
    const period = timetable.periods[lesson.period];
    const startTime = parseTime(period.start);
    const notifyTime = addMinutes(startTime, settings.notificationOffset);
    return {
      ...lesson,
      notifyTime,
      notifyTimeStr: formatTime(notifyTime)
    };
  }).sort((a, b) => {
    const aMinutes = a.notifyTime.hours * 60 + a.notifyTime.minutes;
    const bMinutes = b.notifyTime.hours * 60 + b.notifyTime.minutes;
    return aMinutes - bMinutes;
  });

  // Print table header
  console.log(
    padRight('Period', 14) +
    padRight('Class', 11) +
    padRight('Subject', 25) +
    'Notification Time'
  );
  console.log(
    padRight('-----------', 14) +
    padRight('--------', 11) +
    padRight('----------------------', 25) +
    '-----------------'
  );

  // Print each lesson
  for (const lesson of lessonsWithTimes) {
    console.log(
      padRight(lesson.period, 14) +
      padRight(lesson.class, 11) +
      padRight(lesson.subject, 25) +
      lesson.notifyTimeStr
    );
  }

  // Find next notification
  const currentMinutes = currentTime.hours * 60 + currentTime.minutes;
  const nextLesson = lessonsWithTimes.find(lesson => {
    const notifyMinutes = lesson.notifyTime.hours * 60 + lesson.notifyTime.minutes;
    return notifyMinutes > currentMinutes;
  });

  console.log(`\nCurrent time: ${currentTimeStr}`);

  if (nextLesson) {
    console.log(`Next notification: ${nextLesson.notifyTimeStr} (${nextLesson.class})`);
  } else {
    console.log('Next notification: None remaining today');
  }

  console.log('');
}

main();
