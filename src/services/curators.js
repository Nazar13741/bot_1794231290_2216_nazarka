// Кураторы анкет, назначенные администрацией через /curator (хранятся в базе).
const db = require('../core/database');

function has(guildId, userId) {
    return !!db.get('SELECT 1 FROM curators WHERE guild_id = ? AND user_id = ?', guildId, userId);
}

/** true - назначен, false - уже был куратором */
function add(guildId, userId, addedBy) {
    const r = db.run('INSERT OR IGNORE INTO curators (guild_id, user_id, added_by, added_at) VALUES (?, ?, ?, ?)', guildId, userId, addedBy, Date.now());
    return r.changes > 0;
}

/** true - снят, false - не был куратором */
function remove(guildId, userId) {
    return db.run('DELETE FROM curators WHERE guild_id = ? AND user_id = ?', guildId, userId).changes > 0;
}

function list(guildId) {
    return db.all('SELECT user_id, added_by, added_at FROM curators WHERE guild_id = ? ORDER BY added_at', guildId);
}

module.exports = { has, add, remove, list };
