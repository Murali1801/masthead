import type { TemplateId } from '../types.ts';
import type { TemplateDef } from './kit.ts';
import { specimen } from './specimen.ts';
import { ticker } from './ticker.ts';
import { blueprint } from './blueprint.ts';
import { receipt } from './receipt.ts';
import { rampTpl } from './ramp.ts';
import { terminal } from './terminal.ts';
import { plotter } from './plotter.ts';
import { card } from './card.ts';

export const TEMPLATES: readonly TemplateDef[] = [specimen, ticker, blueprint, receipt, rampTpl, terminal, plotter, card];
export const TEMPLATE_BY_ID = new Map<TemplateId, TemplateDef>(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): TemplateDef {
  return TEMPLATE_BY_ID.get(id as TemplateId) ?? specimen;
}

export type { TemplateDef, FieldSpec } from './kit.ts';
