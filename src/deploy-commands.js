// Регистрация слэш-команд в Discord.
// Запуск вручную: npm run deploy   (также вызывается при старте, если bot.autoDeployCommands = true)
const { REST, Routes, Collection } = require('discord.js');
const logger = require('./core/logger');

async function deployCommands(commands, env) {
    const body = [...commands.values()].map((c) => c.data.toJSON());
    const rest = new REST().setToken(env.token);
    const route = env.guildId ? Routes.applicationGuildCommands(env.clientId, env.guildId) : Routes.applicationCommands(env.clientId);
    const data = await rest.put(route, { body });
    logger.info(`Зарегистрировано команд: ${data.length} (${env.guildId ? 'на сервере - сразу' : 'глобально - до 1 часа'})`);
}

module.exports = { deployCommands };

if (require.main === module) {
    const { env, errors } = require('./core/config');
    if (errors.length) { errors.forEach((e) => logger.error(e)); process.exit(1); }
    const client = { commands: new Collection() };
    require('./core/loader').loadCommands(client);
    deployCommands(client.commands, env).then(() => process.exit(0)).catch((e) => { logger.error(e); process.exit(1); });
}
