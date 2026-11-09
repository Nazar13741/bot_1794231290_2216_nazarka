// Маршрутизатор: слэш-команды, подсказки, кнопки, списки и формы.
const { Events, Collection } = require('discord.js');
const ui = require('../ui/components');
const logger = require('../core/logger');
const { canUse } = require('../core/permissions');

const log = logger.child('Взаимодействия');
const cooldowns = new Collection();
const ACCESS_TEXT = { admin: 'администраторам', curator: 'администраторам и кураторам', master: 'мастерам' };

async function fail(interaction, error, where) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    log.error(`[#${code}] ${where} (${interaction.user?.tag}):`, error);
    logger.discord('errors', { title: `Ошибка #${code}`, accent: 'danger', body: `**${where}** · <@${interaction.user?.id}>\n\`\`\`\n${String(error?.stack || error).slice(0, 1500)}\n\`\`\`` });
    try { await ui.replyError(interaction, `Что-то пошло не так. Код ошибки: **#${code}** - передайте его администратору.`); } catch { /* ответить уже нельзя */ }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.inGuild()) {
            if (interaction.isRepliable()) await interaction.reply({ content: 'Бот работает только на сервере.', flags: 64 });
            return;
        }

        // ── Подсказки (автодополнение) ──
        if (interaction.isAutocomplete()) {
            const cmd = client.commands.get(interaction.commandName);
            try { await cmd?.autocomplete?.(interaction); } catch (e) { log.warn(`Автодополнение /${interaction.commandName}: ${e.message}`); }
            return;
        }

        // ── Слэш-команды ──
        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (!cmd) return;
            const sub = interaction.options.getSubcommand(false);
            const access = (sub && cmd.subAccess?.[sub]) || cmd.access || 'everyone';
            if (!canUse(interaction.member, access)) return ui.replyError(interaction, `Команда доступна только ${ACCESS_TEXT[access]}.`);

            if (cmd.cooldown) {
                const key = `${interaction.commandName}:${interaction.user.id}`;
                const left = (cooldowns.get(key) || 0) - Date.now();
                if (left > 0) return ui.replyError(interaction, `Подождите ${Math.ceil(left / 1000)} с.`);
                cooldowns.set(key, Date.now() + cmd.cooldown * 1000);
            }
            log.info(`${interaction.user.tag} → /${interaction.commandName}${sub ? ` ${sub}` : ''}`);
            try { await cmd.execute(interaction); } catch (e) { await fail(interaction, e, `/${interaction.commandName}${sub ? ` ${sub}` : ''}`); }
            return;
        }

        // ── Кнопки, выпадающие списки, формы: customId = "обработчик:арг1:арг2" ──
        if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            const [id, ...args] = interaction.customId.split(':');
            const comp = client.components.get(id) || [...client.components.values()].find((c) => c.aliases?.includes(id));
            if (!comp) return log.debug(`Нет обработчика для ${interaction.customId}`);
            try { await comp.execute(interaction, args, client); } catch (e) { await fail(interaction, e, `компонент ${interaction.customId}`); }
        }
    },
};
