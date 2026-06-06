export * from './r4/index.js';
export * as R4 from './r4/index.js';

import type { Money } from './r4/index.js';

export type Currency = NonNullable<Money['currency']>;

export type QuestionnaireStatus = 'draft' | 'active' | 'retired' | 'unknown';

export type QuestionnaireItemType =
  | 'group'
  | 'display'
  | 'boolean'
  | 'decimal'
  | 'integer'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'string'
  | 'text'
  | 'url'
  | 'choice'
  | 'open-choice'
  | 'attachment'
  | 'reference'
  | 'quantity';
