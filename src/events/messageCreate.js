// Опыт за сообщения в РП-каналах (с защитой от спама).
const { Events } = require('discord.js');
const crypto = require('node:crypto');
const { config } = require('../core/config');
const db = require('../core/database');
const characters = require('../services/characters');
const progression = require('../services/progression');
const logger = require('../core/logger');
const { announceLevelUp } = require('../utils/levelup');

const M = config.xp.messages;
const log = logger.child('Опыт');

function isRpChannel(channel) {
    const ids = [channel.id, channel.parentId, channel.parent?.parentId].filter(Boolean);
    return ids.some((id) => M.channelIds.includes(id) || M.categoryIds.includes(id));
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (!M.enabled || !message.inGuild() || message.author.bot || message.webhookId) return;
        if (!isRpChannel(message.channel)) return;

        // Длина без ссылок и лишних пробелов
        const text = message.content.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
        if (text.length < M.minLength) return;

        const now = Date.now();
        const today = new Date().toISOString().slice(0, 10);
        const hash = crypto.createHash('md5').update(text.toLowerCase()).digest('hex');
        const row = db.get('SELECT * FROM message_xp WHERE guild_id = ? AND user_id = ?', message.guildId, message.author.id)
            || { last_at: 0, day: today, day_xp: 0, last_hash: null };
        const dayXp = row.day === today ? row.day_xp : 0;

        if (now - row.last_at < M.cooldownSeconds * 1000) return;  // слишком часто
        if (row.last_hash === hash) return;                         // копипаста
        if (dayXp >= M.dailyCap) return;                            // дневной лимит

        const ch = characters.getActive(message.guildId, message.author.id);
        if (!ch) return;

        const base = M.xpMin + Math.floor(Math.random() * (M.xpMax - M.xpMin + 1));
        const bonus = Math.min(M.maxLengthBonus, Math.floor(text.length / M.bonusPerChars));
        const amount = Math.min(base + bonus, M.dailyCap - dayXp);

        db.run(`INSERT INTO message_xp (guild_id, user_id, last_at, day, day_xp, last_hash) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET last_at = excluded.last_at, day = excluded.day, day_xp = excluded.day_xp, last_hash = excluded.last_hash`,
            message.guildId, message.author.id, now, today, dayXp + amount, hash);

        const { character, levelsGained } = progression.addXp(ch, amount);
        log.debug(`${message.author.tag} +${amount} XP → #${ch.id} (${text.length} симв.)`);
        if (levelsGained) await announceLevelUp(message.channel, character);
    },
};
