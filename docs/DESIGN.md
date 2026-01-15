# Active Registration – Design Document

> **Version:** 1.0  
> **Last Updated:** January 2026  
> **Author:** Dom Barker / Claude  

---

## 1. Problem Statement

### The Challenge

Taking registration at the start of each lesson is a simple but easily forgotten task. It doesn't demand cognitive effort, so the brain doesn't flag it as important in the moment. By the time you remember, you've either moved on or the moment has passed.

### User Requirements

- Receive a reminder **10 minutes into each lesson** (not at the start – this allows time to settle the class)
- Reminder should clearly identify **which class** requires registration
- **Two notification channels** for redundancy: iOS push notification + email backup
- System must be **reliable** – notifications must arrive within 1-2 minutes of scheduled time
- Timetable must be **easy to update** when terms change (Lent → Summer → Michaelmas)
- Minimal ongoing maintenance

### Why Existing Solutions Don't Work

| Solution | Problem |
|----------|---------|
| Phone alarms | No class context; requires manual setup for each slot |
| Calendar reminders | Clutters calendar; no "done" tracking |
| GitHub Actions | Timing unreliable – up to 30 minutes drift |
| Free-tier servers | Sleep after inactivity; unreliable for cron |
| iOS Shortcuts | Can't send emails easily; tedious to update |

---

## 2. Solution Overview

A lightweight Node.js application running on a Raspberry Pi that:

1. Checks the current time every minute via system cron
2. Looks up whether this moment is 10 minutes into a scheduled lesson
3. If yes, sends a push notification (via Pushover) and an email (via Resend)
4. Logs all activity for debugging

### Why a Raspberry Pi?

- **Always on** – no cold starts, no sleeping
- **Precise timing** – system cron fires within seconds
- **Local control** – no dependency on external service reliability
- **Cost effective** – one-time hardware cost, no ongoing fees

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RASPBERRY PI                                  │
│                                                                      │
│  ┌──────────────┐     ┌──────────────────────────────────────────┐  │
│  │   System     │     │            Node.js Application            │  │
│  │   Cron       │────▶│                                          │  │
│  │              │     │  ┌─────────────────────────────────────┐ │  │
│  │  * * * * *   │     │  │         src/index.js                │ │  │
│  │  (every min) │     │  │                                     │ │  │
│  └──────────────┘     │  │  1. Load active timetable           │ │  │
│                       │  │  2. Get current day/time            │ │  │
│                       │  │  3. Check: is this a notification   │ │  │
│                       │  │     moment?                         │ │  │
│                       │  │  4. If yes: send notifications      │ │  │
│                       │  │  5. Log result                      │ │  │
│                       │  │                                     │ │  │
│                       │  └─────────────────────────────────────┘ │  │
│                       │                                          │  │
│                       │  ┌─────────────────────────────────────┐ │  │
│                       │  │     timetables/lent-2026.json       │ │  │
│                       │  │     timetables/summer-2026.json     │ │  │
│                       │  │     timetables/michaelmas-2026.json │ │  │
│                       │  └─────────────────────────────────────┘ │  │
│                       │                                          │  │
│                       │  ┌─────────────────────────────────────┐ │  │
│                       │  │         config/settings.json         │ │  │
│                       │  │   - Active timetable reference       │ │  │
│                       │  │   - Notification lead time (10 min)  │ │  │
│                       │  │   - Email address                    │ │  │
│                       │  └─────────────────────────────────────┘ │  │
│                       │                                          │  │
│                       └──────────────────────────────────────────┘  │
│                                          │                          │
└──────────────────────────────────────────┼──────────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
          ┌─────────────────┐                          ┌─────────────────┐
          │    Pushover     │                          │     Resend      │
          │    API          │                          │     API         │
          │                 │                          │                 │
          │  Push to iOS    │                          │  Email to       │
          │  "📋 Take       │                          │  d.barker@...   │
          │   registration  │                          │                 │
          │   – CMsiW-1"    │                          │                 │
          └─────────────────┘                          └─────────────────┘
                    │                                             │
                    ▼                                             ▼
             ┌───────────┐                               ┌───────────────┐
             │  iPhone   │                               │  Email Inbox  │
             └───────────┘                               └───────────────┘
```

---

## 4. Data Model

### 4.1 Timetable Schema

Each timetable is a JSON file representing one academic term.

```json
{
  "meta": {
    "name": "Lent 2026",
    "startDate": "2026-01-12",
    "endDate": "2026-03-28",
    "description": "Lent term timetable"
  },
  "periods": {
    "1st School": { "start": "09:00", "end": "09:40" },
    "2nd School": { "start": "09:50", "end": "10:30" },
    "3rd School": { "start": "10:40", "end": "11:20" },
    "4th School": { "start": "11:45", "end": "12:25" },
    "5th School": { "start": "12:35", "end": "13:15" },
    "After 4":    { "start": "16:30", "end": "17:10" },
    "After 5":    { "start": "17:20", "end": "18:00" }
  },
  "schedule": {
    "monday": [
      { "period": "1st School", "class": "FMat2-2", "subject": "Further Maths", "room": "23 New" },
      { "period": "2nd School", "class": "BMdaV-3", "subject": "Double Maths (Applied)", "room": "23 New" },
      { "period": "4th School", "class": "CMdaY-6", "subject": "Double Maths (Applied)", "room": "23 New" },
      { "period": "After 4",    "class": "CMsiW-1", "subject": "Single Maths", "room": "23 New" }
    ],
    "tuesday": [
      { "period": "2nd School", "class": "CMsiW-1", "subject": "Single Maths", "room": "23 New" },
      { "period": "4th School", "class": "FMat2-2", "subject": "Further Maths", "room": "23 New" }
    ],
    "wednesday": [
      { "period": "1st School", "class": "CMsiW-1", "subject": "Single Maths", "room": "23 New" },
      { "period": "4th School", "class": "BMdaV-3", "subject": "Double Maths (Applied)", "room": "23 New" }
    ],
    "thursday": [
      { "period": "1st School", "class": "BMdaV-3", "subject": "Double Maths (Applied)", "room": "23 New" },
      { "period": "2nd School", "class": "CMdaY-6", "subject": "Double Maths (Applied)", "room": "23 New" },
      { "period": "4th School", "class": "CMsiW-1", "subject": "Single Maths", "room": "23 New" }
    ],
    "friday": [
      { "period": "1st School", "class": "CMdaY-6", "subject": "Double Maths (Applied)", "room": "23 New" },
      { "period": "3rd School", "class": "FMat2-2", "subject": "Further Maths", "room": "23 New" }
    ],
    "saturday": [
      { "period": "1st School", "class": "CMdaY-6", "subject": "Double Maths (Applied)", "room": "23 New" },
      { "period": "2nd School", "class": "BMdaV-3", "subject": "Double Maths (Applied)", "room": "23 New" },
      { "period": "4th School", "class": "FMat2-2", "subject": "Further Maths", "room": "23 New" }
    ]
  }
}
```

### 4.2 Settings Schema

```json
{
  "activeTimetable": "lent-2026",
  "notificationOffset": 10,
  "email": {
    "to": "d.barker@etoncollege.org.uk",
    "from": "registration@yourdomain.com",
    "fromName": "Registration Reminder"
  },
  "pushover": {
    "priority": 1,
    "sound": "pushover"
  },
  "timezone": "Europe/London"
}
```

### 4.3 Environment Variables

Stored in `.env` (not committed to git):

```
PUSHOVER_USER_KEY=your_user_key_here
PUSHOVER_API_TOKEN=your_app_token_here
RESEND_API_KEY=re_xxxxxxxxxxxx
```

---

## 5. Core Logic

### 5.1 Notification Timing

The system determines when to send notifications using this logic:

```
notification_time = period_start_time + notification_offset

Example:
  1st School starts at 09:00
  notification_offset = 10 minutes
  notification_time = 09:10
```

### 5.2 Main Algorithm

```
Every minute (triggered by cron):

1. Load settings.json
2. Load the active timetable file
3. Get current time in Europe/London timezone
4. Get current day of week (lowercase: "monday", "tuesday", etc.)
5. Get today's lessons from schedule[day]
6. For each lesson:
   a. Calculate notification_time = period_start + offset
   b. If current_time matches notification_time (same hour and minute):
      - Send Pushover notification
      - Send email
      - Log success
7. Exit
```

### 5.3 Time Matching Logic

```javascript
// Only match hour and minute, ignore seconds
const currentHour = now.getHours();
const currentMinute = now.getMinutes();

const [periodHour, periodMinute] = period.start.split(':').map(Number);
const notifyHour = Math.floor((periodHour * 60 + periodMinute + offset) / 60);
const notifyMinute = (periodHour * 60 + periodMinute + offset) % 60;

if (currentHour === notifyHour && currentMinute === notifyMinute) {
  // This is a notification moment
}
```

---

## 6. External Services

### 6.1 Pushover

**Purpose:** Deliver push notifications to iOS

**Setup Required:**
1. Create account at pushover.net
2. Purchase iOS app (~£5 one-time)
3. Create an "Application" in Pushover dashboard to get API token
4. Note your User Key from the dashboard

**API Call:**
```javascript
POST https://api.pushover.net/1/messages.json
{
  "token": "APP_API_TOKEN",
  "user": "USER_KEY",
  "title": "📋 Take Registration",
  "message": "CMsiW-1 (Single Maths)",
  "priority": 1,
  "sound": "pushover"
}
```

**Priority Levels:**
- `-2`: No notification, no sound
- `-1`: Quiet notification
- `0`: Normal priority
- `1`: High priority (bypasses quiet hours)
- `2`: Emergency (repeats until acknowledged)

We use priority `1` to ensure delivery during class time.

### 6.2 Resend

**Purpose:** Send backup emails

**Setup Required:**
1. Create free account at resend.com
2. Add and verify a sending domain (or use their test domain initially)
3. Generate API key

**API Call:**
```javascript
POST https://api.resend.com/emails
Headers: { "Authorization": "Bearer re_xxxx" }
{
  "from": "Registration Reminder <registration@yourdomain.com>",
  "to": "d.barker@etoncollege.org.uk",
  "subject": "📋 Take Registration – CMsiW-1",
  "text": "Reminder: Take registration for CMsiW-1 (Single Maths)"
}
```

**Free Tier:** 3,000 emails/month (more than sufficient – ~400 lessons/term)

---

## 7. Error Handling

### 7.1 Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Pi loses power | No notifications | UPS recommended; logs show gaps |
| Pi loses internet | APIs unreachable | Retry logic; queue for later |
| Pushover API down | No push notification | Email backup still sends |
| Resend API down | No email | Push notification still sends |
| Invalid timetable JSON | Script crashes | Validate on load; log error |
| Wrong timezone | Notifications at wrong time | Explicit timezone in settings |

### 7.2 Retry Logic

If an API call fails:
1. Wait 5 seconds
2. Retry once
3. If still failing, log error and continue

We don't retry indefinitely because:
- The moment for that notification has passed
- The other channel (email or push) likely succeeded
- The next notification is only ~50 minutes away

### 7.3 Logging

All activity is logged to `logs/activity.log`:

```
2026-01-13 09:10:00 [INFO] Checking for notifications...
2026-01-13 09:10:00 [INFO] Match found: CMsiW-1 (Single Maths)
2026-01-13 09:10:01 [INFO] Pushover notification sent successfully
2026-01-13 09:10:01 [INFO] Email sent successfully
2026-01-13 09:10:01 [INFO] Complete

2026-01-13 09:11:00 [INFO] Checking for notifications...
2026-01-13 09:11:00 [INFO] No lessons at this time
2026-01-13 09:11:00 [INFO] Complete
```

Logs rotate weekly to prevent disk fill.

---

## 8. Directory Structure

```
active-registration/
├── README.md                 # Quick start guide
├── CLAUDE.md                 # Build guide for Claude Code
├── package.json              # Node.js dependencies
├── .env.example              # Template for environment variables
├── .gitignore                # Excludes .env, logs, node_modules
│
├── docs/
│   └── DESIGN.md             # This document
│
├── config/
│   └── settings.json         # Active timetable, notification offset, etc.
│
├── timetables/
│   ├── lent-2026.json        # Lent term timetable
│   ├── summer-2026.json      # Summer term timetable (placeholder)
│   └── michaelmas-2026.json  # Michaelmas term timetable (placeholder)
│
├── src/
│   ├── index.js              # Main entry point (runs every minute)
│   ├── scheduler.js          # Time matching logic
│   ├── notifications.js      # Pushover + Resend API calls
│   ├── timetable.js          # Timetable loading and parsing
│   └── logger.js             # Logging utility
│
├── logs/
│   └── activity.log          # Runtime logs (git-ignored)
│
└── scripts/
    ├── install.sh            # Pi setup script
    └── test-notification.sh  # Send a test notification
```

---

## 9. Deployment

### 9.1 Prerequisites

- Raspberry Pi (any model 3/4/5) with Raspberry Pi OS
- Node.js 20.x installed
- Internet connection
- Pushover account and iOS app
- Resend account

### 9.2 Installation Steps

1. Clone repository to Pi
2. Copy `.env.example` to `.env` and fill in API keys
3. Run `npm install`
4. Run `scripts/install.sh` to set up cron
5. Run `scripts/test-notification.sh` to verify

### 9.3 Cron Setup

The install script adds this line to crontab:

```
* * * * * cd /home/pi/active-registration && /usr/bin/node src/index.js >> logs/cron.log 2>&1
```

This runs the script every minute, every day.

---

## 10. Future Enhancements

These are explicitly **out of scope** for v1.0 but documented for future reference:

### 10.1 Streak Tracking

Add a simple PWA that:
- Shows today's lessons
- Lets you tap "Done" to mark registration complete
- Tracks consecutive days of completion
- Stores data in a local SQLite database on the Pi

### 10.2 Web Dashboard

A simple web interface (served from the Pi) to:
- View current timetable
- Switch active timetable
- Edit timetable visually
- View notification logs

### 10.3 Calendar Integration

Export timetable to .ics format for calendar apps.

### 10.4 Colleague Sharing

Multi-user support – same Pi serves multiple teachers with different timetables.

---

## 11. Security Considerations

### 11.1 API Keys

- Stored in `.env` file, never committed to git
- `.env` is in `.gitignore`
- Keys have limited scope (Pushover: send only; Resend: send only)

### 11.2 Network

- Pi should be on a secure home network
- No inbound ports need to be open
- All API calls are outbound HTTPS

### 11.3 Repository

- Repository is private (contains timetable with room numbers)
- No sensitive data in committed files

---

## 12. Testing Strategy

### 12.1 Unit Tests

- Time matching logic (does 09:10 match a 09:00 lesson with +10 offset?)
- Timetable parsing (malformed JSON handling)
- Day of week calculation

### 12.2 Integration Tests

- Pushover API call with test credentials
- Resend API call with test credentials

### 12.3 Manual Testing

- `npm run test:notification` – sends a test notification immediately
- `npm run test:schedule` – shows what notifications would fire today

---

## 13. Appendix: Lent 2026 Timetable

For reference, here is the complete lesson schedule extracted from the uploaded timetable image:

| Day | Period | Time | Class | Subject |
|-----|--------|------|-------|---------|
| Monday | 1st School | 09:00–09:40 | FMat2-2 | Further Maths |
| Monday | 2nd School | 09:50–10:30 | BMdaV-3 | Double Maths (Applied) |
| Monday | 4th School | 11:45–12:25 | CMdaY-6 | Double Maths (Applied) |
| Monday | After 4 | 16:30–17:10 | CMsiW-1 | Single Maths |
| Tuesday | 2nd School | 09:50–10:30 | CMsiW-1 | Single Maths |
| Tuesday | 4th School | 11:45–12:25 | FMat2-2 | Further Maths |
| Wednesday | 1st School | 09:00–09:40 | CMsiW-1 | Single Maths |
| Wednesday | 4th School | 11:45–12:25 | BMdaV-3 | Double Maths (Applied) |
| Thursday | 1st School | 09:00–09:40 | BMdaV-3 | Double Maths (Applied) |
| Thursday | 2nd School | 09:50–10:30 | CMdaY-6 | Double Maths (Applied) |
| Thursday | 4th School | 11:45–12:25 | CMsiW-1 | Single Maths |
| Friday | 1st School | 09:00–09:40 | CMdaY-6 | Double Maths (Applied) |
| Friday | 3rd School | 10:40–11:20 | FMat2-2 | Further Maths |
| Saturday | 1st School | 09:00–09:40 | CMdaY-6 | Double Maths (Applied) |
| Saturday | 2nd School | 09:50–10:30 | BMdaV-3 | Double Maths (Applied) |
| Saturday | 4th School | 11:45–12:25 | FMat2-2 | Further Maths |

**Notification times** (with +10 minute offset):

| Time | Days |
|------|------|
| 09:10 | Mon, Wed, Thu, Fri, Sat |
| 10:00 | Mon, Tue, Thu, Sat |
| 10:50 | Fri |
| 11:55 | Mon, Tue, Wed, Thu, Sat |
| 16:40 | Mon |

---

*End of Design Document*
