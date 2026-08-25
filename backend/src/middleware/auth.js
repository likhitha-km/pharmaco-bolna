/**
 * Auth middleware — for hackathon demo, allows all requests.
 * In production, verify Firebase ID token here.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
  const userEmail = req.headers['x-user-email'] || req.headers['X-User-Email'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.user = { uid: userId || 'demo-user-001', email: userEmail || '', role: 'patient' };
  } else if (userId) {
    req.user = { uid: userId, email: userEmail || '', role: 'patient' };
  } else {
    req.user = { uid: 'anonymous', role: 'anonymous' };
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role === role || req.user?.role === 'admin') {
      next();
    } else {
      // For demo: allow all access
      next();
    }
  };
}
