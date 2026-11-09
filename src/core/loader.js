// Автоматически загружает команды, события и компоненты из папок.
// Просто положите новый файл в нужную папку - он подхватится сам.
const fs = require('node:fs');
const path = require('node:path');
const log = require('./logger').child('Загрузчик');

function jsFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return jsFiles(p);
        return e.name.endsWith('.js') && !e.name.startsWith('_') ? [p] : [];
    });
}

function loadCommands(client) {
    for (const file of jsFiles(path.join(__dirname, '..', 'commands'))) {
        try {
            const cmd = require(file);
            if (!cmd.data || !cmd.execute) { log.warn(`Пропущен ${path.basename(file)}: нет data/execute`); continue; }
            client.commands.set(cmd.data.name, cmd);
            log.debug(`Команда /${cmd.data.name}`);
        } catch (e) { log.error(`Ошибка загрузки команды ${file}:`, e); }
    }
    log.info(`Загружено команд: ${client.commands.size}`);
}

function loadComponents(client) {
    for (const file of jsFiles(path.join(__dirname, '..', 'components'))) {
        try {
            const comp = require(file);
            client.components.set(comp.id, comp);
        } catch (e) { log.error(`Ошибка загрузки компонента ${file}:`, e); }
    }
    log.info(`Загружено обработчиков кнопок/форм: ${client.components.size}`);
}

function loadEvents(client) {
    let n = 0;
    for (const file of jsFiles(path.join(__dirname, '..', 'events'))) {
        try {
            const ev = require(file);
            const handler = (...args) => Promise.resolve(ev.execute(...args, client))
                .catch((e) => log.error(`Ошибка в событии ${ev.name}:`, e));
            client[ev.once ? 'once' : 'on'](ev.name, handler);
            n++;
        } catch (e) { log.error(`Ошибка загрузки события ${file}:`, e); }
    }
    log.info(`Загружено событий: ${n}`);
}

module.exports = { loadCommands, loadComponents, loadEvents };
