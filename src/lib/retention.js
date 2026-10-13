// How long a deleted account is kept (and can be restored by signing in)
// before the daily purge job erases it for good. The privacy policy and the
// emails sent to users quote this number — change them together.
export const RESTORE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function restoreDeadline(deletedAt) {
  return new Date(new Date(deletedAt).getTime() + RESTORE_WINDOW_DAYS * DAY_MS);
}

// True while a deleted account can still be restored. Checked at sign-in as
// well as by the purge job, so an account past its window can't be revived
// in the gap before the job gets to it.
export function isRestorable(deletedAt, now = new Date()) {
  return now < restoreDeadline(deletedAt);
}

export function purgeCutoff(now = new Date()) {
  return new Date(now.getTime() - RESTORE_WINDOW_DAYS * DAY_MS);
}
