'use strict';

const chalk = require('chalk');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function createLogger(level = 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function log(levelName, color, prefix, ...args) {
    if (LEVELS[levelName] < threshold) return;
    const line = `${chalk.gray(new Date().toISOString())} ${color(prefix)}`;
    console.log(line, ...args);
  }

  return {
    debug: (...args) => log('debug', chalk.gray, '[debug]', ...args),
    info: (...args) => log('info', chalk.cyan, '[info] ', ...args),
    warn: (...args) => log('warn', chalk.yellow, '[warn] ', ...args),
    error: (...args) => log('error', chalk.red, '[error]', ...args),
    success: (...args) => log('info', chalk.green, '[ ok ] ', ...args),
  };
}

module.exports = { createLogger };
