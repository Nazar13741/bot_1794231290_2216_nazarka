// Загружает .env и config/config.js, проверяет их и выдаёт понятные ошибки.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV_FILE = path.join(ROOT, '.env');

if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const config = require(path.join(ROOT, 'config', 'config.js'));

const SNOWFLAKE = /^\d{17,20}$/;
const HEX = /^#[0-9a-f]{6}$/i;

function validate() {
    const errors = [];
    const warnings = [];
    const env = {
        token: (process.env.DISCORD_TOKEN || '').trim(),
        clientId: (process.env.CLIENT_ID || '').trim(),
        guildId: (process.env.GUILD_ID || '').trim(),
    };

    if (!env.token) errors.push('В файле .env не указан DISCORD_TOKEN (токен бота).');
    if (!SNOWFLAKE.test(env.clientId)) errors.push('В файле .env не указан или неверен CLIENT_ID (ID приложения).');
    if (env.guildId && !SNOWFLAKE.test(env.guildId)) errors.push('GUILD_ID в .env должен состоять только из цифр.');

    const checkIds = (list, where) => (list || []).forEach((id) => {
        if (!SNOWFLAKE.test(String(id))) errors.push(`${where}: «${id}» не похоже на ID Discord.`);
    });
    checkIds(config.permissions.adminRoleIds, 'permissions.adminRoleIds');
    checkIds(config.permissions.masterRoleIds, 'permissions.masterRoleIds');
    checkIds(config.permissions.curatorRoleIds, 'permissions.curatorRoleIds');
    checkIds(config.permissions.curatorUserIds, 'permissions.curatorUserIds');
    checkIds(config.xp.messages.channelIds, 'xp.messages.channelIds');
    checkIds(config.xp.messages.categoryIds, 'xp.messages.categoryIds');
    for (const [k, v] of Object.entries(config.logging.channels)) if (v) checkIds([v], `logging.channels.${k}`);

    for (const [k, v] of Object.entries(config.theme.colors)) {
        if (!HEX.test(v)) errors.push(`theme.colors.${k}: «${v}» - цвет должен быть в формате #RRGGBB.`);
    }

    const keys = config.stats.list.map((s) => s.key);
    if (new Set(keys).size !== keys.length) errors.push('stats.list: ключи характеристик (key) повторяются.');
    if (keys.length < 1 || keys.length > 10) errors.push('stats.list: должно быть от 1 до 10 характеристик.');
    const checkBonuses = (arr, where) => arr.forEach((x) => Object.keys(x.bonuses || {}).forEach((k) => {
        if (!keys.includes(k)) errors.push(`${where} «${x.name}»: бонус к неизвестной характеристике «${k}».`);
    }));
    checkBonuses(config.characters.races, 'characters.races');
    checkBonuses(config.characters.classes, 'characters.classes');

    const fk = config.reputation.factions.map((f) => f.key);
    if (new Set(fk).size !== fk.length) errors.push('reputation.factions: ключи фракций повторяются.');

    const m = config.xp.messages;
    if (m.enabled && !m.channelIds.length && !m.categoryIds.length) {
        warnings.push('Опыт за сообщения включён, но не указаны РП-каналы (xp.messages.channelIds / categoryIds) - начисляться он не будет.');
    }
    const listCheck = (list, where) => { if (!Array.isArray(list)) errors.push(`${where} должен быть списком [].`); };
    listCheck(config.characters.races, 'characters.races');
    listCheck(config.characters.classes, 'characters.classes');
    listCheck(config.reputation.factions, 'reputation.factions');
    if (!config.sanity.states.length) errors.push('sanity.states: нужен хотя бы один порог.');
    if (!config.reputation.ranks.length) errors.push('reputation.ranks: нужен хотя бы один ранг.');
    if (config.reputation.mode === 'factions' && !config.reputation.factions.length) {
        warnings.push('Фракции не заданы (reputation.factions) - репутация не отображается.');
    }
    if (!config.permissions.adminRoleIds.length && !config.permissions.discordAdminsAreAdmins) {
        warnings.push('Не указаны роли администраторов - никто не сможет назначать кураторов, создавать и редактировать анкеты (кроме curatorRoleIds / curatorUserIds).');
    }
    return { env, errors, warnings };
}

const { env, errors, warnings } = validate();

module.exports = { config, env, errors, warnings, ROOT };
