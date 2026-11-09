// База данных SQLite (встроена в Node.js 22+, ничего устанавливать не нужно).
// Чтобы изменить структуру базы - ДОБАВЬТЕ новый элемент в MIGRATIONS (старые не трогайте).
const fs = require('node:fs');
const path = require('node:path');
const sqlite = require('node:sqlite');
const { config, ROOT } = require('./config');
const log = require('./logger').child('База');

const MIGRATIONS = [
    // v1 - начальная структура
    `
    CREATE TABLE characters (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id      TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        name          TEXT NOT NULL,
        race          TEXT NOT NULL,
        class         TEXT NOT NULL,
        age           TEXT,
        description   TEXT,
        appearance    TEXT,
        avatar_file   TEXT,
        stats         TEXT NOT NULL DEFAULT '{}',
        free_points   INTEGER NOT NULL DEFAULT 0,
        level         INTEGER NOT NULL DEFAULT 1,
        xp            INTEGER NOT NULL DEFAULT 0,
        sanity        INTEGER NOT NULL DEFAULT 100,
        madness       TEXT,
        madness_until INTEGER,
        is_active     INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_char_owner ON characters(guild_id, user_id);

    CREATE TABLE reputation (
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        faction      TEXT NOT NULL,
        value        INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (character_id, faction)
    );

    CREATE TABLE message_xp (
        guild_id   TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        last_at    INTEGER NOT NULL DEFAULT 0,
        day        TEXT,
        day_xp     INTEGER NOT NULL DEFAULT 0,
        last_hash  TEXT,
        PRIMARY KEY (guild_id, user_id)
    );

    `,
    // v2 - кураторы анкет, назначенные командой /curator
    `
    CREATE TABLE curators (
        guild_id  TEXT NOT NULL,
        user_id   TEXT NOT NULL,
        added_by  TEXT,
        added_at  INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
    );
    `,
];

class Database {
    constructor(file) {
        this.file = path.isAbsolute(file) ? file : path.join(ROOT, file);
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        this.db = new sqlite.DatabaseSync(this.file);
        this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
        this.cache = new Map();
        this.migrate();
    }

    migrate() {
        const current = this.db.prepare('PRAGMA user_version').get().user_version;
        for (let v = current; v < MIGRATIONS.length; v++) {
            this.transaction(() => {
                this.db.exec(MIGRATIONS[v]);
                this.db.exec(`PRAGMA user_version = ${v + 1}`);
            });
            log.info(`Применена миграция базы v${v + 1}`);
        }
    }

    stmt(sql) {
        if (!this.cache.has(sql)) this.cache.set(sql, this.db.prepare(sql));
        return this.cache.get(sql);
    }

    clean(params) { return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p)); }
    run(sql, ...p) { return this.stmt(sql).run(...this.clean(p)); }
    get(sql, ...p) { return this.stmt(sql).get(...this.clean(p)); }
    all(sql, ...p) { return this.stmt(sql).all(...this.clean(p)); }

    transaction(fn) {
        this.db.exec('BEGIN');
        try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    }

    /** Резервная копия в data/backups, хранит последние N копий */
    async backup() {
        const dir = path.join(path.dirname(this.file), 'backups');
        fs.mkdirSync(dir, { recursive: true });
        const name = `bot-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
        await sqlite.backup(this.db, path.join(dir, name));
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
        while (files.length > config.database.keepBackups) fs.unlinkSync(path.join(dir, files.shift()));
        log.info(`Резервная копия базы: data/backups/${name}`);
    }
}

module.exports = new Database(config.database.file);
