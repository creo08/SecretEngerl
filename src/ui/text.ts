/** Texts the UI builds from data: household names, draw outcomes, validation errors. */
import type { RoundConfig } from '../config/types.ts';
import { formatList } from '../i18n/format.ts';
import { hasText, t } from '../i18n/i18n.ts';
import type { ValidationError } from '../input/validate.ts';
import type { DrawResult, RuleRef } from '../losfee/index.ts';

/** "Anna" for a single person, "Haushalt Anna und Bernd", "Haushalt Anna, Bernd und 2 weitere". */
export function householdLabel(members: readonly string[]): string {
  const [a, b] = members as [string, string];
  if (members.length === 1) return a;
  if (members.length === 2) return t('household.two', { a, b });
  return t('household.more', { a, b, count: members.length - 2 });
}

/** A rule of the configuration in words, for "the rule that failed most often". */
export function ruleLabel(config: RoundConfig, rule: RuleRef): string {
  switch (rule.kind) {
    case 'household':
      return t('draw.rule.household');
    case 'exclusion': {
      const e = config.rules.exclusions[rule.index]!;
      return t('draw.rule.exclusion', { from: e.from, to: e.to });
    }
    case 'lastYear': {
      const p = config.rules.lastYear[rule.index]!;
      return t('draw.rule.lastYear', { giver: p.giver, receiver: p.receiver });
    }
    case 'must':
      return t('draw.rule.must', { giver: config.rules.must[rule.index]!.giver });
    case 'noMutual':
      return t('draw.rule.noMutual');
    case 'oneChain':
      return t('draw.rule.oneChain');
  }
}

function receiversText(count: number): string {
  if (count === 0) return t('draw.receivers.zero');
  if (count === 1) return t('draw.receivers.one');
  return t('draw.receivers.many', { count: hasText(`number.${count}`) ? t(`number.${count}`) : count });
}

/** Why a draw failed, in one or two sentences. */
export function drawFailure(config: RoundConfig, names: readonly string[], result: Exclude<DrawResult, { ok: true }>): string {
  switch (result.reason) {
    case 'tooFewReceivers': {
      const givers = formatList(result.givers.map((g) => names[g]!));
      return t(result.givers.length === 1 ? 'draw.tooFew.one' : 'draw.tooFew.many', { givers, receivers: receiversText(result.receivers) });
    }
    case 'impossible':
      return t(result.chain ? 'draw.noChain' : 'draw.impossible');
    case 'tooStrict':
      return t('draw.tooStrict', { rule: ruleLabel(config, result.rule) });
  }
}

/** Friendly messages for validation errors, without duplicates. */
export function errorMessages(errors: readonly ValidationError[]): string[] {
  const messages = errors.map((e) => (hasText(`error.${e.code}`) ? t(`error.${e.code}`, e.params ?? {}) : t('error.unexpected')));
  return [...new Set(messages)];
}
