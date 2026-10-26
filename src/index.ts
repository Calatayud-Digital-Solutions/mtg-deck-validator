export {
  FORMAT_RULES,
  KNOWN_LAND_COLORS,
  normalizeFormat,
  resolveLegality,
  findUnproducibleColorCards,
  validateDeck,
  setOracleLegalityResolver,
  seedOracleLegality,
  subscribeOracleLegality,
  clearOracleLegalityCache,
} from './validator';

export {
  DUEL_COMMANDER_BANNED_IN_DECK,
  DUEL_COMMANDER_BANNED_AS_COMMANDER,
  DUEL_COMMANDER_BANNED_AS_COMPANION,
  isBannedInDuelDeck,
  isBannedAsDuelCommander,
} from './duel-commander-banlist';

export type {
  Card,
  DeckCard,
  FormatRules,
  MtgFormat,
  OracleLegalityHit,
  OracleLegalityResolver,
  ValidationResult,
} from './types';
