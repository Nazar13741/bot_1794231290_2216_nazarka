// Сообщение профиля на Components V2: карточка-картинка + анкета, характеристики,
// рассудок, репутация. Снизу - выбор персонажа игрока и кнопки владельца.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('node:fs');
const pathMod = require('node:path');
const { config } = require('../core/config');
const ui = require('./components');
const characters = require('../services/characters');
const progression = require('../services/progression');
const sanity = require('../services/sanity');
const reputation = require('../services/reputation');
const avatars = require('../services/avatars');
const log = require('../core/logger').child('Профиль');

const S = config.stats;

function statsText(ch) {
    return S.list.map((s) => {
        const v = ch.stats[s.key];
        return `> **${s.short}** · ${s.name} - **${v}**`;
    }).join('\n');
}

function mindText(ch) {
    const st = sanity.state(ch.sanity);
    const mad = sanity.activeMadness(ch);
    const lines = [
        `◈ **Рассудок** : ${ch.sanity} / ${config.sanity.max} - ${st.name}`,
        `\`${ui.bar(ch.sanity, config.sanity.max, 20)}\``,
        `◈ **Штраф к броскам** : ${sanity.rollPenalty(ch)}`,
    ];
    if (mad) lines.push(`◈ **Временное безумие** до <t:${Math.floor(mad.until / 1000)}:t>\n> *${mad.effect}*`);
    return lines.join('\n');
}

function repText(ch) {
    return reputation.list(ch.id).map(({ faction, value, rank }) =>
        `◈ **${faction.name}** : ${ui.signed(value)} - ${rank.name} · цены ${ui.signed(rank.priceModifier)}% · квесты: ${rank.quests}`).join('\n');
}

function controls(ch, list, viewer) {
    const rows = [];
    if (list.length > 1) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`profile:pick:${ch.user_id}`).setPlaceholder('Другой персонаж игрока')
            .addOptions(list.slice(0, 25).map((c) => ({
                label: c.name.slice(0, 100), value: String(c.id), default: c.id === ch.id,
                description: `ID ${c.id} · ${c.race}, ${c.class} · ур. ${c.level}${c.is_active ? ' · активен' : ''}`.slice(0, 100),
            })))));
    }
    const buttons = [];
    if (!ch.is_active) buttons.push(new ButtonBuilder().setCustomId(`profile:active:${ch.id}`).setLabel('Сделать активным').setStyle(ButtonStyle.Secondary));
    if (buttons.length) rows.push(new ActionRowBuilder().addComponents(buttons));
    return rows;
}

/** Собирает сообщение профиля. guild, viewer - для названия сервера на карточке и кнопок админа */
async function profilePayload(ch, { client, guild, viewer } = {}) {
    const files = [];
    const list = characters.listByUser(ch.guild_id, ch.user_id);
    const owner = await client?.users.fetch(ch.user_id).catch(() => null);
    const member = await guild?.members.fetch(ch.user_id).catch(() => null);
    const ownerAvatarUrl = (member || owner)?.displayAvatarURL({ extension: 'png', size: 256 });
    const blocks = [];

    let cardOk = false;
    if (config.theme.profileCardImage) {
        try {
            const { renderProfileCard } = require('./profileCard');
            const png = await renderProfileCard({
                ch, characters: list, ownerName: owner?.username, ownerAvatarUrl,
                guildName: guild?.name, guildIconUrl: guild?.iconURL({ extension: 'png', size: 64 }),
            });
            files.push(new AttachmentBuilder(png, { name: 'profile.png' }));
            blocks.push(ui.image('attachment://profile.png', `Профиль: ${ch.name}`));
            cardOk = true;
        } catch (e) { log.error('Не удалось нарисовать карточку:', e); }
    }

    const head = `# ${ch.name}\n**${ch.race}** · **${ch.class}** · уровень ${ch.level}`;
    if (cardOk) blocks.push(ui.text(head));
    else {
        // без картинки - аватар миниатюрой справа от заголовка
        const file = avatars.filePath(ch.avatar_file);
        let thumb = ownerAvatarUrl;
        if (file && fs.existsSync(file)) {
            const name = `avatar${pathMod.extname(file)}`;
            files.push(new AttachmentBuilder(file, { name }));
            thumb = `attachment://${name}`;
        }
        blocks.push(thumb ? ui.section(head, thumb) : ui.text(head));
    }
    blocks.push(ui.divider());

    const info = [`◈ **Владелец** : <@${ch.user_id}>`];
    if (ch.age) info.push(`◈ **Возраст** : ${ch.age}`);
    info.push(`◈ **Здоровье (HP)** : ${characters.maxHp(ch)}`);
    info.push(`◈ **Опыт** : ${ch.xp} / ${progression.xpToNext(ch.level)}`);
    let anketa = `### Анкета\n${info.join('\n')}`;
    if (ch.description) anketa += `\n\n**Описание**\n${ch.description}`;
    if (ch.appearance) anketa += `\n\n**Внешность**\n${ch.appearance}`;
    blocks.push(ui.text(anketa));
    blocks.push(ui.divider());

    blocks.push(ui.text(`### Характеристики\n${statsText(ch)}`));
    blocks.push(ui.divider());
    blocks.push(ui.text(`### Рассудок\n${mindText(ch)}`));
    const rep = repText(ch);
    if (rep) { blocks.push(ui.divider()); blocks.push(ui.text(`### Репутация\n${rep}`)); }
    blocks.push(ui.line(true));
    blocks.push(ui.text(`-# ID ${ch.id}${ch.is_active ? ' · активный персонаж' : ''}`));
    for (const r of controls(ch, list, viewer)) blocks.push(ui.row(r));

    return ui.message({ blocks, files, accent: sanity.activeMadness(ch) ? 'danger' : 'primary' });
}

module.exports = { profilePayload, statsText };
