// Локальная база данных - инструменты без Discord.
// База - это ОДИН файл data/grimoire.db (SQLite). Сервер, MySQL, пароли - не нужны.
// Открыть его можно и вручную, например программой «DB Browser for SQLite».
//
//   npm run db                       - сводка: где лежит файл, сколько персонажей
//   npm run db -- list               - список всех персонажей
//   npm run db -- show 3             - один персонаж подробно (по номеру листа)
//   npm run db -- demo <серверID> <пользовательID>  - создать 3 демо-персонажа
//   npm run db -- backup             - резервная копия в data/backups
//   npm run db -- reset --yes        - удалить ВСЕ данные (сначала делается копия)
const fs = require('node:fs');
const db = require('../src/core/database');
const characters = require('../src/services/characters');
const reputation = require('../src/services/reputation');
const { config } = require('../src/core/config');

const [cmd = 'info', ...args] = process.argv.slice(2);
const kb = (f) => (fs.existsSync(f) ? `${(fs.statSync(f).size / 1024).toFixed(1)} КБ` : '-');

const commands = {
    info() {
        const n = (t) => (db.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", t) ? db.get(`SELECT COUNT(*) AS c FROM ${t}`).c : 0);
        console.log(`Файл базы:     ${db.file} (${kb(db.file)})`);
        console.log(`Версия схемы:  ${db.get('PRAGMA user_version').user_version}`);
        console.log(`Персонажей:    ${n('characters')}`);
        console.log(`Репутаций:     ${n('reputation')}`);
        console.log(`Записей аудита: ${n('audit_log')}`);
        console.log(`Кураторов:     ${n('curators')}`);
    },
    list() {
        const rows = db.all('SELECT id, guild_id, user_id, name, race, class, level, xp, sanity, is_active FROM characters ORDER BY id');
        if (!rows.length) return console.log('Персонажей пока нет. Админ/куратор создаёт в Discord: /char create @игрок - или: npm run db -- demo');
        console.table(rows.map((r) => ({ '№': r.id, Имя: r.name, Раса: r.race, Класс: r.class, Ур: r.level, Опыт: r.xp, Рассудок: r.sanity, Активен: r.is_active ? '✔' : '', Игрок: r.user_id })));
    },
    show(id) {
        const ch = characters.getById(Number(id));
        if (!ch) return console.log(`Лист № ${id} не найден.`);
        console.log(ch);
        console.table(reputation.list(ch.id).map((r) => ({ Фракция: r.faction.name, Очки: r.value, Ранг: r.rank.name })));
    },
    demo(guildId = '000000000000000000', userId = '000000000000000000') {
        const R = config.characters.races, C = config.characters.classes;
        const demo = [
            { name: 'Изольда ван Брасс', race: R[1]?.name, cls: C[0]?.name, quote: 'Всякая формула - это молитва, записанная латунью и ртутью.', level: 7, xp: 120, sanity: 64 },
            { name: 'Торвин Медная Борода', race: R[2]?.name, cls: C[1]?.name, quote: 'Если механизм молчит - значит, он думает.', level: 3, xp: 40, sanity: 88 },
            { name: 'Брат Октавиан', race: R[0]?.name, cls: C[4]?.name, description: 'Бывший переписчик монастыря, прочёл в гримуаре то, чего читать не следовало.', level: 2, xp: 10, sanity: 22 },
        ];
        for (const d of demo) {
            const ch = characters.create({ guildId, userId, name: d.name, race: d.race || 'Человек', cls: d.cls || 'Бард', quote: d.quote || null, description: d.description || null });
            characters.update(ch.id, { level: d.level, xp: d.xp, sanity: d.sanity });
            const f = reputation.factions();
            if (f[0]) reputation.change(ch.id, f[0].key, 30 - ch.id * 7);
            if (f[3]) reputation.change(ch.id, f[3].key, -15 * ch.id);
            console.log(`✔ Создан лист № ${ch.id}: ${d.name}`);
        }
        if (guildId.startsWith('0')) console.log('\nПодсказка: укажите ID своего сервера и свой ID, чтобы увидеть демо в /profile:\n  npm run db -- demo 123456789012345678 987654321098765432');
    },
    async backup() { await db.backup(); },
    async reset() {
        if (!args.includes('--yes')) return console.log('Это удалит ВСЕХ персонажей. Подтвердите: npm run db -- reset --yes');
        await db.backup();
        db.transaction(() => { for (const t of ['reputation', 'message_xp', 'audit_log', 'characters']) if (db.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", t)) db.run(`DELETE FROM ${t}`); });
        console.log('База очищена (копия сохранена в data/backups).');
    },
};

(async () => {
    const fn = commands[cmd];
    if (!fn) { console.log(`Неизвестная команда «${cmd}». Доступно: ${Object.keys(commands).join(', ')}`); process.exit(1); }
    await fn(...args);
})().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
