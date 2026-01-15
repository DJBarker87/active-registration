# Active Registration – Build Phases

This document breaks the implementation into small, manageable phases. Each phase has a detailed prompt for Claude Code (Sonnet) to execute.

---

## Phase Overview

| Phase | Description | Estimated Complexity |
|-------|-------------|---------------------|
| 1 | Logger module | Simple |
| 2 | Timetable loader | Simple |
| 3 | Scheduler logic | Medium |
| 4 | Notification services | Medium |
| 5 | Main entry point | Simple |
| 6 | Test scripts | Simple |
| 7 | Install script | Simple |
| 8 | Integration testing | Medium |

**Total estimated time:** 1-2 hours with Claude Code

---

## Phase 1: Logger Module

### Goal
Create a simple logging utility that writes timestamped messages to both console and a log file.

### Files to Create
- `src/logger.js`
- `logs/.gitkeep`

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. I need you to create a simple logger module.

## Context
- Read CLAUDE.md and docs/DESIGN.md first to understand the project
- This is Phase 1 of an 8-phase build

## Requirements for src/logger.js

Create a CommonJS module that exports a logger object with three methods:
- `info(message, data?)` - logs informational messages
- `warn(message, data?)` - logs warnings  
- `error(message, data?)` - logs errors

Each log entry should:
1. Include ISO timestamp
2. Include log level in brackets: [INFO], [WARN], [ERROR]
3. Include the message
4. If `data` object is provided, JSON stringify it on the same line
5. Write to BOTH console AND append to `logs/activity.log`

Example output format:
```
2026-01-13T09:10:00.000Z [INFO] Checking for notifications...
2026-01-13T09:10:00.000Z [ERROR] Pushover API failed {"status":500,"message":"timeout"}
```

## Technical constraints
- Use CommonJS (require/module.exports), not ES modules
- Use only Node.js built-in modules (fs, path)
- Create the logs directory if it doesn't exist
- Handle file write errors gracefully (log to console only if file fails)
- Use `fs.appendFileSync` for simplicity (this runs once per minute, not high throughput)

## Also create
- `logs/.gitkeep` - empty file so the logs directory is tracked by git

## Testing
After creating the files, demonstrate the logger works by writing a quick test that calls each method once.
```

---

## Phase 2: Timetable Loader

### Goal
Create a module that loads and validates timetable JSON files.

### Files to Create
- `src/timetable.js`

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. I need you to create the timetable loader module.

## Context
- Read CLAUDE.md and docs/DESIGN.md first to understand the project
- This is Phase 2 of an 8-phase build
- Phase 1 (logger) is complete

## Requirements for src/timetable.js

Create a CommonJS module that exports:

### `loadSettings()`
- Reads and parses `config/settings.json`
- Returns the parsed object
- Throws descriptive error if file missing or invalid JSON

### `loadTimetable(timetableName)`
- Reads and parses `timetables/{timetableName}.json`
- Returns the parsed object
- Throws descriptive error if file missing or invalid JSON

### `validateTimetable(timetable)`
- Validates the timetable structure
- Checks that required fields exist:
  - `meta.name` (string)
  - `periods` (object with at least one period)
  - `schedule` (object with day keys)
- Checks each period has `start` and `end` in "HH:MM" format
- Checks each lesson in schedule references a valid period
- Returns `{ valid: true }` or `{ valid: false, errors: [...] }`

### `getTodayLessons(timetable)`
- Gets current day of week as lowercase string ("monday", "tuesday", etc.)
- Returns the array of lessons for today from `timetable.schedule[day]`
- Returns empty array if no lessons today

## Technical constraints
- Use CommonJS (require/module.exports)
- Use only Node.js built-in modules (fs, path)
- Use the logger from Phase 1 for any error logging
- File paths should be relative to project root, not the src directory

## Testing
After creating the file:
1. Test loading the existing `config/settings.json`
2. Test loading `timetables/lent-2026.json`
3. Test validation passes for lent-2026
4. Test `getTodayLessons` returns correct lessons for current day
```

---

## Phase 3: Scheduler Logic

### Goal
Create the core timing logic that determines when notifications should fire.

### Files to Create
- `src/scheduler.js`

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. I need you to create the scheduler module with the time-matching logic.

## Context
- Read CLAUDE.md and docs/DESIGN.md first to understand the project
- This is Phase 3 of an 8-phase build
- Phases 1-2 (logger, timetable) are complete

## Requirements for src/scheduler.js

Create a CommonJS module that exports:

### `parseTime(timeString)`
- Takes a time string in "HH:MM" format (e.g., "09:00")
- Returns object `{ hours: number, minutes: number }`
- Throws error if format is invalid

### `addMinutes(time, minutes)`
- Takes a time object `{ hours, minutes }` and a number of minutes to add
- Returns new time object with minutes added
- Handles hour overflow correctly (e.g., 09:55 + 10 = 10:05)

### `getCurrentTime(timezone)`
- Returns current time as `{ hours, minutes, dayOfWeek }`
- `dayOfWeek` should be lowercase string: "monday", "tuesday", etc.
- Must respect the timezone parameter (e.g., "Europe/London")
- Use `toLocaleString` with timezone option, then parse the result

### `shouldNotifyNow(lesson, periods, offsetMinutes, currentTime)`
- `lesson` is an object like `{ period: "1st School", class: "FMat2-2", ... }`
- `periods` is the periods object from timetable
- `offsetMinutes` is how many minutes after lesson start to notify (e.g., 10)
- `currentTime` is `{ hours, minutes }` object
- Returns `true` if current time matches (lesson start + offset)
- Match only hours and minutes, ignore seconds

### `getLessonsToNotify(lessons, periods, offsetMinutes, currentTime)`
- Takes array of today's lessons
- Returns array of lessons that should trigger a notification right now
- Usually returns 0 or 1 lessons, but could be multiple if lessons start at same time

## Technical constraints
- Use CommonJS (require/module.exports)
- Use only Node.js built-in modules
- Use the logger from Phase 1 for debug logging
- Do NOT use any date libraries like moment.js or date-fns
- Be careful with timezone handling - this is critical for correct operation

## Example logic
```javascript
// 1st School starts at 09:00
// With offset of 10 minutes, notification time is 09:10
// If current time is 09:10, shouldNotifyNow returns true
```

## Testing
After creating the file, write tests that verify:
1. `parseTime("09:00")` returns `{ hours: 9, minutes: 0 }`
2. `addMinutes({ hours: 9, minutes: 55 }, 10)` returns `{ hours: 10, minutes: 5 }`
3. `shouldNotifyNow` correctly matches times
4. `shouldNotifyNow` correctly rejects non-matching times
5. Test with the actual lent-2026 timetable data
```

---

## Phase 4: Notification Services

### Goal
Create modules for sending Pushover notifications and Resend emails.

### Files to Create
- `src/notifications.js`

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. I need you to create the notification services module.

## Context
- Read CLAUDE.md and docs/DESIGN.md first to understand the project
- This is Phase 4 of an 8-phase build
- Phases 1-3 (logger, timetable, scheduler) are complete

## Requirements for src/notifications.js

Create a CommonJS module that exports:

### `sendPushover(title, message, settings)`
- Sends a push notification via Pushover API
- Uses `process.env.PUSHOVER_USER_KEY` and `process.env.PUSHOVER_API_TOKEN`
- `settings` contains `pushover.priority` and `pushover.sound`
- Returns a Promise that resolves on success, rejects with error details on failure
- Include retry logic: if first attempt fails, wait 5 seconds and retry once

API endpoint: `POST https://api.pushover.net/1/messages.json`

Request body:
```json
{
  "token": "API_TOKEN",
  "user": "USER_KEY", 
  "title": "📋 Take Registration",
  "message": "CMsiW-1 (Single Maths)",
  "priority": 1,
  "sound": "pushover"
}
```

### `sendEmail(subject, body, settings)`
- Sends an email via Resend API
- Uses `process.env.RESEND_API_KEY`
- `settings` contains `email.to`, `email.from`, and `email.fromName`
- Returns a Promise that resolves on success, rejects with error details on failure
- Include same retry logic as Pushover

API endpoint: `POST https://api.resend.com/emails`

Headers:
```
Authorization: Bearer {RESEND_API_KEY}
Content-Type: application/json
```

Request body:
```json
{
  "from": "Registration Reminder <onboarding@resend.dev>",
  "to": "d.barker@etoncollege.org.uk",
  "subject": "📋 Take Registration – CMsiW-1",
  "text": "Reminder: Take registration for CMsiW-1 (Single Maths)"
}
```

### `sendNotifications(lesson, settings)`
- High-level function that sends both Pushover and email
- Formats the message appropriately for each channel
- Calls both `sendPushover` and `sendEmail`
- Uses `Promise.allSettled` so one failure doesn't block the other
- Returns object `{ pushover: 'success'|'failed', email: 'success'|'failed' }`
- Logs results using the logger module

Message format:
- Pushover title: `📋 Take Registration`
- Pushover message: `{class} ({subject})`
- Email subject: `📋 Take Registration – {class}`
- Email body: `Reminder: Take registration for {class} ({subject})`

## Technical constraints
- Use CommonJS (require/module.exports)
- Use native `fetch` (available in Node 18+)
- Use the logger from Phase 1
- Require `dotenv` at the top to load environment variables
- Handle network errors gracefully

## Error handling
- Log detailed errors but don't crash
- If env vars are missing, throw clear error on startup
- Timeout API calls after 30 seconds

## Testing
Don't actually test with real APIs yet - we'll do that in Phase 8.
Instead, verify:
1. The module loads without errors
2. Environment variable validation works (test with missing vars)
3. Message formatting is correct
```

---

## Phase 5: Main Entry Point

### Goal
Create the main script that ties everything together and runs on each cron execution.

### Files to Create
- `src/index.js`

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. I need you to create the main entry point that will run every minute via cron.

## Context
- Read CLAUDE.md and docs/DESIGN.md first to understand the project
- This is Phase 5 of an 8-phase build
- Phases 1-4 are complete: logger.js, timetable.js, scheduler.js, notifications.js

## Requirements for src/index.js

Create the main entry point script that:

### On every execution:

1. **Load environment variables**
   - Require `dotenv/config` at the very top
   
2. **Log start**
   - Log: "Checking for notifications..."

3. **Load configuration**
   - Call `loadSettings()` from timetable module
   - Handle errors: log and exit if settings can't be loaded

4. **Load active timetable**
   - Get `settings.activeTimetable`
   - Call `loadTimetable(activeTimetable)`
   - Call `validateTimetable()` and log warnings if invalid
   - Handle errors: log and exit if timetable can't be loaded

5. **Get current time**
   - Call `getCurrentTime(settings.timezone)`
   - Log current time and day for debugging

6. **Get today's lessons**
   - Call `getTodayLessons(timetable)`
   - If empty, log "No lessons today" and exit

7. **Check for notifications**
   - Call `getLessonsToNotify(lessons, timetable.periods, settings.notificationOffset, currentTime)`
   - If empty, log "No notifications at this time" and exit

8. **Send notifications**
   - For each lesson that needs notification:
     - Call `sendNotifications(lesson, settings)`
     - Log the result

9. **Log completion**
   - Log: "Complete"

### Error handling
- Wrap entire main logic in try/catch
- Log any uncaught errors
- Always exit cleanly (don't leave process hanging)

### Script structure
```javascript
require('dotenv').config();

const logger = require('./logger');
const { loadSettings, loadTimetable, validateTimetable, getTodayLessons } = require('./timetable');
const { getCurrentTime, getLessonsToNotify } = require('./scheduler');
const { sendNotifications } = require('./notifications');

async function main() {
  // ... implementation
}

main().catch(err => {
  logger.error('Unhandled error in main', { error: err.message });
  process.exit(1);
});
```

## Technical constraints
- Use CommonJS
- Make main() async to handle Promise-based notification sending
- Exit with code 0 on success, code 1 on error
- Keep execution time under 30 seconds (cron runs every minute)

## Testing
After creating the file:
1. Run `node src/index.js` and verify it executes without errors
2. Check that logs are written to both console and logs/activity.log
3. Verify it correctly identifies (or doesn't identify) current time as a notification moment
```

---

## Phase 6: Test Scripts

### Goal
Create helper scripts for testing notifications and previewing the schedule.

### Files to Create
- `scripts/test-notification.js`
- `scripts/test-schedule.js`

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. I need you to create test utility scripts.

## Context
- Read CLAUDE.md and docs/DESIGN.md first to understand the project
- This is Phase 6 of an 8-phase build
- Phases 1-5 are complete (all src/ modules done)

## Requirements

### scripts/test-notification.js

A script that sends a test notification immediately, regardless of the current time.

Behaviour:
1. Load environment variables with dotenv
2. Load settings from config/settings.json
3. Create a fake lesson object:
   ```javascript
   const testLesson = {
     period: "Test",
     class: "TEST-1",
     subject: "Test Notification",
     room: "N/A"
   };
   ```
4. Call `sendNotifications(testLesson, settings)`
5. Log the results clearly:
   - "✓ Pushover notification sent successfully" or "✗ Pushover failed: {error}"
   - "✓ Email sent successfully" or "✗ Email failed: {error}"
6. Exit with code 0 if both succeeded, code 1 if either failed

Usage: `npm run test:notification` or `node scripts/test-notification.js`

### scripts/test-schedule.js

A script that shows what notifications would fire today, without actually sending them.

Behaviour:
1. Load settings and active timetable
2. Get today's lessons
3. For each lesson, calculate the notification time (lesson start + offset)
4. Display a formatted table:
   ```
   Today's Schedule (Thursday)
   ===========================
   
   Period        Class      Subject                  Notification Time
   -----------   --------   ----------------------   -----------------
   1st School    BMdaV-3    Double Maths (Applied)   09:10
   2nd School    CMdaY-6    Double Maths (Applied)   10:00
   4th School    CMsiW-1    Single Maths             11:55
   
   Current time: 09:45
   Next notification: 10:00 (CMdaY-6)
   ```
5. If no lessons today, display "No lessons scheduled for today"

Usage: `npm run test:schedule` or `node scripts/test-schedule.js`

## Technical constraints
- Use CommonJS
- Reuse existing modules from src/
- Make output clear and user-friendly
- Handle errors gracefully with helpful messages

## Testing
1. Run `node scripts/test-schedule.js` and verify output is correct for today
2. Don't run test-notification.js yet (we'll do that in Phase 8 with real API keys)
```

---

## Phase 7: Install Script

### Goal
Create a shell script that sets up the cron job on the Raspberry Pi.

### Files to Create
- `scripts/install.sh`

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. I need you to create the installation script.

## Context
- Read CLAUDE.md and docs/DESIGN.md first to understand the project
- This is Phase 7 of an 8-phase build
- Phases 1-6 are complete

## Requirements for scripts/install.sh

Create a bash script that sets up the system on a Raspberry Pi.

### The script should:

1. **Check prerequisites**
   - Verify Node.js is installed (exit with error if not)
   - Verify npm is installed
   - Check Node version is >= 18

2. **Verify project files**
   - Check that src/index.js exists
   - Check that config/settings.json exists
   - Check that .env file exists (warn if not, don't fail)

3. **Install npm dependencies**
   - Run `npm install` if node_modules doesn't exist

4. **Create logs directory**
   - Create `logs/` if it doesn't exist

5. **Set up cron job**
   - Check if cron job already exists (don't duplicate)
   - If not exists, add to crontab:
     ```
     * * * * * cd /path/to/active-registration && /usr/bin/node src/index.js >> logs/cron.log 2>&1
     ```
   - Use the actual installation directory, not a hardcoded path

6. **Verify cron is running**
   - Check that cron service is active
   - Warn if not active

7. **Display success message**
   ```
   ✓ Installation complete!
   
   The registration reminder will now run every minute.
   
   Next steps:
   1. Ensure your .env file has valid API keys
   2. Test with: npm run test:notification
   3. View logs with: tail -f logs/activity.log
   ```

### Error handling
- Exit immediately on any error (set -e)
- Provide clear error messages
- Don't modify system if prerequisites aren't met

### Script header
```bash
#!/bin/bash
set -e

# Active Registration - Installation Script
# This script sets up the cron job to run notifications every minute

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
```

## Technical constraints
- Must work on Raspberry Pi OS (Debian-based)
- Use portable bash syntax
- Make script idempotent (safe to run multiple times)
- Don't require sudo unless absolutely necessary

## Testing
After creating the file:
1. Run `chmod +x scripts/install.sh`
2. Review the script logic (don't actually run it yet - that's for the Pi)
```

---

## Phase 8: Integration Testing

### Goal
Verify the complete system works end-to-end with real API calls.

### Claude Code Prompt

```
I'm building a registration reminder system for a Raspberry Pi. All code is now complete and I need to do integration testing.

## Context
- Read CLAUDE.md and docs/DESIGN.md first
- This is Phase 8 (final phase) of the build
- All source files are complete

## Pre-flight checks

Before testing, verify:

1. **All files exist**
   - src/index.js
   - src/logger.js
   - src/timetable.js
   - src/scheduler.js
   - src/notifications.js
   - scripts/test-notification.js
   - scripts/test-schedule.js
   - scripts/install.sh
   - config/settings.json
   - timetables/lent-2026.json
   - .env (with real API keys)
   - package.json

2. **Dependencies installed**
   - Run `npm install`
   - Verify node_modules/dotenv exists

3. **Environment variables set**
   - .env contains PUSHOVER_USER_KEY
   - .env contains PUSHOVER_API_TOKEN  
   - .env contains RESEND_API_KEY

## Test sequence

### Test 1: Module loading
```bash
node -e "require('./src/logger')"
node -e "require('./src/timetable')"
node -e "require('./src/scheduler')"
node -e "require('./src/notifications')"
node -e "require('./src/index')"
```
All should complete without errors.

### Test 2: Schedule preview
```bash
node scripts/test-schedule.js
```
Should display today's lessons correctly.

### Test 3: Dry run of main script
```bash
node src/index.js
```
Should run without errors, check logs/activity.log for output.

### Test 4: Test notification (REAL API CALLS)
```bash
node scripts/test-notification.js
```
Should send actual push notification and email.
Verify:
- Push notification received on iPhone
- Email received at d.barker@etoncollege.org.uk

### Test 5: Simulated notification time
Temporarily modify the scheduler to test a specific time:
1. Find a lesson that would notify at a specific time
2. Temporarily hardcode getCurrentTime to return that time
3. Run `node src/index.js`
4. Verify notifications are sent
5. Revert the hardcoded time

## Troubleshooting

If tests fail, check:
- Are API keys correct in .env?
- Is the Pushover app installed on the iPhone?
- Is the email address correct in settings.json?
- Are there any error messages in logs/activity.log?

## Success criteria

All tests pass:
- [ ] All modules load without error
- [ ] Schedule preview shows correct lessons
- [ ] Main script runs without error
- [ ] Test notification delivers to phone
- [ ] Test notification delivers to email

Once all tests pass, the system is ready to deploy to the Raspberry Pi.
```

---

## Deployment Checklist

After all phases are complete and tested:

1. [ ] Push all code to GitHub repository
2. [ ] Set up Raspberry Pi (flash OS, enable SSH, connect to network)
3. [ ] SSH into Pi
4. [ ] Clone repository: `git clone https://github.com/DJBarker87/active-registration.git`
5. [ ] Create .env file with API keys
6. [ ] Run `./scripts/install.sh`
7. [ ] Run `npm run test:notification` to verify
8. [ ] Wait for next lesson time to verify automatic notification

---

## Maintenance Notes

### Updating timetable for new term

1. Create new timetable file: `timetables/summer-2026.json`
2. Edit `config/settings.json`: change `activeTimetable` to `"summer-2026"`
3. No restart needed - changes take effect on next minute

### Viewing logs

```bash
# Recent activity
tail -50 logs/activity.log

# Follow live
tail -f logs/activity.log

# Cron output
tail -50 logs/cron.log
```

### Restarting the system

The cron job runs independently - no restart needed for code changes.
To update code:
```bash
cd ~/active-registration
git pull
npm install  # if dependencies changed
```

---

*End of Build Phases Document*
