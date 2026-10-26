export type MtgFormat =
  | 'standard'
  | 'pauper'
  | 'pauper_standard'
  | 'commander'
  | 'duel_commander'
  | 'brawl'
  | 'competitive_brawl'
  | 'standard_brawl';

export const FORMAT_KEYS: readonly MtgFormat[] = [
  'standard',
  'pauper',
  'pauper_standard',
  'commander',
  'duel_commander',
  'brawl',
  'competitive_brawl',
  'standard_brawl',
];

export interface Card {
  name: string;
  type_line: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  cmc: number;
  mana_cost?: string;
  legalities: Record<string, string>;
  rarity: string;
  set_code?: string;
}

export interface DeckCard {
  card: Card;
  quantity: number;
  is_commander?: boolean;
  is_sideboard?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FormatRules {
  minCards: number;
  maxCards: number | null;
  maxCopies: number;
  hasSideboard: boolean;
  sideboardMax: number;
  hasCommander: boolean;
}

/** Result of an oracle-level legality lookup. `setCode` is a printing that is legal in the format. */
export interface OracleLegalityHit {
  legal: boolean;
  setCode?: string;
}

/**
 * Looks up whether any printing of `name` is legal for `legalityKey`.
 * `legalityKey` uses Scryfall legality names (`standard`, `standardbrawl`, `pauper`, ...).
 */
export type OracleLegalityResolver = (
  name: string,
  legalityKey: string,
) => Promise<OracleLegalityHit>;
