// Персонажи: создание, поиск, изменение и здоровье.
const db = require('../core/database');
const { config } = require('../core/config');

const S = config.stats;

function hydrate(row) {
    if (!row) return null;
    const raw = JSON.parse(row.stats || '{}');
    const stats = {};
    for (const s of S.list) stats[s.key] = Number.isInteger(raw[s.key]) ? raw[s.key] : S.base;
    return { ...row, stats, is_active: !!row.is_active };
}

const findIn = (list, name) => list.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
const findRace = (name) => findIn(config.characters.races, name);
const findClass = (name) => findIn(config.characters.classes, name);

/** Стартовые характеристики = база + бонусы расы и класса (если заданы в конфиге).
 *  Верхнего предела нет. Очков при создании не выдаётся - значения меняют только админы и кураторы через /char redact. */
function startingStats(race, cls) {
    const stats = Object.fromEntries(S.list.map((s) => [s.key, S.base]));
    for (const src of [findRace(race), findClass(cls)]) {
        for (const [k, v] of Object.entries(src?.bonuses || {})) if (k in stats) stats[k] += v;
    }
    return stats;
}

function create({ guildId, userId, name, race, cls, age, description, appearance }) {
    const now = Date.now();
    return db.transaction(() => {
        const hasActive = db.get('SELECT 1 FROM characters WHERE guild_id = ? AND user_id = ? AND is_active = 1', guildId, userId);
        const r = db.run(
            `INSERT INTO characters (guild_id, user_id, name, race, class, age, description, appearance, stats,
             free_points, sanity, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            guildId, userId, name, race, cls, age, description, appearance,
            JSON.stringify(startingStats(race, cls)), 0, config.sanity.start, hasActive ? 0 : 1, now, now,
        );
        return getById(Number(r.lastInsertRowid));
    });
}

function getById(id) { return hydrate(db.get('SELECT * FROM characters WHERE id = ?', Number(id))); }

function listByUser(guildId, userId) {
    return db.all('SELECT * FROM characters WHERE guild_id = ? AND user_id = ? ORDER BY id', guildId, userId).map(hydrate);
}

function getActive(guildId, userId) {
    return hydrate(db.get('SELECT * FROM characters WHERE guild_id = ? AND user_id = ? AND is_active = 1', guildId, userId))
        || listByUser(guildId, userId)[0] || null;
}

function setActive(character) {
    db.transaction(() => {
        db.run('UPDATE characters SET is_active = 0 WHERE guild_id = ? AND user_id = ?', character.guild_id, character.user_id);
        db.run('UPDATE characters SET is_active = 1 WHERE id = ?', character.id);
    });
}

const EDITABLE = ['user_id', 'name', 'race', 'class', 'age', 'description', 'appearance', 'avatar_file',
    'stats', 'free_points', 'level', 'xp', 'sanity', 'madness', 'madness_until', 'is_active'];

function update(id, fields) {
    const keys = Object.keys(fields).filter((k) => EDITABLE.includes(k));
    if (!keys.length) return getById(id);
    const values = keys.map((k) => (k === 'stats' ? JSON.stringify(fields[k]) : fields[k]));
    db.run(`UPDATE characters SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...values, Date.now(), Number(id));
    return getById(id);
}

function remove(character) {
    db.transaction(() => {
        db.run('DELETE FROM characters WHERE id = ?', character.id);
        if (character.is_active) {
            const next = db.get('SELECT id FROM characters WHERE guild_id = ? AND user_id = ? ORDER BY id LIMIT 1', character.guild_id, character.user_id);
            if (next) db.run('UPDATE characters SET is_active = 1 WHERE id = ?', next.id);
        }
    });
}

/** Поиск для автодополнения по имени или ID */
function search(guildId, query, { userId } = {}) {
    const q = `%${String(query || '').trim()}%`;
    const idq = Number(query) || -1;
    const sql = `SELECT * FROM characters WHERE guild_id = ? ${userId ? 'AND user_id = ?' : ''}
                 AND (name LIKE ? OR id = ?) ORDER BY is_active DESC, updated_at DESC LIMIT 25`;
    const params = userId ? [guildId, userId, q, idq] : [guildId, q, idq];
    return db.all(sql, ...params).map(hydrate);
}

function maxHp(ch) {
    const con = ch.stats.con ?? S.base;
    return config.hp.base + con * config.hp.perCon + (ch.level - 1) * config.hp.perLevel;
}

/** Предел характеристики отсутствует (ТЗ: «хар-ки неограниченные») */
function statCap() { return null; }

module.exports = {
    create, getById, listByUser, getActive, setActive, update, remove, search,
    findRace, findClass, startingStats, maxHp, statCap,
};
