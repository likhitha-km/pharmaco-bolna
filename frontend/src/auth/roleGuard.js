export function hasRequiredRole(userProfile, requiredRole) {
  if (!requiredRole) {
    return true;
  }

  return userProfile?.role === requiredRole;
}

export function canAccessAuthProtectedRoute(userProfile) {
  if (!userProfile) {
    return false;
  }

  if (!userProfile.google_account && !userProfile.email_verified) {
    return false;
  }

  if (userProfile.profile_incomplete) {
    return false;
  }

  return true;
}
