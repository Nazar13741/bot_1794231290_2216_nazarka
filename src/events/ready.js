// Бот запустился.
const { Events, ActivityType } = require('discord.js');
const { config, env } = require('../core/config');
const logger = require('../core/logger');
const { deployCommands } = require('../deploy-commands');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Бот в сети как ${client.user.tag} · серверов: ${client.guilds.cache.size}`);
        if (config.bot.activity) client.user.setActivity(config.bot.activity, { type: ActivityType.Custom });
        if (config.bot.autoDeployCommands) {
            try { await deployCommands(client.commands, env); } catch (e) { logger.error('Не удалось зарегистрировать команды:', e); }
        }
        logger.discord('default', { title: 'Бот запущен', body: `Команд: ${client.commands.size}` });
    },
};
