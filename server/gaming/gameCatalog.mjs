/**
 * Gaming Zone starter catalog: the games AUST students play most, each with
 * one permanent Lounge room. Seeded at boot, idempotent: rows that already
 * exist (matched by slug / fixed id) are left untouched, so admin edits to a
 * game made later are never overwritten.
 */

export const GAME_CATALOG = [
  {
    slug: 'valorant', name: 'Valorant', genre: 'Tactical shooter', platforms: ['PC'],
    iconKey: 'crosshair', maxSquad: 5,
    ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'],
  },
  {
    slug: 'cs2', name: 'Counter-Strike 2', genre: 'Tactical shooter', platforms: ['PC'],
    iconKey: 'target', maxSquad: 5,
    ranks: ['Silver', 'Gold Nova', 'Master Guardian', 'Legendary Eagle', 'Supreme', 'Global Elite'],
  },
  {
    slug: 'pubg-mobile', name: 'PUBG Mobile', genre: 'Battle royale', platforms: ['Mobile'],
    iconKey: 'crosshair', maxSquad: 4,
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown', 'Ace', 'Conqueror'],
  },
  {
    slug: 'free-fire', name: 'Free Fire', genre: 'Battle royale', platforms: ['Mobile'],
    iconKey: 'flame', maxSquad: 4,
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Grandmaster'],
  },
  {
    slug: 'mlbb', name: 'Mobile Legends', genre: 'MOBA', platforms: ['Mobile'],
    iconKey: 'swords', maxSquad: 5,
    ranks: ['Warrior', 'Elite', 'Master', 'Grandmaster', 'Epic', 'Legend', 'Mythic'],
  },
  {
    slug: 'dota2', name: 'Dota 2', genre: 'MOBA', platforms: ['PC'],
    iconKey: 'swords', maxSquad: 5,
    ranks: ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'],
  },
  {
    slug: 'efootball', name: 'eFootball / FC', genre: 'Football', platforms: ['PC', 'Console', 'Mobile'],
    iconKey: 'trophy', maxSquad: 2,
    ranks: ['Division 10', 'Division 8', 'Division 6', 'Division 4', 'Division 2', 'Division 1'],
  },
  {
    slug: 'chess', name: 'Chess', genre: 'Board', platforms: ['PC', 'Mobile'],
    iconKey: 'crown', maxSquad: 2,
    ranks: ['Under 1000', '1000–1400', '1400–1800', '1800–2200', '2200+'],
  },
  {
    slug: 'minecraft', name: 'Minecraft', genre: 'Sandbox', platforms: ['PC', 'Mobile', 'Console'],
    iconKey: 'pickaxe', maxSquad: 10, ranks: [],
  },
  {
    slug: 'among-us', name: 'Among Us', genre: 'Party', platforms: ['PC', 'Mobile'],
    iconKey: 'rocket', maxSquad: 15, ranks: [],
  },
  {
    slug: 'ludo', name: 'Ludo', genre: 'Board', platforms: ['Mobile'],
    iconKey: 'dice', maxSquad: 4, ranks: [],
  },
  {
    slug: 'other', name: 'Other games', genre: 'Anything else', platforms: ['PC', 'Mobile', 'Console'],
    iconKey: 'gamepad', maxSquad: 10, ranks: [],
  },
];

export const gameIdFor = (slug) => `game-${slug}`;
export const loungeIdFor = (slug) => `lounge-${slug}`;

/** Lounges are permanent, owner-less, public rooms with a generous cap. */
export const LOUNGE_CAPACITY = 500;

/**
 * Insert any missing catalog games and their lounges.
 * @param {(sql: string, params?: object) => Promise<unknown>} query db.mjs query()
 */
export async function ensureGamingSeed(query) {
  for (const [index, game] of GAME_CATALOG.entries()) {
    await query(
      `INSERT INTO "Game" ("id", "slug", "name", "genre", "platforms", "iconKey", "maxSquad", "ranks", "sortOrder")
       VALUES (@id, @slug, @name, @genre, @platforms, @iconKey, @maxSquad, @ranks, @sortOrder)
       ON CONFLICT ("slug") DO NOTHING`,
      {
        id: gameIdFor(game.slug),
        slug: game.slug,
        name: game.name,
        genre: game.genre,
        platforms: { type: 'text[]', value: game.platforms },
        iconKey: game.iconKey,
        maxSquad: { type: 'int', value: game.maxSquad },
        ranks: { type: 'text[]', value: game.ranks },
        sortOrder: { type: 'int', value: index * 10 },
      },
    );
    // The lounge points at whatever id the game row has (an admin may have
    // created the slug first with a different id).
    await query(
      `INSERT INTO "GameRoom" ("id", "gameId", "type", "title", "description", "capacity")
       SELECT @loungeId, g."id", 'lounge', @title, @description, @capacity
       FROM "Game" g WHERE g."slug" = @slug
       ON CONFLICT ("id") DO NOTHING`,
      {
        loungeId: loungeIdFor(game.slug),
        slug: game.slug,
        title: `${game.name} Lounge`,
        description: `Hang out, find a squad and talk ${game.name}.`,
        capacity: { type: 'int', value: LOUNGE_CAPACITY },
      },
    );
  }
}
