import { isBannedAsDuelCommander, isBannedInDuelDeck } from './duel-commander-banlist';
import {
  FORMAT_KEYS,
  type Card,
  type DeckCard,
  type FormatRules,
  type MtgFormat,
  type OracleLegalityHit,
  type OracleLegalityResolver,
  type ValidationResult,
} from './types';

export const FORMAT_RULES: Record<MtgFormat, FormatRules> = {
  standard: { minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, sideboardMax: 15, hasCommander: false },
  pauper: { minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, sideboardMax: 15, hasCommander: false },
  pauper_standard: { minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, sideboardMax: 15, hasCommander: false },
  commander: { minCards: 100, maxCards: 100, maxCopies: 1, hasSideboard: false, sideboardMax: 0, hasCommander: true },
  duel_commander: { minCards: 100, maxCards: 100, maxCopies: 1, hasSideboard: false, sideboardMax: 0, hasCommander: true },
  brawl: { minCards: 100, maxCards: 100, maxCopies: 1, hasSideboard: false, sideboardMax: 0, hasCommander: true },
  competitive_brawl: { minCards: 100, maxCards: 100, maxCopies: 1, hasSideboard: false, sideboardMax: 0, hasCommander: true },
  standard_brawl: { minCards: 60, maxCards: 60, maxCopies: 1, hasSideboard: false, sideboardMax: 0, hasCommander: true },
};

// Formats validated against the intersection of several legality keys.
const COMPOSITE_FORMAT_LEGALITIES: Partial<Record<MtgFormat, string[]>> = {
  pauper_standard: ['standard', 'pauper'],
};

/**
 * Scryfall legality key for each internal format.
 * Scryfall spells Standard Brawl as `standardbrawl` (no underscore). The last
 * alias is the fallback pool.
 */
const LEGALITY_KEY_ALIASES: Record<string, string[]> = {
  standard_brawl: ['standard_brawl', 'standardbrawl', 'standard'],
  competitive_brawl: ['competitive_brawl', 'brawl'],
  brawl: ['brawl'],
  duel_commander: ['duel_commander', 'duel'],
  pauper_standard: ['pauper_standard'],
};

/** Legality of a card for `key`, trying aliases before giving up. */
export function resolveLegality(
  legalities: Record<string, string> | null | undefined,
  key: string,
): string | undefined {
  const table = legalities || {};
  for (const alias of LEGALITY_KEY_ALIASES[key] ?? [key]) {
    if (typeof table[alias] === 'string') return table[alias];
  }
  return undefined;
}

function isMtgFormat(value: string): value is MtgFormat {
  return FORMAT_KEYS.some(format => format === value);
}

/**
 * `format` is used as an object key and in strict comparisons. Callers pass
 * values from stored decks and URLs, sometimes wrapped (`{format: 'commander'}`)
 * or with odd casing. Unknown values fall back to standard.
 */
export function normalizeFormat(format: unknown): MtgFormat {
  const raw = unwrapFormat(format);
  const key = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return isMtgFormat(key) ? key : 'standard';
}

function unwrapFormat(format: unknown): string {
  if (typeof format === 'string') return format;
  if (format == null) return '';
  if (typeof format === 'object') {
    if ('format' in format && format.format != null) return String(format.format);
    if ('value' in format && format.value != null) return String(format.value);
    if ('name' in format && format.name != null) return String(format.name);
  }
  return String(format);
}

function qty(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loweredLabel(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (value == null) return '';
  if (typeof value === 'object' && 'name' in value) return String(value.name ?? value).toLowerCase();
  return String(value).toLowerCase();
}

function cardDisplayName(name: unknown): string {
  if (!loweredLabel(name)) return '';
  if (name !== null && typeof name === 'object' && 'name' in name) return String(name.name ?? name);
  return String(name);
}

function typeLine(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object' && 'name' in value && value.name != null) return String(value.name);
  return '';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function legalitiesOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

interface RawDeckEntry {
  card?: unknown;
  quantity?: unknown;
  is_commander?: unknown;
  is_sideboard?: unknown;
}

function isRawDeckEntry(value: unknown): value is RawDeckEntry & { card: object } {
  if (!value || typeof value !== 'object' || !('card' in value)) return false;
  return Boolean(value.card) && typeof value.card === 'object';
}

/** Drop entries without a usable card object and normalize their shape. */
function sanitizeDeckCards(cards: unknown): DeckCard[] {
  if (!Array.isArray(cards)) return [];
  return cards.filter(isRawDeckEntry).map((entry): DeckCard => {
    const raw = entry.card;
    const name = 'name' in raw ? raw.name : undefined;
    const rawTypeLine = 'type_line' in raw ? raw.type_line : undefined;
    const oracleText = 'oracle_text' in raw ? raw.oracle_text : undefined;
    const colors = 'colors' in raw ? raw.colors : undefined;
    const colorIdentity = 'color_identity' in raw ? raw.color_identity : undefined;
    const cmc = 'cmc' in raw ? raw.cmc : undefined;
    const legalities = 'legalities' in raw ? raw.legalities : undefined;
    const rarity = 'rarity' in raw ? raw.rarity : undefined;
    const manaCostValue = 'mana_cost' in raw ? raw.mana_cost : undefined;
    const setCodeValue = 'set_code' in raw ? raw.set_code : undefined;
    const manaCost = typeof manaCostValue === 'string' ? manaCostValue : undefined;
    const setCode = typeof setCodeValue === 'string' ? setCodeValue : undefined;
    const card: Card = {
      name: cardDisplayName(name),
      type_line: typeLine(rawTypeLine),
      oracle_text: typeof oracleText === 'string' ? oracleText : '',
      colors: stringArray(colors),
      color_identity: stringArray(colorIdentity),
      cmc: qty(cmc),
      legalities: legalitiesOf(legalities),
      rarity: typeof rarity === 'string' ? rarity : '',
    };
    if (manaCost !== undefined) card.mana_cost = manaCost;
    if (setCode !== undefined) card.set_code = setCode;
    return {
      quantity: qty(entry.quantity),
      is_commander: Boolean(entry.is_commander),
      is_sideboard: Boolean(entry.is_sideboard),
      card,
    };
  });
}

const BASIC_LAND_COLORS: Record<string, string> = {
  Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G',
};

const BASIC_LAND_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];

const isLandTypeLine = (typeLineValue: unknown) => /\bland\b/i.test(String(typeLineValue || ''));

function isBasicLand(card: Card): boolean {
  return /\bBasic\b/i.test(card.type_line) || BASIC_LAND_NAMES.includes(card.name);
}

/** Arena dual lands whose stored color identity may arrive empty or stale. */
export const KNOWN_LAND_COLORS: Record<string, string[]> = {
  'rugged highlands': ['R', 'G'], 'jungle hollow': ['B', 'G'],
  'scoured barrens': ['W', 'B'], 'wind-scarred crag': ['R', 'W'],
  'blossoming sands': ['G', 'W'], 'dismal backwater': ['U', 'B'],
  'swiftwater cliffs': ['U', 'R'], 'thornwood falls': ['U', 'G'],
  'tranquil cove': ['W', 'U'], 'bloodfell caves': ['B', 'R'],
  'jagged barrens': ['B', 'R'], 'abandoned campground': ['R', 'G'],
  'sinister hideout': ['U', 'B'], 'timber gorge': ['R', 'G'],
  'stone quarry': ['R', 'W'], 'cinder barrens': ['B', 'R'],
  'foul orchard': ['B', 'G'], 'meandering river': ['W', 'U'],
  'submerged boneyard': ['U', 'B'], 'secluded courtyard': ['W', 'U'],
};

const ALL_COLORS = ['W', 'U', 'B', 'R', 'G'];

/**
 * Cards whose mana cost requires a color the deck's lands do not produce.
 * Used in formats without a commander, where there is no color identity.
 *
 * Deliberately conservative: if any land has no reliable color data (empty
 * identity, "any color", a land tutor, and so on) the function returns nothing,
 * because a false positive would reject a playable deck.
 */
export function findUnproducibleColorCards(
  mainboard: DeckCard[],
): Array<{ name: string; color: string }> {
  const produced = new Set<string>();
  for (const entry of mainboard) {
    if (!isLandTypeLine(entry.card.type_line)) continue;
    const name = loweredLabel(entry.card.name);
    const oracle = loweredLabel(entry.card.oracle_text);

    if (/any color|de cualquier color|search your library/.test(oracle)) return [];

    const mapped = KNOWN_LAND_COLORS[name];
    const identity = mapped ?? entry.card.color_identity;
    const basic = BASIC_LAND_COLORS[entry.card.name];

    if (identity.length === 0 && !basic) {
      const fromOracle = [...String(entry.card.oracle_text || '').matchAll(/add\s+((?:\{[WUBRGC0-9X/]+\}\s*(?:or\s*)?)+)/gi)]
        .flatMap(match => [...match[1].matchAll(/\{([WUBRG])\}/g)].map(symbol => symbol[1]));
      if (fromOracle.length === 0) return [];
      fromOracle.forEach(color => produced.add(color));
      continue;
    }

    identity.forEach(color => produced.add(color));
    if (basic) produced.add(basic);
  }
  if (produced.size === 0) return [];
  if (ALL_COLORS.every(color => produced.has(color))) return [];

  const out: Array<{ name: string; color: string }> = [];
  for (const entry of mainboard) {
    if (isLandTypeLine(entry.card.type_line)) continue;
    const manaCost = String(entry.card.mana_cost || '').split('//')[0];
    const required = new Set([...manaCost.matchAll(/\{([WUBRG])\}/g)].map(match => match[1]));
    for (const color of required) {
      if (!produced.has(color)) out.push({ name: entry.card.name, color });
    }
  }
  return out;
}

/**
 * Formats where legality rotates. The card's own legality entry must say
 * "legal". No cross-format fallback is allowed here.
 */
const STRICT_LEGALITY_FORMATS = new Set([
  'standard', 'brawl', 'standard_brawl', 'alchemy', 'pauper_standard',
]);

/**
 * Oracle-level legality, not printing-level legality.
 *
 * A database often stores one row per printing, so a card reprinted into a
 * current set can still be marked `not_legal` on the older printing in the deck.
 * `validateDeck` is synchronous, so lookups fill an in-memory cache: the first
 * pass can be conservative and later passes use the resolved value.
 */
const oracleLegalCache = new Map<string, OracleLegalityHit>();
const oracleLegalInFlight = new Set<string>();
const oracleLegalListeners = new Set<() => void>();
let oracleLegalityResolver: OracleLegalityResolver | null = null;

/** Register a listener that runs when a real legality result arrives. Returns the unsubscribe function. */
export function subscribeOracleLegality(listener: () => void): () => void {
  oracleLegalListeners.add(listener);
  return () => {
    oracleLegalListeners.delete(listener);
  };
}

const oracleKey = (name: string, legalityKey: string) => `${legalityKey}::${loweredLabel(name)}`;

/** Seed the cache without calling the resolver. Useful in tests and for preloaded data. */
export function seedOracleLegality(
  name: string,
  legalityKey: string,
  isLegal: boolean,
  setCode?: string,
): void {
  const hit: OracleLegalityHit = { legal: isLegal };
  if (setCode !== undefined) hit.setCode = setCode;
  oracleLegalCache.set(oracleKey(name, legalityKey), hit);
}

/** Replace the legality lookup. Pass null to clear it and rely on each printing's own legality. */
export function setOracleLegalityResolver(fn: OracleLegalityResolver | null): void {
  oracleLegalityResolver = fn;
}

/** Drop cached lookups and in-flight keys. Does not remove the registered resolver. */
export function clearOracleLegalityCache(): void {
  oracleLegalCache.clear();
  oracleLegalInFlight.clear();
}

function notifyOracleListeners(): void {
  oracleLegalListeners.forEach(listener => listener());
}

function primeOracleLegality(name: string, legalityKey: string): void {
  const key = oracleKey(name, legalityKey);
  if (oracleLegalCache.has(key) || oracleLegalInFlight.has(key)) return;
  const resolver = oracleLegalityResolver;
  if (!resolver) return;
  oracleLegalInFlight.add(key);
  resolver(name, legalityKey)
    .then(result => {
      const hit: OracleLegalityHit = { legal: Boolean(result?.legal) };
      if (result?.setCode) hit.setCode = result.setCode;
      oracleLegalCache.set(key, hit);
      notifyOracleListeners();
    })
    .catch(() => {
      oracleLegalCache.set(key, { legal: false });
      notifyOracleListeners();
    })
    .finally(() => {
      oracleLegalInFlight.delete(key);
    });
}

/**
 * Whether some printing of this name is legal in the format.
 * `null` means the lookup is still running.
 * Without a resolver, returns a negative hit so the printing's own legality decides.
 */
function hasLegalReprint(name: string, legalityKey: string): OracleLegalityHit | null {
  const cached = oracleLegalCache.get(oracleKey(name, legalityKey));
  if (cached) return cached;
  if (!oracleLegalityResolver) return { legal: false };
  primeOracleLegality(name, legalityKey);
  return null;
}

const COLOR_NAMES: Record<string, string> = {
  W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green',
};

export function validateDeck(rawCards: DeckCard[], rawFormat: MtgFormat): ValidationResult {
  const format = normalizeFormat(rawFormat);
  const rules = FORMAT_RULES[format];
  const errors: string[] = [];
  const warnings: string[] = [];
  const cards = sanitizeDeckCards(rawCards);

  const commanderCards = cards.filter(entry => entry.is_commander);
  const sideboard = cards.filter(entry => entry.is_sideboard);
  const mainboard = cards.filter(entry => !entry.is_sideboard);

  const totalMain = mainboard.reduce((sum, entry) => sum + entry.quantity, 0);
  const sideboardTotal = sideboard.reduce((sum, entry) => sum + entry.quantity, 0);

  if (totalMain < rules.minCards) {
    errors.push(`Deck has ${totalMain} cards; the minimum for ${format} is ${rules.minCards}.`);
  }

  if (rules.maxCards !== null && totalMain > rules.maxCards) {
    errors.push(`Deck has ${totalMain} cards; the maximum for ${format} is ${rules.maxCards}.`);
  }

  if (rules.hasSideboard && sideboardTotal > rules.sideboardMax) {
    errors.push(`Sideboard has ${sideboardTotal} cards; the maximum is ${rules.sideboardMax}.`);
  }

  if (!rules.hasSideboard && sideboardTotal > 0) {
    errors.push('This format does not allow a sideboard.');
  }

  const copyCounts = new Map<string, { quantity: number; card: Card }>();
  for (const entry of mainboard) {
    const key = loweredLabel(entry.card.name);
    const current = copyCounts.get(key);
    copyCounts.set(key, {
      quantity: (current?.quantity || 0) + entry.quantity,
      card: entry.card,
    });
  }

  const legalityKeys = COMPOSITE_FORMAT_LEGALITIES[format] ?? [format];

  // If at least 90% of nonbasic cards have no legality value for a key, that
  // field is missing from the catalog. Do not mark the whole deck illegal.
  const missingKeyFor = new Set<string>();
  {
    const nonBasics = [...copyCounts.values()].filter(({ card }) => !isBasicLand(card));
    if (nonBasics.length >= 5) {
      for (const key of legalityKeys) {
        const absent = nonBasics.filter(({ card }) => resolveLegality(card.legalities, key) === undefined).length;
        if (absent / nonBasics.length >= 0.9) {
          missingKeyFor.add(key);
          warnings.push(`No legality data for ${key} in the catalog; card-by-card legality could not be verified.`);
        }
      }
    }
  }

  for (const { quantity, card } of copyCounts.values()) {
    if (isBasicLand(card)) continue;

    for (const key of legalityKeys) {
      if (missingKeyFor.has(key)) continue;
      const legality = resolveLegality(card.legalities, key);
      const isStrictFormat = STRICT_LEGALITY_FORMATS.has(key);
      const hasLegalityData = Object.keys(card.legalities).length > 0;

      if (isStrictFormat && hasLegalityData && legality !== 'legal' && legality !== 'restricted') {
        // A rotated printing does not make the card illegal when another printing
        // of the same name is legal. Banned cards are banned on every printing.
        if (legality !== 'banned') {
          const reprint = hasLegalReprint(card.name, key);
          if (reprint?.legal) {
            const currentSet = String(card.set_code || '').toUpperCase();
            const legalSet = (reprint.setCode || '').toUpperCase();
            if (legalSet && currentSet && legalSet !== currentSet) {
              warnings.push(`${card.name}: use the ${legalSet} printing (the one you have, ${currentSet}, is not legal in ${key}).`);
            } else if (legalSet) {
              warnings.push(`${card.name}: use the ${legalSet} printing, which is legal in ${key}.`);
            }
            continue;
          }
          if (reprint === null) {
            errors.push(`${card.name}: checking legality in ${key}…`);
            continue;
          }
        }
        errors.push(legality === 'banned'
          ? `${card.name} is banned in ${key}.`
          : `${card.name} is not legal in ${key}.`);
        continue;
      }

      if (legality === 'not_legal') {
        const anyLegal = Object.values(card.legalities).some(value => value === 'legal');
        if (anyLegal) continue;
        errors.push(`${card.name} is not legal in ${key}.`);
      } else if (legality === 'banned') {
        errors.push(`${card.name} is banned in ${key}.`);
      } else if (legality === 'restricted' && quantity > 1) {
        errors.push(`${card.name} is restricted to 1 copy in ${key}.`);
      }
    }

    if (format === 'pauper_standard' && card.rarity !== 'common') {
      errors.push(`${card.name} is not a common (Pauper Standard only allows commons).`);
    }

    if (quantity > rules.maxCopies) {
      errors.push(`${card.name} exceeds the copy limit (${quantity}/${rules.maxCopies}).`);
    }

    if (format === 'duel_commander' && isBannedInDuelDeck(card.name)) {
      errors.push(`${card.name} is banned in Duel Commander (banlist).`);
    }
  }

  if (rules.hasCommander) {
    if (commanderCards.length !== 1) {
      errors.push(`This format requires exactly 1 commander; there are currently ${commanderCards.length}.`);
    }

    const commander = commanderCards[0]?.card;
    if (commander) {
      const commanderType = loweredLabel(commander.type_line);
      const oracleText = loweredLabel(commander.oracle_text);
      const brawlFamily = format === 'brawl' || format === 'competitive_brawl' || format === 'standard_brawl';
      const canBeCommander = (commanderType.includes('legendary') && commanderType.includes('creature'))
        || (brawlFamily && commanderType.includes('legendary') && commanderType.includes('planeswalker'))
        || oracleText.includes('can be your commander');

      if (!canBeCommander) {
        errors.push(`${commander.name} does not meet the usual requirements to be a commander.`);
      }

      if (format === 'duel_commander' && isBannedAsDuelCommander(commander.name)) {
        errors.push(`${commander.name} cannot be your commander in Duel Commander (banlist).`);
      }

      const commanderIdentity = new Set(commander.color_identity);
      if (commanderIdentity.size > 0) {
        for (const entry of mainboard) {
          if (entry.is_commander) continue;
          if (isBasicLand(entry.card)) continue;

          const mappedIdentity = KNOWN_LAND_COLORS[entry.card.name.toLowerCase()];
          const cardColorIdentity = mappedIdentity ?? entry.card.color_identity;
          if (cardColorIdentity.length === 0) continue;

          const hasOffColor = cardColorIdentity.some(color => !commanderIdentity.has(color));
          if (hasOffColor) {
            errors.push(`${entry.card.name} contains colors outside the commander's color identity (${[...commanderIdentity].join('')}).`);
          }
        }
      }
    }
  }

  if (!rules.hasCommander) {
    for (const { name, color } of findUnproducibleColorCards(mainboard)) {
      const colorName = COLOR_NAMES[color] || color;
      errors.push(`${name} requires {${color}} but the deck has no lands that produce ${colorName}.`);
    }
  }

  const landCount = mainboard
    .filter(entry => entry.card.type_line.includes('Land'))
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const landRatio = totalMain > 0 ? landCount / totalMain : 0;
  if (landRatio < 0.3) warnings.push('Few lands: you may need more mana sources.');
  if (landRatio > 0.45) warnings.push('Many lands: you may be able to turn some into spells.');

  return { valid: errors.length === 0, errors, warnings };
}
