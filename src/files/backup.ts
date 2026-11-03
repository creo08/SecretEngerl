/**
 * Backup file of a whole round, for a new device or a second organizer. It
 * holds the links with their keys, so without a password it has the same
 * protection as the storage on the device.
 */
import { isStoredRound } from '../store/db.ts';
import type { StoredRound } from '../store/types.ts';

/** The suggested file name, e.g. "runde-2026-12.wichtel". */
export function backupFileName(round: StoredRound): string {
  return `runde-${round.config.occasion.exchangeDate.slice(0, 7)}.wichtel`;
}

/** The content of a backup file. */
export function backupContent(round: StoredRound): Record<string, unknown> {
  return { round };
}

/**
 * The round to store when a backup replaces a round already on the device:
 * the backup's round, keeping every view logged on either side, because the
 * log of the emergency view must not be deletable in the app.
 */
export function mergeForRestore(backup: StoredRound, existing: StoredRound | undefined): StoredRound {
  if (!existing) return backup;
  const views = [...existing.views, ...backup.views].filter((v, i, all) => all.findIndex((w) => w.name === v.name && w.at === v.at) === i);
  return { ...backup, views: views.sort((a, b) => a.at - b.at) };
}

/** Reads the round from a backup file's content; only rounds of this app (`base`) are accepted. */
export function roundFromBackup(content: Record<string, unknown>, base: string): StoredRound | null {
  return isStoredRound(content.round, base) ? content.round : null;
}
