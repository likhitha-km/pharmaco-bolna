const requestCounts = new Map();

/**
 * Simple in-memory rate limiter.
 * In production: use Redis or express-rate-limit.
 */
export function rateLimit(maxRequests = 60, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const record = requestCounts.get(ip);

    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please wait before sending more requests.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }

    record.count++;
    next();
  };
}
