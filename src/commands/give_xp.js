// /give_xp - ручная выдача опыта мастером за качественный пост.
const { SlashCommandBuilder } = require('discord.js');
const { config } = require('../core/config');
const ui = require('../ui/components');
const progression = require('../services/progression');
const logger = require('../core/logger');
const { autocompleteCharacters, resolveCharacter } = require('../utils/targets');
const { announceLevelUp } = require('../utils/levelup');

module.exports = {
    category: 'Мастерам',
    access: 'master',
    data: new SlashCommandBuilder()
        .setName('give_xp')
        .setDescription('(Мастер) Выдать опыт персонажу за пост')
        .addIntegerOption((o) => o.setName('количество').setDescription('Сколько опыта (отрицательное - списать)').setRequired(true)
            .setMinValue(-config.xp.manual.maxPerGive).setMaxValue(config.xp.manual.maxPerGive))
        .addUserOption((o) => o.setName('игрок').setDescription('Игрок (опыт получит его активный персонаж)'))
        .addStringOption((o) => o.setName('персонаж').setDescription('Или конкретный персонаж').setAutocomplete(true))
        .addStringOption((o) => o.setName('причина').setDescription('За что').setMaxLength(200)),
    autocomplete: (i) => autocompleteCharacters(i),
    async execute(interaction) {
        const { ch, error } = resolveCharacter(interaction, { self: false });
        if (error) return ui.replyError(interaction, error);
        const amount = interaction.options.getInteger('количество');
        const reason = interaction.options.getString('причина');
        const { character, levelsGained } = progression.addXp(ch, amount);
        const need = progression.xpToNext(character.level);
        logger.child('Опыт').info(`${interaction.user.tag} → #${ch.id} ${ch.name}: ${amount} XP${reason ? ` (${reason})` : ''}`);
        logger.discord('xp', { title: 'Выдача опыта', body: `<@${interaction.user.id}> → **${ch.name}** (<@${ch.user_id}>): **${ui.signed(amount)} XP**${reason ? `\n${reason}` : ''}` });
        await interaction.reply(ui.message({
            accent: 'accent',
            blocks: [ui.text(`### Опыт: ${ui.signed(amount)}\n**${character.name}**${reason ? `\n> ${reason}` : ''}\n\nУровень **${character.level}** · ${character.xp} / ${need}\n\`${ui.bar(character.xp, need, 16)}\``)],
        }));
        if (levelsGained) await announceLevelUp(interaction.channel, character);
    },
};
