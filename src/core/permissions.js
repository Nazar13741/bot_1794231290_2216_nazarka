// Проверка прав:
//   админ   - всё, включая назначение кураторов;
//   куратор - создаёт персонажей игрокам и редактирует анкеты/статы (/char create, /char redact);
//   мастер  - опыт (/give_xp).
const { PermissionFlagsBits } = require('discord.js');
const { config } = require('./config');

function hasRole(member, ids = []) {
    return !!member?.roles?.cache && ids.some((id) => member.roles.cache.has(id));
}

function isAdmin(member) {
    if (!member) return false;
    if (hasRole(member, config.permissions.adminRoleIds)) return true;
    return config.permissions.discordAdminsAreAdmins && member.permissions?.has(PermissionFlagsBits.Administrator);
}

/** Куратор анкет: админ, роль/ID из конфига или назначенный через /curator */
function isCurator(member) {
    if (!member) return false;
    if (isAdmin(member)) return true;
    if (hasRole(member, config.permissions.curatorRoleIds)) return true;
    const userId = member.id || member.user?.id;
    if ((config.permissions.curatorUserIds || []).includes(userId)) return true;
    const guildId = member.guild?.id;
    return !!guildId && require('../services/curators').has(guildId, userId);
}

function isMaster(member) {
    return isAdmin(member) || hasRole(member, config.permissions.masterRoleIds);
}

/** Уровни доступа команд: 'everyone' | 'master' | 'curator' | 'admin' */
function canUse(member, level = 'everyone') {
    if (level === 'admin') return isAdmin(member);
    if (level === 'curator') return isCurator(member);
    if (level === 'master') return isMaster(member);
    return true;
}

module.exports = { isAdmin, isCurator, isMaster, canUse };
