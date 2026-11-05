import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { formatBudget, formatDate } from '../src/i18n/format.ts';
import { language, setLanguage, t } from '../src/i18n/i18n.ts';
import { TEMPLATE_IDS } from '../src/config/types.ts';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => readFileSync(join(e.parentPath, e.name), 'utf8'));
}

describe('language file', () => {
  it('has every text the code asks for', () => {
    const used = new Set(sources('src').flatMap((code) => [...code.matchAll(/\bt\('([\w.-]+)'/g)].map((m) => m[1]!)));
    for (const id of TEMPLATE_IDS) used.add(`template.${id}`);
    expect(used.size).toBeGreaterThan(100);
    expect([...used].filter((key) => !(key in de))).toEqual([]);
  });

  it('has the same keys, plural forms and placeholders in every language', () => {
    const shape = (texts: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(texts).map(([key, value]) => {
          const forms = typeof value === 'string' ? { text: value } : (value as Record<string, string>);
          const holes = (v: string) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
          return [key, Object.keys(forms).sort().join(',') + '|' + [...new Set(Object.values(forms).map(holes))].sort().join(';')];
        }),
      );
    expect(shape(en)).toEqual(shape(de));
  });
});

describe('language switching', () => {
  it('switches texts and formats, and shows a budget without currency outside German', async () => {
    expect(formatBudget(12.5)).toBe('12,50 €');
    await setLanguage('en');
    try {
      expect(language()).toBe('en');
      expect(t('wizard.who.title')).toBe('Who plays?');
      expect(t('people.summary', { count: 2 })).toBe('2 people');
      expect(formatBudget(12.5)).toBe('12.50');
      expect(formatDate('2026-12-20')).toBe('20 December 2026');
    } finally {
      await setLanguage('de');
    }
    expect(t('wizard.who.title')).toBe('Wer spielt mit?');
  });
});
