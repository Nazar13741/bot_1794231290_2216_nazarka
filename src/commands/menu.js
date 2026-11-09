// /menu - описание бота и полный список команд (собирается из папки commands).
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { config } = require('../core/config');
const ui = require('../ui/components');
const { canUse } = require('../core/permissions');

const ACCESS = { admin: 'админ', curator: 'админ/куратор', master: 'мастер' };

function catalog(client) {
    const out = {};
    for (const cmd of client.commands.values()) {
        const json = cmd.data.toJSON();
        const cat = cmd.category || 'Прочее';
        const usage = (name, opts) => `/${name}${(opts || []).map((o) => (o.required ? ` [${o.name}]` : ` (${o.name})`)).join('')}`;
        const subs = (json.options || []).filter((o) => o.type === 1);
        const entries = subs.length
            ? subs.map((s) => ({ usage: usage(`${json.name} ${s.name}`, s.options), description: s.description, access: cmd.subAccess?.[s.name] || cmd.access }))
            : [{ usage: usage(json.name, json.options), description: json.description, access: cmd.access }];
        (out[cat] ||= []).push(...entries);
    }
    return out;
}

function about() {
    const S = config.stats.list.map((s) => `**${s.short}** ${s.name} - ${s.description}`).join('\n');
    const M = config.xp.messages;
    return [
        '### Описание',
        'Бот ведёт анкеты персонажей, привязанные к Discord-аккаунту: характеристики, рассудок, репутацию и опыт.',
        'Персонажей создают и выдают игрокам, а также меняют их характеристики только администраторы и назначенные кураторы.',
        `\n**Характеристики**\n${S}`,
        `\n**Рассудок** - шкала 0–${config.sanity.max}. Ниже порогов - штрафы к броскам; ниже ${config.sanity.madness.triggerBelow} - временное безумие.`,
        `**Репутация** - от ${config.reputation.min} до ${config.reputation.max}${config.reputation.mode === 'global' ? ' (общая)' : ' по фракциям'}. Влияет на цены и доступ к квестам.`,
        `**Опыт** - за посты в РП-каналах (от ${M.minLength} символов, не чаще раза в ${M.cooldownSeconds} с, до ${M.dailyCap} в сутки) и вручную от мастеров через \`/give_xp\`.`,
    ].join('\n');
}

function view(client, member, category) {
    const cat = catalog(client);
    const names = Object.keys(cat);
    const blocks = [];
    if (!category) {
        blocks.push(ui.text(about()));
        blocks.push(ui.divider());
        blocks.push(ui.text(`### Команды\n${names.map((n) => cat[n].map((c) => `\`${c.usage}\`${c.access && c.access !== 'everyone' ? ` · ${ACCESS[c.access]}` : ''}`).join('\n')).join('\n')}\n\n-# \`[поле]\` - обязательно, \`(поле)\` - по желанию. Подробности - в списке ниже.`));
    } else {
        const lines = (cat[category] || []).map((c) => `**\`${c.usage}\`**${c.access && c.access !== 'everyone' ? ` · ${ACCESS[c.access]}${canUse(member, c.access) ? '' : ' (нет доступа)'}` : ''}\n${c.description}`);
        blocks.push(ui.text(`### ${category}\n${lines.join('\n\n')}`));
    }
    const select = new StringSelectMenuBuilder().setCustomId('menu:open').setPlaceholder('Раздел')
        .addOptions([{ label: 'Описание и все команды', value: '_home', default: !category },
            ...names.map((n) => ({ label: n, value: n, default: n === category }))]);
    blocks.push(ui.row(new ActionRowBuilder().addComponents(select)));
    return ui.message({ blocks, ephemeral: true });
}

module.exports = {
    category: 'Прочее',
    view,
    data: new SlashCommandBuilder().setName('menu').setDescription('Описание бота и полный список команд'),
    async execute(interaction) {
        return interaction.reply(view(interaction.client, interaction.member));
    },
};
