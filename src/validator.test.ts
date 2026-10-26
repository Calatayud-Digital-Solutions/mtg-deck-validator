import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FORMAT_RULES,
  clearOracleLegalityCache,
  findUnproducibleColorCards,
  isBannedAsDuelCommander,
  isBannedInDuelDeck,
  normalizeFormat,
  resolveLegality,
  seedOracleLegality,
  setOracleLegalityResolver,
  subscribeOracleLegality,
  validateDeck,
  type Card,
  type DeckCard,
} from './index';

const LEGAL: Record<string, string> = {
  commander: 'legal',
  duel_commander: 'legal',
  standard: 'legal',
  pauper: 'legal',
};

function card(overrides: Partial<Card> & { name: string }): Card {
  return {
    type_line: 'Creature — Elf',
    oracle_text: '',
    colors: ['G'],
    color_identity: ['G'],
    cmc: 1,
    mana_cost: '{G}',
    legalities: { ...LEGAL },
    rarity: 'common',
    set_code: 'tst',
    ...overrides,
  };
}

function commanderDeck(): DeckCard[] {
  const commander: DeckCard = {
    quantity: 1,
    is_commander: true,
    card: card({
      name: 'Test Commander',
      type_line: 'Legendary Creature — Elf',
      mana_cost: '{G}{G}',
      cmc: 2,
    }),
  };
  const spells: DeckCard[] = Array.from({ length: 62 }, (_, index) => ({
    quantity: 1,
    card: card({ name: `Spell ${index}` }),
  }));
  const forests: DeckCard = {
    quantity: 37,
    card: card({
      name: 'Forest',
      type_line: 'Basic Land — Forest',
      mana_cost: '',
      cmc: 0,
      colors: [],
      color_identity: ['G'],
      oracle_text: '{T}: Add {G}.',
    }),
  };
  return [commander, ...spells, forests];
}

function replace(deck: DeckCard[], name: string, next: Partial<DeckCard> & { card?: Partial<Card> & { name?: string } }): DeckCard {
  const entry = deck.find(candidate => candidate.card.name === name);
  if (!entry) throw new Error(`Missing ${name}`);
  if (next.card) entry.card = card({ ...entry.card, ...next.card, name: next.card.name ?? entry.card.name });
  if (next.quantity !== undefined) entry.quantity = next.quantity;
  if (next.is_commander !== undefined) entry.is_commander = next.is_commander;
  if (next.is_sideboard !== undefined) entry.is_sideboard = next.is_sideboard;
  return entry;
}

function standardDeck(boltCopies: number): DeckCard[] {
  const cards: DeckCard[] = [
    {
      quantity: boltCopies,
      card: card({
        name: 'Lightning Bolt',
        type_line: 'Instant',
        mana_cost: '{R}',
        colors: ['R'],
        color_identity: ['R'],
        legalities: { standard: 'legal' },
      }),
    },
    {
      quantity: 24,
      card: card({
        name: 'Mountain',
        type_line: 'Basic Land — Mountain',
        mana_cost: '',
        cmc: 0,
        colors: [],
        color_identity: ['R'],
        oracle_text: '{T}: Add {R}.',
        legalities: { standard: 'legal' },
      }),
    },
  ];
  let remaining = 60 - 24 - boltCopies;
  let index = 0;
  while (remaining > 0) {
    const quantity = Math.min(4, remaining);
    cards.push({
      quantity,
      card: card({
        name: `Red ${index}`,
        mana_cost: '{R}',
        colors: ['R'],
        color_identity: ['R'],
        legalities: { standard: 'legal' },
      }),
    });
    remaining -= quantity;
    index += 1;
  }
  return cards;
}

function demolitionDeck(): DeckCard[] {
  const cards: DeckCard[] = [
    {
      quantity: 1,
      card: card({
        name: 'Demolition Field',
        type_line: 'Land',
        oracle_text: '',
        colors: [],
        color_identity: [],
        cmc: 0,
        mana_cost: '',
        legalities: { standard: 'not_legal' },
        rarity: 'rare',
        set_code: 'bro',
      }),
    },
    {
      quantity: 23,
      card: card({
        name: 'Forest',
        type_line: 'Basic Land — Forest',
        mana_cost: '',
        cmc: 0,
        colors: [],
        color_identity: ['G'],
        oracle_text: '{T}: Add {G}.',
        legalities: { standard: 'legal' },
      }),
    },
  ];
  for (let index = 0; index < 9; index += 1) {
    cards.push({
      quantity: 4,
      card: card({ name: `Elf ${index}`, legalities: { standard: 'legal' } }),
    });
  }
  return cards;
}

beforeEach(() => {
  clearOracleLegalityCache();
  setOracleLegalityResolver(null);
});

describe('commander eligibility and size', () => {
  it('rejects a deck with zero commanders', () => {
    const deck = commanderDeck();
    deck[0].is_commander = false;

    const result = validateDeck(deck, 'commander');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('This format requires exactly 1 commander; there are currently 0.');
  });

  it('rejects a deck with two commanders', () => {
    const deck = commanderDeck();
    replace(deck, 'Spell 0', {
      is_commander: true,
      card: { name: 'Second Commander', type_line: 'Legendary Creature — Elf' },
    });

    const result = validateDeck(deck, 'commander');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('This format requires exactly 1 commander; there are currently 2.');
  });

  it('rejects a commander that is not legendary', () => {
    const deck = commanderDeck();
    replace(deck, 'Test Commander', { card: { type_line: 'Creature — Elf' } });

    const result = validateDeck(deck, 'commander');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Test Commander does not meet the usual requirements to be a commander.');
  });

  it('accepts exactly one legendary commander in a 100-card deck', () => {
    const result = validateDeck(commanderDeck(), 'commander');

    expect(FORMAT_RULES.commander).toMatchObject({ minCards: 100, maxCards: 100, maxCopies: 1 });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts a non-legendary card that can be your commander', () => {
    const deck = commanderDeck();
    replace(deck, 'Test Commander', {
      card: { type_line: 'Creature — Elf', oracle_text: 'This card can be your commander.' },
    });

    const result = validateDeck(deck, 'commander');

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects a 99-card commander deck', () => {
    const deck = commanderDeck();
    replace(deck, 'Forest', { quantity: 36 });

    const result = validateDeck(deck, 'commander');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Deck has 99 cards; the minimum for commander is 100.');
  });

  it('rejects a 101-card commander deck', () => {
    const deck = commanderDeck();
    replace(deck, 'Forest', { quantity: 38 });

    const result = validateDeck(deck, 'commander');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Deck has 101 cards; the maximum for commander is 100.');
  });
});

describe('copy limits, color identity, and bans', () => {
  it('enforces singleton in commander and the four-copy limit in standard', () => {
    const commander = commanderDeck();
    replace(commander, 'Spell 0', { quantity: 2 });
    replace(commander, 'Forest', { quantity: 36 });
    const commanderResult = validateDeck(commander, 'commander');
    expect(commanderResult.errors).toContain('Spell 0 exceeds the copy limit (2/1).');

    expect(validateDeck(standardDeck(4), 'standard').valid).toBe(true);
    const five = validateDeck(standardDeck(5), 'standard');
    expect(five.valid).toBe(false);
    expect(five.errors).toContain('Lightning Bolt exceeds the copy limit (5/4).');
  });

  it('does not apply legality or copy limits to basic lands', () => {
    const result = validateDeck([
      {
        quantity: 60,
        card: card({
          name: 'Forest',
          type_line: 'Basic Land — Forest',
          mana_cost: '',
          cmc: 0,
          colors: [],
          color_identity: ['G'],
          oracle_text: '{T}: Add {G}.',
          legalities: { standard: 'banned' },
        }),
      },
    ], 'standard');

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('uses known dual-land colors when the stored identity is empty', () => {
    const deck = commanderDeck();
    replace(deck, 'Test Commander', {
      card: { color_identity: ['R', 'G'], colors: ['R', 'G'], mana_cost: '{R}{G}' },
    });
    replace(deck, 'Spell 0', {
      card: {
        name: 'Jagged Barrens',
        type_line: 'Land',
        oracle_text: '',
        colors: [],
        color_identity: [],
        cmc: 0,
        mana_cost: '',
      },
    });
    replace(deck, 'Spell 1', {
      card: {
        name: 'Rugged Highlands',
        type_line: 'Land',
        oracle_text: '',
        colors: [],
        color_identity: [],
        cmc: 0,
        mana_cost: '',
      },
    });

    const result = validateDeck(deck, 'commander');

    expect(result.errors).toContain('Jagged Barrens contains colors outside the commander\'s color identity (RG).');
    expect(result.errors.some(error => error.includes('Rugged Highlands'))).toBe(false);
  });

  it('reports banned cards and restricted cards above one copy', () => {
    const banned = commanderDeck();
    replace(banned, 'Spell 0', {
      card: {
        name: 'Black Lotus',
        type_line: 'Artifact',
        colors: [],
        color_identity: [],
        mana_cost: '{0}',
        legalities: { commander: 'banned' },
      },
    });
    expect(validateDeck(banned, 'commander').errors).toContain('Black Lotus is banned in commander.');

    const restricted = commanderDeck();
    replace(restricted, 'Spell 0', {
      quantity: 2,
      card: { name: 'Channel', legalities: { commander: 'restricted' } },
    });
    replace(restricted, 'Forest', { quantity: 36 });
    const restrictedResult = validateDeck(restricted, 'commander');
    expect(restrictedResult.errors).toContain('Channel is restricted to 1 copy in commander.');

    const oneCopy = commanderDeck();
    replace(oneCopy, 'Spell 0', { card: { name: 'Channel', legalities: { commander: 'restricted' } } });
    expect(validateDeck(oneCopy, 'commander').errors.some(error => error.includes('restricted'))).toBe(false);
    expect(validateDeck(oneCopy, 'commander').valid).toBe(true);
  });

  it('applies the Duel Commander deck banlist', () => {
    expect(isBannedInDuelDeck('Sol Ring')).toBe(true);
    const deck = commanderDeck();
    replace(deck, 'Spell 0', {
      card: {
        name: 'Sol Ring',
        type_line: 'Artifact',
        colors: [],
        color_identity: [],
        mana_cost: '{1}',
        legalities: { ...LEGAL },
      },
    });

    const result = validateDeck(deck, 'duel_commander');

    expect(result.errors).toContain('Sol Ring is banned in Duel Commander (banlist).');
  });

  it('applies the Duel Commander commander banlist and still allows that card in the 99', () => {
    expect(isBannedAsDuelCommander('ajani, nacatl pariah')).toBe(true);

    const asCommander = commanderDeck();
    replace(asCommander, 'Test Commander', { card: { name: 'Ajani, Nacatl Pariah' } });
    expect(validateDeck(asCommander, 'duel_commander').errors)
      .toContain('Ajani, Nacatl Pariah cannot be your commander in Duel Commander (banlist).');

    const inDeck = commanderDeck();
    replace(inDeck, 'Spell 0', { card: { name: 'Ajani, Nacatl Pariah' } });
    const result = validateDeck(inDeck, 'duel_commander');
    expect(result.errors.some(error => error.includes('Ajani, Nacatl Pariah'))).toBe(false);
    expect(result.valid).toBe(true);
  });
});

describe('strict legality, rarity, and mana', () => {
  it('accepts a strict Standard reprint once the resolver confirms it', async () => {
    const updates: string[] = [];
    const unsubscribe = subscribeOracleLegality(() => {
      updates.push('update');
    });
    const resolver = vi.fn(async () => ({ legal: true, setCode: 'fdn' }));
    setOracleLegalityResolver(resolver);

    const pending = validateDeck(demolitionDeck(), 'standard');
    expect(pending.errors).toContain('Demolition Field: checking legality in standard…');

    await vi.waitFor(() => {
      expect(updates.length).toBeGreaterThan(0);
    });

    const settled = validateDeck(demolitionDeck(), 'standard');
    expect(settled.errors).toEqual([]);
    expect(settled.valid).toBe(true);
    expect(settled.warnings).toContain('Demolition Field: use the FDN printing (the one you have, BRO, is not legal in standard).');
    expect(resolver).toHaveBeenCalledWith('Demolition Field', 'standard');
    unsubscribe();
  });

  it('uses the printing legality when no resolver is registered', () => {
    const result = validateDeck(demolitionDeck(), 'standard');

    expect(result.errors).toContain('Demolition Field is not legal in standard.');
    expect(result.errors.some(error => error.includes('checking legality'))).toBe(false);
  });

  it('uses a seeded reprint without asking for a resolver', () => {
    seedOracleLegality('Demolition Field', 'standard', true, 'fdn');

    const result = validateDeck(demolitionDeck(), 'standard');

    expect(result.valid).toBe(true);
    expect(result.warnings.some(warning => warning.includes('FDN'))).toBe(true);
    expect(result.errors.some(error => error.includes('checking legality'))).toBe(false);
  });

  it('requires commons in pauper_standard', () => {
    const rare = standardDeck(4).map(entry => (
      entry.card.name === 'Lightning Bolt'
        ? { ...entry, card: card({ ...entry.card, rarity: 'rare', legalities: { standard: 'legal', pauper: 'legal' } }) }
        : { ...entry, card: card({ ...entry.card, legalities: { standard: 'legal', pauper: 'legal' } }) }
    ));
    const rareResult = validateDeck(rare, 'pauper_standard');
    expect(rareResult.errors).toContain('Lightning Bolt is not a common (Pauper Standard only allows commons).');

    const commons = standardDeck(4).map(entry => ({
      ...entry,
      card: card({ ...entry.card, legalities: { standard: 'legal', pauper: 'legal' } }),
    }));
    expect(validateDeck(commons, 'pauper_standard').valid).toBe(true);
  });

  it('reports a spell whose color the lands cannot produce', () => {
    const deck: DeckCard[] = [
      {
        quantity: 24,
        card: card({
          name: 'Forest',
          type_line: 'Basic Land — Forest',
          mana_cost: '',
          cmc: 0,
          colors: [],
          color_identity: ['G'],
          oracle_text: '{T}: Add {G}.',
          legalities: { standard: 'legal' },
        }),
      },
      {
        quantity: 32,
        card: card({ name: 'Llanowar Elves', legalities: { standard: 'legal' } }),
      },
      {
        quantity: 4,
        card: card({
          name: 'Counterspell',
          type_line: 'Instant',
          mana_cost: '{U}{U}',
          colors: ['U'],
          color_identity: ['U'],
          legalities: { standard: 'legal' },
        }),
      },
    ];

    expect(findUnproducibleColorCards(deck)).toEqual([{ name: 'Counterspell', color: 'U' }]);
    const result = validateDeck(deck, 'standard');
    expect(result.errors).toContain('Counterspell requires {U} but the deck has no lands that produce blue.');
  });

  it('does not mark a deck illegal when 90% of cards have no legality data', () => {
    const deck: DeckCard[] = Array.from({ length: 10 }, (_, index) => ({
      quantity: 1,
      card: card({ name: `Modern ${index}`, legalities: { modern: 'legal' } }),
    }));
    deck.push({
      quantity: 50,
      card: card({
        name: 'Forest',
        type_line: 'Basic Land — Forest',
        mana_cost: '',
        cmc: 0,
        colors: [],
        color_identity: ['G'],
        oracle_text: '{T}: Add {G}.',
        legalities: { standard: 'legal' },
      }),
    });

    const result = validateDeck(deck, 'standard');

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('No legality data for standard in the catalog; card-by-card legality could not be verified.');
  });

  it('still flags illegal cards when fewer than 90% lack legality data', () => {
    const deck: DeckCard[] = [
      ...Array.from({ length: 8 }, (_, index) => ({
        quantity: 1,
        card: card({ name: `Legal ${index}`, legalities: { standard: 'legal' } }),
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        quantity: 1,
        card: card({ name: `Rotated ${index}`, legalities: { modern: 'legal' } }),
      })),
      {
        quantity: 50,
        card: card({
          name: 'Forest',
          type_line: 'Basic Land — Forest',
          mana_cost: '',
          cmc: 0,
          colors: [],
          color_identity: ['G'],
          oracle_text: '{T}: Add {G}.',
          legalities: { standard: 'legal' },
        }),
      },
    ];

    const result = validateDeck(deck, 'standard');

    expect(result.warnings.some(warning => warning.includes('No legality data'))).toBe(false);
    expect(result.errors).toEqual([
      'Rotated 0 is not legal in standard.',
      'Rotated 1 is not legal in standard.',
    ]);
  });
});

describe('normalizeFormat and legality aliases', () => {
  it('normalizes uppercase and spaced format names', () => {
    expect(normalizeFormat('COMMANDER')).toBe('commander');
    expect(normalizeFormat('Standard Brawl')).toBe('standard_brawl');
    expect(normalizeFormat(' Pauper-Standard ')).toBe('pauper_standard');
    expect(normalizeFormat('DUEL COMMANDER')).toBe('duel_commander');
  });

  it('normalizes wrapped format values and falls back to standard', () => {
    expect(normalizeFormat({ format: 'competitive_brawl' })).toBe('competitive_brawl');
    expect(normalizeFormat({ value: 'Duel Commander' })).toBe('duel_commander');
    expect(normalizeFormat({ name: 'BRAWL' })).toBe('brawl');
    expect(normalizeFormat({ nope: true })).toBe('standard');
    expect(normalizeFormat(null)).toBe('standard');
    expect(normalizeFormat(undefined)).toBe('standard');
  });

  it('reads the Scryfall standardbrawl alias', () => {
    expect(resolveLegality({ standardbrawl: 'legal' }, 'standard_brawl')).toBe('legal');
    expect(resolveLegality({ standard: 'not_legal' }, 'standard_brawl')).toBe('not_legal');
    expect(resolveLegality(undefined, 'standard')).toBeUndefined();
  });
});
