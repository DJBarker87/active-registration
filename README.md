# Active Registration

A simple, reliable system that reminds you to take registration 10 minutes into each lesson.

**How it works:** A Raspberry Pi checks your timetable every minute. When it's 10 minutes into a lesson, it sends you a push notification on your iPhone and a backup email.

---

## Status

**Build complete and tested** (January 2026)

- [x] Logger module
- [x] Timetable loader with validation
- [x] Scheduler with timezone-aware time matching
- [x] Pushover notifications (tested and working)
- [x] Resend email notifications (tested and working)
- [x] Main entry point
- [x] Test scripts (`npm run test:notification`, `npm run test:schedule`)
- [x] Install script for Raspberry Pi
- [ ] Deploy to Raspberry Pi

**Next step:** Clone to Raspberry Pi and run `./scripts/install.sh`

---

## Quick Start

### 1. Set Up External Services

**Pushover** (iOS push notifications):
1. Go to [pushover.net](https://pushover.net) and create an account
2. Purchase the iOS app (~£5 one-time)
3. In Pushover dashboard, click "Create an Application/API Token"
   - Name it "Registration Reminder"
   - Copy the **API Token**
4. Note your **User Key** from the main dashboard page

**Resend** (backup emails):
1. Go to [resend.com](https://resend.com) and create a free account
2. Go to API Keys → Create API Key
3. Copy the key (starts with `re_`)

### 2. Deploy to Raspberry Pi

```bash
# SSH into your Pi
ssh pi@raspberrypi.local

# Clone this repository
git clone https://github.com/DJBarker87/active-registration.git
cd active-registration

# Install dependencies
npm install

# Set up your API keys
cp .env.example .env
nano .env
# Fill in your PUSHOVER_USER_KEY, PUSHOVER_API_TOKEN, and RESEND_API_KEY

# Test that notifications work
npm run test:notification

# Install the cron job (runs every minute)
./scripts/install.sh
```

### 3. Verify It's Working

```bash
# Check the cron job is installed
crontab -l

# Watch logs in real-time
tail -f logs/activity.log
```

---

## Changing Timetables

When a new term starts:

1. Create a new timetable file in `timetables/` (copy and modify an existing one)
2. Edit `config/settings.json` and change `activeTimetable` to the new filename
3. That's it – no restart needed

---

## Files You'll Edit

| File | When to Edit |
|------|--------------|
| `config/settings.json` | Switch timetable, change notification timing |
| `timetables/*.json` | Update lesson schedule |
| `.env` | Update API keys |

---

## Troubleshooting

**Not receiving notifications?**
```bash
# Check the logs
tail -50 logs/activity.log

# Test notifications manually
npm run test:notification
```

**Wrong times?**
```bash
# Check Pi's timezone
date

# Fix if needed
sudo timedatectl set-timezone Europe/London
```

---

## Documentation

- [Full Design Document](docs/DESIGN.md) – Architecture, data model, all the details
- [CLAUDE.md](CLAUDE.md) – Technical build guide

---

## License

Private – for personal use only.
