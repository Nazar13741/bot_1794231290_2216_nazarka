// /char create - создание анкеты и выдача её игроку (только админы и кураторы)
// /char redact - редактирование анкеты и статов (только админы и кураторы)
const { SlashCommandBuilder } = require('discord.js');
const { config } = require('../core/config');
const ui = require('../ui/components');
const characters = require('../services/characters');
const { autocompleteCharacters } = require('../utils/targets');
const charcreate = require('../components/charcreate');
const edit = require('../components/edit');

module.exports = {
    category: 'Персонажи',
    subAccess: { create: 'curator', redact: 'curator' },
    data: new SlashCommandBuilder()
        .setName('char')
        .setDescription('Анкеты персонажей')
        .addSubcommand((s) => s.setName('create').setDescription('(Админ/куратор) Создать персонажа и выдать его игроку')
            .addUserOption((o) => o.setName('игрок').setDescription('Кому выдать персонажа').setRequired(true))
            .addStringOption((o) => o.setName('имя').setDescription('Имя персонажа').setRequired(true).setMaxLength(50))
            .addStringOption((o) => o.setName('раса').setDescription('Раса').setRequired(true).setAutocomplete(true).setMaxLength(40))
            .addStringOption((o) => o.setName('класс').setDescription('Класс').setRequired(true).setAutocomplete(true).setMaxLength(40))
            .addAttachmentOption((o) => o.setName('аватар').setDescription('Изображение персонажа')))
        .addSubcommand((s) => s.setName('redact').setDescription('(Админ/куратор) Редактировать анкету и характеристики')
            .addStringOption((o) => o.setName('персонаж').setDescription('Имя или ID персонажа').setRequired(true).setAutocomplete(true))),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === 'раса' || focused.name === 'класс') {
            const list = focused.name === 'раса' ? config.characters.races : config.characters.classes;
            const q = focused.value.toLowerCase();
            return interaction.respond(list.filter((x) => x.name.toLowerCase().includes(q)).slice(0, 25)
                .map((x) => ({ name: (x.description ? `${x.name} - ${x.description}` : x.name).slice(0, 100), value: x.name })));
        }
        return autocompleteCharacters(interaction);
    },

    async execute(interaction) {
        return handlers[interaction.options.getSubcommand()](interaction);
    },
};

/** Проверка значения по списку из конфига (пустой список = свободный ввод) */
function checkOption(value, list, allowCustom, label) {
    if (!list.length || allowCustom) return { value: list.find((x) => x.name.toLowerCase() === value.toLowerCase())?.name || value };
    const found = list.find((x) => x.name.toLowerCase() === value.toLowerCase());
    return found ? { value: found.name } : { error: `Неизвестное значение «${value}» (${label}). Доступно: ${list.map((x) => x.name).join(', ')}.` };
}

const handlers = {
    async create(interaction) {
        const name = interaction.options.getString('имя').trim();
        const race = checkOption(interaction.options.getString('раса').trim(), config.characters.races, config.characters.allowCustomRace, 'раса');
        if (race.error) return ui.replyError(interaction, race.error);
        const cls = checkOption(interaction.options.getString('класс').trim(), config.characters.classes, config.characters.allowCustomClass, 'класс');
        if (cls.error) return ui.replyError(interaction, cls.error);
        const target = interaction.options.getUser('игрок');
        if (target.bot) return ui.replyError(interaction, 'Персонажа нельзя выдать боту.');
        const count = characters.listByUser(interaction.guildId, target.id).length;
        if (count >= config.characters.maxPerUser) return ui.replyError(interaction, `У <@${target.id}> уже максимум персонажей: ${count} из ${config.characters.maxPerUser}.`);
        const avatar = interaction.options.getAttachment('аватар');
        if (avatar && !avatar.contentType?.startsWith('image/')) return ui.replyError(interaction, 'Аватар должен быть изображением.');
        await charcreate.showForm(interaction, { name, race: race.value, cls: cls.value, avatarUrl: avatar?.url, ownerId: target.id });
    },

    async redact(interaction) {
        const id = interaction.options.getString('персонаж');
        const ch = (/^\d+$/.test(id) && characters.getById(id)) || characters.search(interaction.guildId, id)[0];
        if (!ch || ch.guild_id !== interaction.guildId) return ui.replyError(interaction, 'Персонаж не найден.');
        return interaction.reply(edit.panel(ch));
    },
};
