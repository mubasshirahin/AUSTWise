/**
 * Boot-log buffer.
 *
 * Module imports print (OAuth warnings, Prisma connect, …) before the server
 * is ready, so the startup banner would never be "on top". This module patches
 * console.* from the FIRST import so every early message is captured, then the
 * startup banner prints, and drainBootLogs() replays them in order.
 *
 * Must be imported before any other server module that logs at import time.
 */

const original = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
};

const buffer = [];
let draining = false;

function capture(level, args) {
  if (draining) {
    original[level](...args);
    return;
  }
  buffer.push({ level, args });
}

console.log = (...args) => capture('log', args);
console.warn = (...args) => capture('warn', args);
console.error = (...args) => capture('error', args);
console.info = (...args) => capture('info', args);

/**
 * Replay every captured boot message in order, then stop buffering so any
 * later message (async seeds, requests, …) prints straight to the console.
 */
export function drainBootLogs() {
  draining = true;
  const pending = buffer.splice(0);
  for (const entry of pending) {
    original[entry.level](...entry.args);
  }
}

/** Print directly without buffering — used for the banner itself. */
export const rawConsole = {
  log: (...args) => original.log(...args),
  warn: (...args) => original.warn(...args),
  error: (...args) => original.error(...args),
};