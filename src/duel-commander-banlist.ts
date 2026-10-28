// Duel Commander banlist (source: https://www.duelcommander.org/banlist/)
// Last updated: 2026-01-26
// TODO: review this list after the 2026-11-30 banlist update.
// Rules match Commander, with this stricter banlist.

const norm = (name: string) => name.toLowerCase().trim();

// Banned in the deck. These cards cannot appear anywhere in the list.
export const DUEL_COMMANDER_BANNED_IN_DECK = new Set<string>([
  'Ancestral Recall', 'Ancient Tomb', 'Back to Basics', 'Balance', 'Bazaar of Baghdad',
  'Black Lotus', 'Blood Moon', 'Capture of Jingzhou', 'Cavern of Souls', 'Channel',
  'Chrome Mox', 'Comet, Stellar Pup', 'Dark Ritual', 'Deadly Rollick', 'Deflecting Swat',
  'Dig Through Time', 'Emrakul, the Aeons Torn', 'Entomb', 'Fastbond', 'Field of the Dead',
  'Fierce Guardianship', 'Flawless Maneuver', 'Food Chain', 'Force of Will', "Gaea's Cradle",
  'Genesis Storm', 'Gifts Ungiven', 'Grim Monolith', 'Hermit Druid', 'Humility',
  'Imperial Seal', 'Invert Polarity', 'Jeweled Lotus', 'Karakas', 'Library of Alexandria',
  "Lion's Eye Diamond", 'Lotus Petal', 'Maddening Hex', 'Mana Crypt', 'Mana Drain',
  'Mana Vault', "Mishra's Workshop", 'Mox Amber', 'Mox Diamond', 'Mox Emerald', 'Mox Jet',
  'Mox Opal', 'Mox Pearl', 'Mox Ruby', 'Mox Sapphire', 'Mystical Tutor', 'Nadu, Winged Wisdom',
  'Natural Order', 'Oath of Druids', 'Price of Progress', 'Protean Hulk', 'Ragavan, Nimble Pilferer',
  'Rain of Filth', 'Reanimate', 'Scapeshift', "Sensei's Divining Top", "Serra's Sanctum",
  'Sol Ring', 'Strip Mine', 'Temporal Manipulation', "Thassa's Oracle", 'The One Ring',
  'The Tabernacle at Pendrell Vale', 'Time Vault', 'Time Walk', 'Time Warp', 'Timetwister',
  'Tinker', 'Tolarian Academy', 'Treasure Cruise', 'Underworld Breach', "Uro, Titan of Nature's Wrath",
  'Vampiric Tutor', 'Wasteland', 'White Plume Adventurer',
  // Offensive content
  'Cleanse', 'Crusade', 'Imprison', 'Invoke Prejudice', 'Jihad', 'Pradesh Gypsies', 'Stone-Throwing Devils',
].map(norm));

// Banned as commander only. These cards can sit in the 99, but not in the command zone.
export const DUEL_COMMANDER_BANNED_AS_COMMANDER = new Set<string>([
  'Ajani, Nacatl Pariah', 'Arahbo, Roar of the World', 'Derevi, Empyrial Tactician',
  'Dihada, Binder of Wills', 'Edgar Markov', 'Edric, Spymaster of Trest',
  'Emry, Lurker of the Loch', 'Eris, Roar of the Storm', 'Ezio Auditore da Firenze',
  'Geist of Saint Traft', 'Hogaak, Arisen Necropolis', 'Inalla, Archmage Ritualist',
  'Krark, the Thumbless', 'Minsc & Boo, Timeless Heroes', 'Najeela, the Blade-Blossom',
  'Old Stickfingers', 'Oloro, Ageless Ascetic', 'Omnath, Locus of Creation',
  'Prime Speaker Vannifar', 'Raffine, Scheming Seer', 'Rograkh, Son of Rohgahh',
  'Shorikai, Genesis Engine', 'Tamiyo, Inquisitive Student', 'Urza, Lord High Artificer',
  'Vial Smasher the Fierce', 'Winota, Joiner of Forces', "Yuriko, the Tiger's Shadow",
].map(norm));

// Banned as companion.
export const DUEL_COMMANDER_BANNED_AS_COMPANION = new Set<string>([
  'Lutri, the Spellchaser',
].map(norm));

export function isBannedInDuelDeck(cardName: string): boolean {
  return DUEL_COMMANDER_BANNED_IN_DECK.has(norm(cardName));
}

export function isBannedAsDuelCommander(cardName: string): boolean {
  return DUEL_COMMANDER_BANNED_AS_COMMANDER.has(norm(cardName));
}
