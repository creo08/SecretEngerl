/**
 * Configuration model of a round, one field group per category A to K of
 * docs/variants.en.md section 4. Templates are stored partial configurations.
 * Fields for later phases (Advent, party games, k gifts) are typed already so
 * they can be added without reshaping the model.
 */

/** Fixed list of templates. The ids also appear in links and pre-fill links. */
export const TEMPLATE_IDS = ['engerl-bengerl', 'schrottwichteln', 'familien-wichteln', 'buero-wichteln'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** The two families of the custom. */
export type Family = 'drawn' | 'party';

/** A: occasion and period. Dates are ISO `YYYY-MM-DD`. */
export interface Occasion {
  exchangeDate: string;
  revealDate?: string;
  /** Later phase: Advent rounds with a rhythm. */
  period?: { start: string; end: string; rhythm: 'weekly' };
}

/** B: participants. Every inner list is one household; a single person is a household of one. */
export interface Participants {
  households: string[][];
}

/** C: structure of the matching. */
export interface Structure {
  noMutual: boolean;
  oneChain: boolean;
  /** Gifts per person; only 1 until the Advent calendar arrives. */
  giftsPerPerson: 1;
}

/** D: a directed exclusion, or one in both directions. */
export interface Exclusion {
  from: string;
  to: string;
  bothWays: boolean;
}

/** D: a must rule. One choice means "gives to"; several mean "gives to one of". */
export interface MustRule {
  giver: string;
  choices: string[];
}

/** D: a pairing from last year that must not repeat. */
export interface Pairing {
  giver: string;
  receiver: string;
}

/** D: rules and exclusions. */
export interface Rules {
  exclusions: Exclusion[];
  must: MustRule[];
  lastYear: Pairing[];
}

/** F: kind of gift. `own-only` is Schrottwichteln: buy nothing, give what you have. */
export type GiftKind = 'bought' | 'own-only';

/** F: gift rules. `budget` null means no budget. */
export interface Gifts {
  budget: { amount: number; currency: 'EUR' } | null;
  kind: GiftKind;
  theme: string;
  /** Hint per person name, shown only to that person's Engerl. */
  hints: Record<string, string>;
}

/** G: how gifts change hands. */
export type ExchangeMode = 'in-person' | 'hidden' | 'post' | 'digital';

/** H: communication during the round. Without a server there is none. */
export type Communication = 'none';

/** I: reveal. */
export type Reveal = 'in-person' | 'guessing' | 'chain' | 'stage' | 'never';

/** K: context of the round. */
export type Context = 'family' | 'friends' | 'office' | 'club' | 'school' | 'online' | 'charity';

/** A complete round of the drawn family. E (secrecy) is fixed: private links, organizer peeks only through a hurdle. */
export interface RoundConfig {
  version: 1;
  template: TemplateId;
  family: 'drawn';
  occasion: Occasion;
  participants: Participants;
  structure: Structure;
  rules: Rules;
  gifts: Gifts;
  exchange: ExchangeMode;
  communication: Communication;
  reveal: Reveal;
  context: Context;
  /** B: whether the organizer is one of the participants. */
  organizerPlays: boolean;
  /** Place of the exchange, optional free text. */
  place: string;
}

/** Which optional fields the setup wizard shows in the main flow; the rest sits under "Mehr Optionen". */
export interface TemplateFields {
  budget: boolean;
  theme: boolean;
  hints: boolean;
  lastYear: boolean;
}

/** A template: defaults for a round plus which fields the wizard shows. */
export interface Template {
  id: TemplateId;
  family: Family;
  defaults: Omit<RoundConfig, 'version' | 'template' | 'family' | 'occasion' | 'participants'>;
  fields: TemplateFields;
}
