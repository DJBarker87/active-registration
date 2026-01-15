require('dotenv').config();
const logger = require('./logger');

const PUSHOVER_URL = 'https://api.pushover.net/1/messages.json';
const RESEND_URL = 'https://api.resend.com/emails';
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 30000;

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send a push notification via Pushover API
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} settings - Settings object with pushover config
 * @returns {Promise<void>}
 */
async function sendPushover(title, message, settings) {
  const userKey = process.env.PUSHOVER_USER_KEY;
  const apiToken = process.env.PUSHOVER_API_TOKEN;

  if (!userKey || !apiToken) {
    throw new Error('Missing Pushover credentials: PUSHOVER_USER_KEY and PUSHOVER_API_TOKEN must be set in .env');
  }

  const payload = {
    token: apiToken,
    user: userKey,
    title,
    message,
    priority: settings.pushover?.priority ?? 1,
    sound: settings.pushover?.sound ?? 'pushover'
  };

  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };

  // First attempt
  let response;
  try {
    response = await fetchWithTimeout(PUSHOVER_URL, options);
    if (response.ok) return;
  } catch (err) {
    logger.warn('Pushover first attempt failed, retrying...', { error: err.message });
  }

  // Retry after delay
  await delay(RETRY_DELAY_MS);

  try {
    response = await fetchWithTimeout(PUSHOVER_URL, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pushover API returned ${response.status}: ${text}`);
    }
  } catch (err) {
    throw new Error(`Pushover failed after retry: ${err.message}`);
  }
}

/**
 * Send an email via Resend API
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text)
 * @param {object} settings - Settings object with email config
 * @returns {Promise<void>}
 */
async function sendEmail(subject, body, settings) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Resend credentials: RESEND_API_KEY must be set in .env');
  }

  const from = settings.email?.fromName
    ? `${settings.email.fromName} <${settings.email.from}>`
    : settings.email.from;

  const payload = {
    from,
    to: settings.email.to,
    subject,
    text: body
  };

  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  };

  // First attempt
  let response;
  try {
    response = await fetchWithTimeout(RESEND_URL, options);
    if (response.ok) return;
  } catch (err) {
    logger.warn('Resend first attempt failed, retrying...', { error: err.message });
  }

  // Retry after delay
  await delay(RETRY_DELAY_MS);

  try {
    response = await fetchWithTimeout(RESEND_URL, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Resend API returned ${response.status}: ${text}`);
    }
  } catch (err) {
    throw new Error(`Resend failed after retry: ${err.message}`);
  }
}

/**
 * Send notifications via both Pushover and Email
 * @param {object} lesson - Lesson object with class and subject
 * @param {object} settings - Settings object
 * @returns {Promise<object>} { pushover: 'success'|'failed', email: 'success'|'failed' }
 */
async function sendNotifications(lesson, settings) {
  const pushoverTitle = '📋 Take Registration';
  const pushoverMessage = `${lesson.class} (${lesson.subject})`;

  const emailSubject = `📋 Take Registration – ${lesson.class}`;
  const emailBody = `Reminder: Take registration for ${lesson.class} (${lesson.subject})`;

  logger.info('Sending notifications', { class: lesson.class, subject: lesson.subject });

  const results = await Promise.allSettled([
    sendPushover(pushoverTitle, pushoverMessage, settings),
    sendEmail(emailSubject, emailBody, settings)
  ]);

  const pushoverResult = results[0].status === 'fulfilled' ? 'success' : 'failed';
  const emailResult = results[1].status === 'fulfilled' ? 'success' : 'failed';

  if (pushoverResult === 'success') {
    logger.info('Pushover notification sent successfully');
  } else {
    logger.error('Pushover notification failed', { error: results[0].reason?.message });
  }

  if (emailResult === 'success') {
    logger.info('Email sent successfully');
  } else {
    logger.error('Email failed', { error: results[1].reason?.message });
  }

  return { pushover: pushoverResult, email: emailResult };
}

module.exports = {
  sendPushover,
  sendEmail,
  sendNotifications
};
