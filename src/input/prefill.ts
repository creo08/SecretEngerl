/**
 * Pre-fill link v1: `<app>neu#v=1&f=<template>&n=Anna,Bernd;Clara&b=20&d=2026-12-20`.
 * Untrusted input: every value is checked like a form entry, unknown keys are ignored.
 * A name containing `,`, `;`, `&`, `=` or `%` is percent-encoded.
 */
import type { TemplateId } from '../config/types.ts';
import { isTemplateId } from '../config/validate.ts';
import { cleanText, fail, parseAmount, parseHouseholds, parseIsoDate, type Result, type ValidationError } from './validate.ts';

/** What a pre-fill link sets up. Nothing is drawn from it. */
export interface Prefill {
  template: TemplateId;
  households: string[][];
  budget?: number;
  date?: string;
}

const decode = (s: string): string | null => {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
};

/** Parses and validates a pre-fill fragment (with or without "#"). */
export function parsePrefill(fragment: string): Result<Prefill> {
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (text === '') return fail('prefill.empty', '');
  const params = new Map<string, string>();
  for (const part of text.split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0) params.set(part.slice(0, eq), part.slice(eq + 1));
  }
  if (params.get('v') !== '1') return fail('prefill.version', 'v');

  const errors: ValidationError[] = [];
  const template = decode(params.get('f') ?? '');
  if (!isTemplateId(template)) errors.push({ code: 'template.unknown', path: 'f' });

  const groups = (params.get('n') ?? '').split(';').map((g) => g.split(',').map(decode));
  if (groups.flat().some((n) => n === null)) return fail('prefill.invalid', 'n');
  const names = groups.map((g) => (g as string[]).filter((n) => cleanText(n) !== ''));
  const households = parseHouseholds(names, 'n');
  if (!households.ok) errors.push(...households.errors);
  else if (households.value.flat().length === 0) errors.push({ code: 'prefill.noNames', path: 'n' });

  const out: Partial<Prefill> = {};
  if (params.has('b')) {
    const amount = parseAmount(decode(params.get('b')!) ?? '', 'b');
    if (amount.ok) out.budget = amount.value;
    else errors.push(...amount.errors);
  }
  if (params.has('d')) {
    const date = parseIsoDate(decode(params.get('d')!) ?? '', 'd');
    if (date.ok) out.date = date.value;
    else errors.push(...date.errors);
  }
  if (errors.length || !households.ok || !isTemplateId(template)) return { ok: false, errors };
  return { ok: true, value: { template, households: households.value, ...out } };
}
