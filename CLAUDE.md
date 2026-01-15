# CLAUDE.md – Build Guide for Active Registration

> This document provides Claude Code with everything needed to build, modify, and maintain the Active Registration notification system.

---

## Project Overview

**Active Registration** is a lesson registration reminder system for a teacher at Eton College. It runs on a Raspberry Pi and sends push notifications (via Pushover) and backup emails (via Resend) 10 minutes into each lesson.

**User:** Dom Barker – Mathematics teacher, Head of F Block Rowing  
**Email:** d.barker@etoncollege.org.uk

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Run manually | `node src/index.js` |
| Test notifications | `npm run test:notification` |
| Preview today's schedule | `npm run test:schedule` |
| View logs | `tail -f logs/activity.log` |
| Switch timetable | Edit `config/settings.json` → `activeTimetable` |

---

## Architecture Summary

```
System cron (every minute)
    │
    ▼
src/index.js
    │
    ├── Loads config/settings.json
    ├── Loads timetables/{activeTimetable}.json
    ├── Checks: Is now = lesson_start + 10 minutes?
    │
    ├── If yes:
    │   ├── Call Pushover API → iPhone notification
    │   └── Call Resend API → Email
    │
    └── Logs result to logs/activity.log
```

---

## Directory Structure

```
active-registration/
├── README.md                 # User-facing quick start
├── CLAUDE.md                 # This file (AI build guide)
├── package.json
├── .env                      # API keys (DO NOT COMMIT)
├── .env.example              # Template for .env
├── .gitignore
│
├── docs/
│   └── DESIGN.md             # Full system design document
│
├── config/
│   └── settings.json         # Runtime settings
│
├── timetables/
│   ├── lent-2026.json        # Active timetable
│   ├── summer-2026.json      # Future timetable
│   └── michaelmas-2026.json  # Future timetable
│
├── src/
│   ├── index.js              # Entry point
│   ├── scheduler.js          # Time matching logic
│   ├── notifications.js      # Pushover + Resend calls
│   ├── timetable.js          # Load/parse timetables
│   └── logger.js             # Logging utility
│
├── logs/                     # Git-ignored
│   └── activity.log
│
└── scripts/
    ├── install.sh            # Cron setup
    └── test-notification.sh  # Manual test
```

---

## Key Files Explained

### `config/settings.json`

Runtime configuration. Change `activeTimetable` when the term changes.

```json
{
  "activeTimetable": "lent-2026",
  "notificationOffset": 10,
  "email": {
    "to": "d.barker@etoncollege.org.uk",
    "from": "registration@resend.dev",
    "fromName": "Registration Reminder"
  },
  "pushover": {
    "priority": 1,
    "sound": "pushover"
  },
  "timezone": "Europe/London"
}
```

### `timetables/lent-2026.json`

Complete timetable for one term. Structure:

```json
{
  "meta": {
    "name": "Lent 2026",
    "startDate": "2026-01-12",
    "endDate": "2026-03-28"
  },
  "periods": {
    "1st School": { "start": "09:00", "end": "09:40" },
    ...
  },
  "schedule": {
    "monday": [
      { "period": "1st School", "class": "FMat2-2", "subject": "Further Maths", "room": "23 New" },
      ...
    ],
    ...
  }
}
```

**Days are lowercase:** `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`

### `.env`

API credentials. Never commit this file.

```
PUSHOVER_USER_KEY=uxxxxxxxxxxxxxxxxxxxxxxxxxx
PUSHOVER_API_TOKEN=axxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Implementation Details

### Time Matching Algorithm

The core logic in `src/scheduler.js`:

```javascript
function shouldNotify(lesson, periods, offset, now) {
  const period = periods[lesson.period];
  const [startHour, startMinute] = period.start.split(':').map(Number);
  
  // Calculate notification time (lesson start + offset)
  const totalMinutes = startHour * 60 + startMinute + offset;
  const notifyHour = Math.floor(totalMinutes / 60);
  const notifyMinute = totalMinutes % 60;
  
  // Match current time (ignore seconds)
  return now.getHours() === notifyHour && now.getMinutes() === notifyMinute;
}
```

### Pushover API

`src/notifications.js` – Push notification:

```javascript
async function sendPushover(title, message, settings) {
  const response = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.PUSHOVER_API_TOKEN,
      user: process.env.PUSHOVER_USER_KEY,
      title,
      message,
      priority: settings.pushover.priority,
      sound: settings.pushover.sound
    })
  });
  
  if (!response.ok) {
    throw new Error(`Pushover failed: ${response.status}`);
  }
}
```

### Resend API

`src/notifications.js` – Email:

```javascript
async function sendEmail(subject, body, settings) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${settings.email.fromName} <${settings.email.from}>`,
      to: settings.email.to,
      subject,
      text: body
    })
  });
  
  if (!response.ok) {
    throw new Error(`Resend failed: ${response.status}`);
  }
}
```

### Notification Message Format

**Push notification:**
- Title: `📋 Take Registration`
- Message: `{class} ({subject})`
- Example: `CMsiW-1 (Single Maths)`

**Email:**
- Subject: `📋 Take Registration – {class}`
- Body: `Reminder: Take registration for {class} ({subject})`

---

## Dependencies

### package.json

```json
{
  "name": "active-registration",
  "version": "1.0.0",
  "description": "Lesson registration reminder system",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test:notification": "node scripts/test-notification.js",
    "test:schedule": "node scripts/test-schedule.js"
  },
  "dependencies": {
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Note:** We use native `fetch` (available in Node 18+) rather than axios to minimise dependencies.

---

## Deployment to Raspberry Pi

### Prerequisites

1. Raspberry Pi with Raspberry Pi OS Lite
2. SSH access configured
3. Node.js 20.x installed
4. Internet connection

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/DJBarker87/active-registration.git
cd active-registration

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
nano .env  # Add your API keys

# 4. Test manually
node src/index.js

# 5. Test notifications
npm run test:notification

# 6. Install cron job
chmod +x scripts/install.sh
./scripts/install.sh

# 7. Verify cron is running
crontab -l
```

### Cron Entry

The install script adds:

```
* * * * * cd /home/pi/active-registration && /usr/bin/node src/index.js >> logs/cron.log 2>&1
```

---

## Common Tasks

### Switching Timetables

When a new term starts:

1. Create new timetable file: `timetables/summer-2026.json`
2. Edit `config/settings.json`:
   ```json
   "activeTimetable": "summer-2026"
   ```
3. No restart needed – the script loads settings fresh each run

### Adding a New Lesson

Edit the relevant timetable JSON:

```json
"friday": [
  { "period": "1st School", "class": "CMdaY-6", "subject": "Double Maths (Applied)", "room": "23 New" },
  { "period": "3rd School", "class": "FMat2-2", "subject": "Further Maths", "room": "23 New" },
  // Add new lesson here:
  { "period": "After 4", "class": "NewClass-1", "subject": "New Subject", "room": "Room 1" }
]
```

### Changing Notification Timing

Edit `config/settings.json`:

```json
"notificationOffset": 5  // 5 minutes into lesson instead of 10
```

### Viewing Logs

```bash
# Recent activity
tail -50 logs/activity.log

# Follow live
tail -f logs/activity.log

# Search for errors
grep ERROR logs/activity.log
```

### Testing

```bash
# Send a test notification right now
npm run test:notification

# See what would fire today
npm run test:schedule
```

---

## Error Handling

### API Failures

If Pushover or Resend fails:
1. Log the error
2. Retry once after 5 seconds
3. If still failing, continue (the other channel may succeed)

### Invalid Timetable

If the timetable JSON is malformed:
1. Log error with details
2. Exit without sending notifications
3. Previous successful runs are unaffected

### No Internet

If the Pi loses connectivity:
1. API calls will timeout
2. Errors logged
3. System recovers automatically when connection returns

---

## Testing Checklist

Before deployment, verify:

- [ ] `npm install` completes without errors
- [ ] `.env` contains valid API keys
- [ ] `npm run test:notification` sends both push and email
- [ ] `npm run test:schedule` shows correct lessons for today
- [ ] `node src/index.js` runs without errors
- [ ] Cron job is installed: `crontab -l`
- [ ] Logs are being written: `ls -la logs/`

---

## Coding Standards

### JavaScript

- Use ES modules (`import`/`export`) – but for simplicity on Pi, we use CommonJS (`require`)
- Use `async`/`await` for API calls
- Handle errors with try/catch
- Use meaningful variable names

### JSON Files

- Use 2-space indentation
- Include trailing newline
- Validate JSON before committing

### Logging

Use the logger module consistently:

```javascript
const logger = require('./logger');

logger.info('Starting notification check');
logger.error('Pushover API failed', { status: 500 });
```

Log levels:
- `info` – Normal operations
- `warn` – Recoverable issues
- `error` – Failures requiring attention

---

## Troubleshooting

### Notifications Not Sending

1. Check logs: `tail -50 logs/activity.log`
2. Verify API keys in `.env`
3. Test manually: `npm run test:notification`
4. Check cron is running: `crontab -l`
5. Check Pi has internet: `ping google.com`

### Wrong Notification Times

1. Check timezone in settings: should be `Europe/London`
2. Check Pi system time: `date`
3. If Pi time is wrong: `sudo timedatectl set-timezone Europe/London`

### Cron Not Running

1. Check crontab: `crontab -l`
2. Check cron service: `sudo systemctl status cron`
3. Check cron logs: `grep CRON /var/log/syslog`

---

## Future Enhancements (Out of Scope for v1)

These are documented but not to be implemented in the initial build:

1. **Streak tracking PWA** – Mark lessons as "done", track streaks
2. **Web dashboard** – Visual timetable editor
3. **Calendar export** – .ics file generation
4. **Multi-user support** – Multiple teachers on one Pi

---

## Contact

For questions about this system:
- **User:** Dom Barker
- **Email:** d.barker@etoncollege.org.uk
- **GitHub:** DJBarker87

---

*Last updated: January 2026*
