/** The templates of the MVP, validated when the module loads. */
import type { RoundConfig, Template, TemplateId } from './types.ts';
import { validateTemplate } from './validate.ts';
import engerlBengerl from './templates/engerl-bengerl.json';
import schrottwichteln from './templates/schrottwichteln.json';
import familienWichteln from './templates/familien-wichteln.json';
import bueroWichteln from './templates/buero-wichteln.json';
import postWichteln from './templates/post-wichteln.json';

function load(raw: unknown): Template {
  const result = validateTemplate(raw);
  if (!result.ok) throw new Error(`invalid template: ${JSON.stringify(result.errors)}`);
  return result.value;
}

/** All templates in the order the app offers them. */
export const TEMPLATES: readonly Template[] = [engerlBengerl, schrottwichteln, familienWichteln, bueroWichteln, postWichteln].map(load);

/** Returns the template with this id. */
export function getTemplate(id: TemplateId): Template {
  return TEMPLATES.find((t) => t.id === id)!;
}

/** Starts a round configuration from a template. Defaults are deep-copied. */
export function configFromTemplate(id: TemplateId, households: string[][], exchangeDate: string): RoundConfig {
  const t = getTemplate(id);
  return {
    version: 1,
    template: t.id,
    family: 'drawn',
    occasion: { exchangeDate },
    participants: { households },
    ...structuredClone(t.defaults),
    addresses: {},
  };
}
