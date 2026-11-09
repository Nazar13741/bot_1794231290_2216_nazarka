// /profile - карточка персонажа: характеристики, краткое описание, аватар.
const { SlashCommandBuilder } = require('discord.js');
const ui = require('../ui/components');
const { autocompleteCharacters, resolveCharacter } = require('../utils/targets');
const { profilePayload } = require('../ui/profileView');

module.exports = {
    category: 'Персонажи',
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Карточка персонажа: характеристики, описание, аватар')
        .addUserOption((o) => o.setName('игрок').setDescription('Упоминание игрока (его активный персонаж)'))
        .addStringOption((o) => o.setName('персонаж').setDescription('ID или имя персонажа').setAutocomplete(true)),
    autocomplete: (i) => autocompleteCharacters(i),
    async execute(interaction) {
        const { ch, error } = resolveCharacter(interaction);
        if (error) return ui.replyError(interaction, error);
        await interaction.deferReply();
        await interaction.editReply(ui.forUpdate(await profilePayload(ch, { client: interaction.client, guild: interaction.guild, viewer: interaction.member })));
    },
};
