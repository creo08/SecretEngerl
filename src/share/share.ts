/**
 * Hands one draw to the system share sheet. Without Web Share support the link
 * goes to the clipboard. There is never a list of links and never a direct
 * messenger URL, which would send the key to the messenger's servers.
 */
import { t } from '../i18n/i18n.ts';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The message for one person; the link is part of the text so no app can drop it. */
export function shareMessage(link: string): string {
  return t('share.message', { link });
}

/** Shares the message, or copies it if sharing is not supported. */
export async function shareDraw(message: string, nav: Pick<Navigator, 'canShare' | 'share' | 'clipboard'> = navigator): Promise<ShareOutcome> {
  const data = { text: message };
  if (typeof nav.canShare === 'function' && nav.canShare(data)) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Sharing failed for another reason (e.g. no user gesture): fall back to the clipboard.
    }
  }
  try {
    await nav.clipboard.writeText(message);
    return 'copied';
  } catch {
    return 'failed';
  }
}
