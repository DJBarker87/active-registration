require('dotenv').config();

const logger = require('../src/logger');
const { loadSettings } = require('../src/timetable');
const { sendNotifications } = require('../src/notifications');

async function main() {
  console.log('=== Test Notification ===\n');

  // Load settings
  let settings;
  try {
    settings = loadSettings();
    console.log('Settings loaded successfully\n');
  } catch (err) {
    console.error('Failed to load settings:', err.message);
    process.exit(1);
  }

  // Create test lesson
  const testLesson = {
    period: 'Test',
    class: 'TEST-1',
    subject: 'Test Notification',
    room: 'N/A'
  };

  console.log('Sending test notification...');
  console.log(`  Class: ${testLesson.class}`);
  console.log(`  Subject: ${testLesson.subject}\n`);

  // Send notifications
  try {
    const result = await sendNotifications(testLesson, settings);

    console.log('Results:');
    if (result.pushover === 'success') {
      console.log('  ✓ Pushover notification sent successfully');
    } else {
      console.log('  ✗ Pushover failed');
    }

    if (result.email === 'success') {
      console.log('  ✓ Email sent successfully');
    } else {
      console.log('  ✗ Email failed');
    }

    // Exit with appropriate code
    if (result.pushover === 'success' && result.email === 'success') {
      console.log('\n✓ All notifications sent successfully!');
      process.exit(0);
    } else {
      console.log('\n✗ Some notifications failed');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error sending notifications:', err.message);
    process.exit(1);
  }
}

main();
