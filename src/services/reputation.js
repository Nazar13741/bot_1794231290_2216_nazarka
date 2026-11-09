// Репутация: по фракциям или один общий счётчик (reputation.mode).
const db = require('../core/database');
const { config } = require('../core/config');

const R = config.reputation;

function factions() {
    return R.mode === 'global' ? [{ key: 'global', name: 'Общая репутация' }] : R.factions;
}

function rank(value) { return R.ranks.find((r) => value >= r.min) || R.ranks[R.ranks.length - 1]; }

/** [{ faction, value, rank }] */
function list(characterId) {
    const rows = db.all('SELECT faction, value FROM reputation WHERE character_id = ?', characterId);
    const map = Object.fromEntries(rows.map((r) => [r.faction, r.value]));
    return factions().map((f) => ({ faction: f, value: map[f.key] ?? 0, rank: rank(map[f.key] ?? 0) }));
}

function set(characterId, factionKey, value) {
    const before = db.get('SELECT value FROM reputation WHERE character_id = ? AND faction = ?', characterId, factionKey)?.value ?? 0;
    const after = Math.max(R.min, Math.min(R.max, value));
    db.run(`INSERT INTO reputation (character_id, faction, value) VALUES (?, ?, ?)
            ON CONFLICT(character_id, faction) DO UPDATE SET value = excluded.value`, characterId, factionKey, after);
    return { before, after };
}

module.exports = { factions, rank, list, set };
