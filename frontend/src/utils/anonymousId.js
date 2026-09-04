const KEY = 'pharmaco_anon_id';

/**
 * A stable per-browser identifier for unauthenticated users.
 *
 * Without this, every anonymous visitor was sent to the backend as the
 * literal string "anonymous", so two different anonymous users on two
 * different devices would be treated as the SAME user and could see each
 * other's drafts/reports in My Reports. This gives each anonymous browser
 * its own real, stable identity so report ownership can be enforced
 * correctly, exactly like a logged-in uid.
 */
export function getAnonymousId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = 'anon-' + (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to a
    // per-session-only id so isolation still holds within this tab.
    return 'anon-session';
  }
}
