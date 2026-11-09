// Сообщение о новом уровне.
const { config } = require('../core/config');
const ui = require('../ui/components');
const logger = require('../core/logger');

async function announceLevelUp(fallbackChannel, ch) {
    const channel = config.xp.levelUpChannelId
        ? await fallbackChannel.client.channels.fetch(config.xp.levelUpChannelId).catch(() => fallbackChannel)
        : fallbackChannel;
    const p = ui.success('Новый уровень', `<@${ch.user_id}>, персонаж **${ch.name}** достиг **${ch.level}** уровня.`);
    await channel?.send({ ...p, allowedMentions: { users: [ch.user_id] } }).catch(() => {});
    logger.child('Опыт').info(`#${ch.id} ${ch.name} → уровень ${ch.level}`);
    logger.discord('xp', { title: 'Повышение уровня', body: `**${ch.name}** (<@${ch.user_id}>) → уровень **${ch.level}**` });
}

module.exports = { announceLevelUp };
