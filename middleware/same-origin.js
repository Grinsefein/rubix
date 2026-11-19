'use strict';

/**
 * Reject browser requests whose Origin does not match the host.
 * Combined with SameSite=Lax cookies this blocks cross-site state changes.
 * Requests without an Origin header (curl, server-to-server) are allowed.
 */
function sameOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const origin = req.get('origin');
  if (!origin) return next();

  try {
    const parsed = new URL(origin);
    if (parsed.host === req.get('host')) return next();
  } catch {
    // Fall through to the rejection below.
  }

  return res.status(403).json({ error: 'Invalid request origin.' });
}

module.exports = { sameOrigin };
