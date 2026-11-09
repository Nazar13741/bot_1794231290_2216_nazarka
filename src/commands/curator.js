// /curator - администрация назначает людей, которые могут создавать и выдавать
// персонажей и редактировать анкеты/статы (/char create, /char redact).
const { SlashCommandBuilder } = require('discord.js');
const { config } = require('../core/config');
const ui = require('../ui/components');
const curators = require('../services/curators');
const logger = require('../core/logger');

const log = logger.child('Кураторы');

module.exports = {
    category: 'Администрации',
    access: 'admin',
    data: new SlashCommandBuilder()
        .setName('curator')
        .setDescription('Кураторы анкет: кто может выдавать персонажей и менять статы')
        .addSubcommand((s) => s.setName('add').setDescription('(Админ) Назначить куратора анкет')
            .addUserOption((o) => o.setName('пользователь').setDescription('Кого назначить').setRequired(true)))
        .addSubcommand((s) => s.setName('remove').setDescription('(Админ) Снять куратора анкет')
            .addUserOption((o) => o.setName('пользователь').setDescription('Кого снять').setRequired(true)))
        .addSubcommand((s) => s.setName('list').setDescription('(Админ) Список кураторов анкет')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('пользователь');

        if (sub === 'add') {
            if (user.bot) return ui.replyError(interaction, 'Бота нельзя назначить куратором.');
            const added = curators.add(interaction.guildId, user.id, interaction.user.id);
            if (!added) return ui.replyError(interaction, `<@${user.id}> уже куратор.`);
            log.info(`${interaction.user.tag} назначил куратора ${user.tag}`);
            logger.discord('characters', { title: 'Назначен куратор', body: `<@${interaction.user.id}> → <@${user.id}>` });
            return interaction.reply(ui.success('Куратор назначен', `<@${user.id}> теперь может создавать и выдавать персонажей (\`/char create\`) и редактировать анкеты и характеристики (\`/char redact\`).`));
        }

        if (sub === 'remove') {
            const removed = curators.remove(interaction.guildId, user.id);
            const viaConfig = (config.permissions.curatorUserIds || []).includes(user.id);
            if (!removed && !viaConfig) return ui.replyError(interaction, `<@${user.id}> не назначен куратором.`);
            if (removed) {
                log.info(`${interaction.user.tag} снял куратора ${user.tag}`);
                logger.discord('characters', { title: 'Куратор снят', accent: 'danger', body: `<@${interaction.user.id}> → <@${user.id}>` });
            }
            const note = viaConfig ? '\n-# Этот ID также указан в config.js (permissions.curatorUserIds) - уберите его оттуда и перезапустите бота.' : '';
            return interaction.reply(ui.success(removed ? 'Куратор снят' : 'Внимание', `${removed ? `<@${user.id}> больше не куратор.` : `<@${user.id}> назначен через config.js.`}${note}`));
        }

        const fromDb = curators.list(interaction.guildId).map((c) => `◈ <@${c.user_id}> · назначил <@${c.added_by}> · <t:${Math.floor(c.added_at / 1000)}:d>`);
        const fromCfg = (config.permissions.curatorUserIds || []).map((id) => `◈ <@${id}> · config.js`);
        const roles = (config.permissions.curatorRoleIds || []).map((id) => `<@&${id}>`);
        const body = [
            fromDb.length || fromCfg.length ? [...fromDb, ...fromCfg].join('\n') : 'Кураторов пока нет. Назначить: `/curator add`.',
            roles.length ? `\n**Роли кураторов:** ${roles.join(', ')}` : '',
            '\n-# Администраторы имеют эти права всегда.',
        ].join('\n');
        return interaction.reply(ui.notice('Кураторы анкет', body, { ephemeral: true }));
    },
};
