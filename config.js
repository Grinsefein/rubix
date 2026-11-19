'use strict';

const path = require('node:path');

// Load .env without overriding variables that were already set by the shell
// (for example the port passed by the npm scripts).
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // A .env file is optional in environments that inject variables directly.
}

const isProduction = process.env.NODE_ENV === 'production';
const reportThreshold = Number.parseInt(process.env.REPORT_HIDE_THRESHOLD ?? '3', 10);

module.exports = {
  isProduction,
  port: Number.parseInt(process.env.PORT ?? '', 10) || (isProduction ? 5555 : 5565),
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? 'rubix-development-secret-change-me',
  reportSalt: process.env.REPORT_SALT ?? process.env.SESSION_SECRET ?? 'rubix-report-salt',
  reportHideThreshold: Number.isFinite(reportThreshold) && reportThreshold > 0 ? reportThreshold : 3,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
};
