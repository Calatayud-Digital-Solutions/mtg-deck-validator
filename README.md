# mtg-deck-validator

Validate Magic: The Gathering decklists for constructed, Commander, Brawl, and Duel Commander.

The validator checks deck size, sideboard size, copy limits, commander count and eligibility, color identity (including known Arena dual lands whose stored identity is empty), basic-land exceptions, Pauper Standard rarity, Scryfall-style legality, and the Duel Commander banlist. It does not score decks or suggest cards.

This package is not affiliated with, endorsed, or sponsored by Wizards of the Coast. Card legality objects use the [Scryfall](https://scryfall.com/docs/api/cards) format: `legal`, `not_legal`, `banned`, and `restricted`.

Duel Commander bans follow the list published at [duelcommander.org](https://www.duelcommander.org/banlist/) (last synced 2026-01-26).

## Install

```bash
npm install mtg-deck-validator
```

Requires Node.js 18 or newer. The package has no runtime dependencies.

## Usage

```ts
import { validateDeck, setOracleLegalityResolver } from 'mtg-deck-validator';
import type { DeckCard } from 'mtg-deck-validator';

const cards: DeckCard[] = [
  {
    quantity: 1,
    is_commander: true,
    card: {
      name: 'Llanowar Elves',
      type_line: 'Legendary Creature — Elf',
      oracle_text: '',
      colors: ['G'],
      color_identity: ['G'],
      cmc: 1,
      mana_cost: '{G}',
      legalities: { commander: 'legal' },
      rarity: 'common',
    },
  },
];

const result = validateDeck(cards, 'commander');
result.valid;
result.errors;
result.warnings;

// Optional. When a printing is not legal in a rotating format, the validator
// asks whether another printing of the same name is legal.
setOracleLegalityResolver(async (name, legalityKey) => {
  return { legal: false };
});
```

Passing `null` to `setOracleLegalityResolver` clears the lookup. With no resolver, a rotating format uses the printing's own legality and does not report "checking legality…".

## API

### `validateDeck(cards, format): ValidationResult`

`format` accepts a `MtgFormat` and also tolerates wrapped or oddly cased values (`"Standard Brawl"`, `{ format: "commander" }`). Unknown values are treated as `standard`.

`ValidationResult` is `{ valid, errors, warnings }`.

### `FORMAT_RULES`

Minimum size, maximum size, copy limit, sideboard, and commander flag for `standard`, `pauper`, `pauper_standard`, `commander`, `duel_commander`, `brawl`, `competitive_brawl`, and `standard_brawl`.

### `normalizeFormat(format): MtgFormat`

### `resolveLegality(legalities, key): string | undefined`

Reads a Scryfall legality object, including aliases such as `standardbrawl` for `standard_brawl`.

### `findUnproducibleColorCards(mainboard)`

Returns `{ name, color }` for spells whose mana symbols are not produced by the deck's lands. Returns nothing when land data is incomplete.

### `KNOWN_LAND_COLORS`

Lowercase land name to the colors that land produces, used when `color_identity` is missing.

### `setOracleLegalityResolver(fn | null)`

### `seedOracleLegality(name, legalityKey, isLegal, setCode?)`

### `subscribeOracleLegality(listener): () => void`

### `clearOracleLegalityCache()`

### `isBannedInDuelDeck(cardName): boolean`

### `isBannedAsDuelCommander(cardName): boolean`

`DUEL_COMMANDER_BANNED_IN_DECK`, `DUEL_COMMANDER_BANNED_AS_COMMANDER`, and `DUEL_COMMANDER_BANNED_AS_COMPANION` are the normalized name sets behind those checks.

### Types

`Card`, `DeckCard`, `MtgFormat`, `ValidationResult`, `FormatRules`, `OracleLegalityHit`, and `OracleLegalityResolver`.

`Card` carries `name`, `type_line`, `oracle_text`, `colors`, `color_identity`, `cmc`, `mana_cost`, `legalities`, `rarity`, and `set_code`.

Used in production by [ManaForge](https://manaforge.tools) — Built by [Calatayud Digital Solutions](https://calatayud-digital-solutions.es)
