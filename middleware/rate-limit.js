'use strict';

/**
 * Small in-memory fixed-window rate limiter.
 * Good enough for a single-process community app; restarting clears the buckets.
 */
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const fresh = timestamps.filter((time) => now - time < windowMs);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, Math.min(windowMs, 10 * 60 * 1000));
  cleanupTimer.unref?.();

  return function limiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const timestamps = (hits.get(key) ?? []).filter((time) => now - time < windowMs);

    if (timestamps.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - timestamps[0])) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
      });
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

module.exports = { rateLimit };
