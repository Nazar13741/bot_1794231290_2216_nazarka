// Точка входа бота. Запуск: npm start
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
    console.error(`Нужен Node.js 22.13 или новее (у вас ${process.versions.node}). Скачайте LTS: https://nodejs.org`);
    process.exit(1);
}
// Прячем предупреждение «SQLite is an experimental feature»
const emit = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w).includes('SQLite') ? undefined : emit.call(process, w, ...a));

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { config, env, errors, warnings } = require('./core/config');
const logger = require('./core/logger');

if (errors.length) {
    logger.error('Бот не может запуститься - исправьте настройки:');
    errors.forEach((e) => logger.error(' • ' + e));
    process.exit(1);
}
warnings.forEach((w) => logger.warn(w));

const db = require('./core/database');
const loader = require('./core/loader');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel],
});
client.commands = new Collection();
client.components = new Collection();

loader.loadCommands(client);
loader.loadComponents(client);
loader.loadEvents(client);
logger.attachClient(client);
logger.cleanupOldLogs();

process.on('unhandledRejection', (e) => logger.error('Необработанная ошибка (Promise):', e));
process.on('uncaughtException', (e) => logger.error('Необработанная ошибка:', e));
client.on('error', (e) => logger.error('Ошибка клиента Discord:', e));

const shutdown = async (signal) => {
    logger.info(`Получен ${signal}, останавливаю бота…`);
    await client.destroy();
    db.db.close();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async () => {
    if (config.database.backupOnStart) await db.backup().catch((e) => logger.warn('Резервная копия не создана:', e.message));
    await client.login(env.token);
})().catch((e) => {
    logger.error('Не удалось войти в Discord. Проверьте DISCORD_TOKEN в .env и что у бота включены интенты MESSAGE CONTENT и SERVER MEMBERS.', e);
    process.exit(1);
});
