// Подсказки персонажей и поиск «какой персонаж имеется в виду».
const characters = require('../services/characters');

async function autocompleteCharacters(interaction, { own = false } = {}) {
    const focused = interaction.options.getFocused();
    const list = characters.search(interaction.guildId, focused, own ? { userId: interaction.user.id } : {});
    await interaction.respond(list.map((c) => ({
        name: `#${c.id} · ${c.name} (${c.race}, ${c.class}, ур. ${c.level})${c.is_active ? ' ★' : ''}`.slice(0, 100),
        value: String(c.id),
    })));
}

/** По опции «персонаж» (ID/имя) или «игрок» (его активный персонаж). self - по умолчанию автор команды */
function resolveCharacter(interaction, { self = true } = {}) {
    const charOpt = interaction.options.getString('персонаж');
    const user = interaction.options.getUser('игрок');
    if (charOpt) {
        const ch = (/^\d+$/.test(charOpt) && characters.getById(Number(charOpt))) || characters.search(interaction.guildId, charOpt)[0];
        if (!ch || ch.guild_id !== interaction.guildId) return { error: `Персонаж «${charOpt}» не найден.` };
        return { ch };
    }
    const target = user || (self ? interaction.user : null);
    if (!target) return { error: 'Укажите игрока или персонажа.' };
    const ch = characters.getActive(interaction.guildId, target.id);
    if (!ch) return { error: target.id === interaction.user.id ? 'У вас нет персонажа. Персонажей выдаёт администрация.' : `У <@${target.id}> нет персонажей.` };
    return { ch };
}

module.exports = { autocompleteCharacters, resolveCharacter };
