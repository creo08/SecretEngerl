import { describe, expect, it } from 'vitest';
import { comparePair, headingLanguage } from '../scripts/check-docs.ts';

const en = `# Title
## Descriptions
### Julklapp (Svenska)
> Ordet julklapp.

English: The word.

### Secret Santa (English)
> Everyone draws.
`;
const de = `# Titel
## Beschreibungen
### Julklapp (Svenska)
> Ordet julklapp.

Deutsch: Das Wort.

### Secret Santa (English)
> Everyone draws.

Deutsch: Alle ziehen.
`;

describe('check-docs', () => {
  it('reads the language from heading parentheses or heading text', () => {
    expect(headingLanguage('Engerl-Bengerl (German, Austria)')).toBe('de');
    expect(headingLanguage('3.3 English-language variants in the original')).toBe('en');
    expect(headingLanguage('3.3 Varianten aus dem Englischen in der Originalsprache')).toBe('en');
  });

  it('accepts a matching pair', () => {
    expect(comparePair(en, de, 'x')).toEqual([]);
  });

  it('reports a missing translation line', () => {
    const errors = comparePair(en, de.replace('Deutsch: Alle ziehen.', ''), 'x');
    expect(errors.join()).toMatch(/needs a line starting with "Deutsch:"/);
  });

  it('reports different heading structure and quote counts', () => {
    expect(comparePair(en, de.replace('### Julklapp', '#### Julklapp'), 'x').join()).toMatch(/heading structure/);
    expect(comparePair(en, de.replace('> Ordet julklapp.', 'Ordet julklapp.'), 'x').join()).toMatch(/quote\(s\)/);
  });

  it('passes on the specification files', async () => {
    const { readFileSync } = await import('node:fs');
    for (const name of ['concept', 'variants']) {
      const read = (lang: string) => readFileSync(`docs/${name}.${lang}.md`, 'utf8');
      expect(comparePair(read('en'), read('de'), name)).toEqual([]);
    }
  });
});
