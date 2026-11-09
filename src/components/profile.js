// Элементы профиля: profile:pick:<владелец> (выбор персонажа), profile:active:<id>
const ui = require('../ui/components');
const characters = require('../services/characters');
const { profilePayload } = require('../ui/profileView');
const { isCurator } = require('../core/permissions');

module.exports = {
    id: 'profile',
    async execute(interaction, [action, arg]) {
        const charId = action === 'pick' ? interaction.values[0] : arg;
        const ch = characters.getById(charId);
        if (!ch || ch.guild_id !== interaction.guildId) return ui.replyError(interaction, 'Персонаж не найден (возможно, удалён).');

        if (action === 'active') {
            if (ch.user_id !== interaction.user.id && !isCurator(interaction.member)) {
                return ui.replyError(interaction, 'Это может сделать только владелец персонажа.');
            }
            characters.setActive(ch);
        }
        await interaction.deferUpdate();
        const fresh = characters.getById(ch.id);
        await interaction.editReply(ui.forUpdate(await profilePayload(fresh, { client: interaction.client, guild: interaction.guild, viewer: interaction.member })));
    },
};
