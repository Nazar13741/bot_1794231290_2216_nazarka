// Форма создания персонажа: charcreate:<токен>
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { config } = require('../core/config');
const ui = require('../ui/components');
const characters = require('../services/characters');
const avatars = require('../services/avatars');
const logger = require('../core/logger');
const { isCurator } = require('../core/permissions');

const log = logger.child('Создание');
const pending = new Map(); // токен → данные команды (15 минут)

function input(id, label, style, { required = false, max = 100, placeholder } = {}) {
    const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
    if (placeholder) t.setPlaceholder(placeholder);
    return new ActionRowBuilder().addComponents(t);
}

/** data = { name, race, cls, avatarUrl, ownerId } - ownerId: игрок, которому выдаётся персонаж */
async function showForm(interaction, data) {
    for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
    const token = Math.random().toString(36).slice(2, 10);
    pending.set(token, { ...data, creatorId: interaction.user.id, expires: Date.now() + 15 * 60 * 1000 });
    const modal = new ModalBuilder().setCustomId(`charcreate:${token}`).setTitle(`Анкета: ${data.name}`.slice(0, 45)).addComponents(
        input('description', 'Краткое описание', TextInputStyle.Paragraph, { required: true, max: 1500 }),
        input('appearance', 'Внешность', TextInputStyle.Paragraph, { max: 600 }),
        input('age', 'Возраст', TextInputStyle.Short, { max: 30 }),
    );
    await interaction.showModal(modal);
}

module.exports = {
    id: 'charcreate',
    showForm,
    async execute(interaction, [token]) {
        const data = pending.get(token);
        pending.delete(token);
        if (!data || data.expires < Date.now()) return ui.replyError(interaction, 'Форма устарела. Запустите `/char create` ещё раз.');
        if (data.creatorId !== interaction.user.id || !isCurator(interaction.member)) {
            return ui.replyError(interaction, 'Создавать персонажей могут только администраторы и кураторы.');
        }
        if (characters.listByUser(interaction.guildId, data.ownerId).length >= config.characters.maxPerUser) {
            return ui.replyError(interaction, `У <@${data.ownerId}> уже максимум персонажей (${config.characters.maxPerUser}).`);
        }
        await interaction.deferReply({ flags: 64 });
        const f = (id) => interaction.fields.getTextInputValue(id)?.trim() || null;

        let ch = characters.create({
            guildId: interaction.guildId, userId: data.ownerId, name: data.name, race: data.race, cls: data.cls,
            description: f('description'), appearance: f('appearance'), age: f('age'),
        });
        let avatarNote = '';
        if (data.avatarUrl) {
            try { ch = characters.update(ch.id, { avatar_file: await avatars.saveFromUrl(ch.id, data.avatarUrl) }); } catch (e) { avatarNote = `\nАватар не сохранён: ${e.message}`; }
        }

        log.info(`${interaction.user.tag} создал персонажа #${ch.id} «${ch.name}» для ${ch.user_id}`);
        logger.discord('characters', { title: 'Новая анкета', body: `**${ch.name}** (#${ch.id}) · ${ch.race} · ${ch.class}\nВладелец: <@${ch.user_id}> · выдал: <@${interaction.user.id}>` });

        if (config.characters.announceChannelId) {
            const channel = await interaction.client.channels.fetch(config.characters.announceChannelId).catch(() => null);
            if (channel?.isTextBased()) {
                const { profilePayload } = require('../ui/profileView');
                const p = await profilePayload(ch, { client: interaction.client, guild: interaction.guild, viewer: interaction.member });
                await channel.send({ ...p, allowedMentions: { users: [] } }).catch((e) => log.warn(`Анонс не отправлен: ${e.message}`));
            }
        }

        await interaction.editReply(ui.forUpdate(ui.success('Анкета создана',
            `**${ch.name}** - ${ch.race}, ${ch.class}. ID ${ch.id}.\nВыдан игроку <@${ch.user_id}>.${avatarNote}`)));
    },
};
