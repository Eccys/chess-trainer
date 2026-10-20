import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function stripTypeScript(tsSource) {
  return tsSource
    .replace(/^export\s+default\s+/m, 'globalThis.__exported = ')
    .replace(/:\s*ReturnType<typeof\s+setInterval>\s*\|\s*null/g, '')
    .replace(/payload:\s*\{[\s\S]*?\}/g, 'payload')
    .replace(/new\s+WeakSet<Element>\(\)/g, 'new WeakSet()')
    .replace(/\((e\.target)\s+as\s+HTMLElement\)/g, '($1)')
    .replace(/(\w+)\?\s*:\s*(?:string|number|boolean|Element|MouseEvent|HTMLElement)(?:\s*\|\s*(?:null|undefined))*/g, '$1')
    .replace(/(\w+)\s*:\s*(?:string|number|boolean|Element|MouseEvent|HTMLElement)(?:\s*\|\s*(?:null|undefined))*/g, '$1');
}

describe('chess-trainer background service worker (entrypoints/background.ts)', () => {
  it('restores running timer on MV3 wakeup before answering getTimerState and preserves active timer on update', async () => {
    const bgSource = fs.readFileSync(path.join(rootDir, 'entrypoints', 'background.ts'), 'utf8');
    const jsCode = stripTypeScript(bgSource);

    const futureEnd = Date.now() + 600_000;
    const storageMap = {
      timerState: 'running',
      timerData: {
        isRunning: true,
        sessionEndTime: futureEnd,
        chimeInterval: 15,
        chimeLoopStartTime: Date.now() - 5000,
        lastChimeCycle: 0
      }
    };

    const installedListeners = [];
    const messageListeners = [];
    const activeIntervals = [];

    const context = vm.createContext({
      console,
      Date,
      Math,
      Number,
      Boolean,
      Promise,
      setInterval: (fn, ms) => {
        const id = { fn, ms };
        activeIntervals.push(id);
        return id;
      },
      clearInterval: (id) => {
        const idx = activeIntervals.indexOf(id);
        if (idx !== -1) activeIntervals.splice(idx, 1);
      },
      defineBackground: (fn) => fn,
      browser: {
        storage: {
          local: {
            get: async (keys) => {
              await new Promise((r) => setTimeout(r, 10));
              const out = {};
              for (const k of Array.isArray(keys) ? keys : [keys]) {
                out[k] = storageMap[k];
              }
              return out;
            },
            set: async (items) => {
              Object.assign(storageMap, items);
            }
          }
        },
        tabs: {
          query: async () => [],
          sendMessage: async () => {}
        },
        runtime: {
          getURL: (p) => `chrome-extension://id${p}`,
          onInstalled: {
            addListener: (fn) => installedListeners.push(fn)
          },
          onMessage: {
            addListener: (fn) => messageListeners.push(fn)
          }
        }
      }
    });

    vm.runInContext(jsCode, context);
    context.__exported();

    // Immediately query getTimerState before async storage.get resolves
    const stateResponse = await new Promise((resolve) => {
      const keepOpen = messageListeners[0]({ command: 'getTimerState' }, {}, resolve);
      assert.equal(keepOpen, true);
    });
    assert.equal(stateResponse.isRunning, true);
    assert.equal(stateResponse.sessionEndTime, futureEnd);
    assert.equal(stateResponse.chimeInterval, 15);

    // Trigger onInstalled with reason 'update' and verify running timer is NOT overwritten
    installedListeners[0]({ reason: 'update' });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(storageMap.timerState, 'running');

    // Stop timer via message
    await new Promise((resolve) => {
      messageListeners[0]({ command: 'stopTimer' }, {}, resolve);
    });
    assert.equal(storageMap.timerState, 'stopped');
    assert.equal(activeIntervals.length, 0);
  });
});

describe('chess-trainer content script (entrypoints/content.ts)', () => {
  it('flips board for case-insensitive Black to Move, queues flip checks during cooldown, and tracks replaced turn nodes', async () => {
    const contentSource = fs.readFileSync(path.join(rootDir, 'entrypoints', 'content.ts'), 'utf8');
    const jsCode = stripTypeScript(contentSource);

    let isFlippedStorage = true;
    let boardFlipped = false;
    let flipClicks = 0;

    let currentTurnNode = {
      textContent: 'Black to move'
    };

    const flipButton = {
      click: () => {
        flipClicks++;
        boardFlipped = !boardFlipped;
      }
    };
    const boardEl = {
      classList: {
        contains: (cls) => cls === 'flipped' && boardFlipped
      }
    };

    const mutationCallbacks = [];
    class MockMutationObserver {
      constructor(cb) {
        this.cb = cb;
        mutationCallbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    }

    const timeoutQueue = [];
    const elementsById = new Map([['board-controls-flip', flipButton]]);

    const makeEl = () => ({
      id: '',
      innerHTML: '',
      textContent: '',
      style: {},
      classList: { toggle: () => {}, contains: () => false },
      addEventListener: () => {}
    });

    const context = vm.createContext({
      console,
      Date,
      Math,
      Number,
      Boolean,
      Promise,
      WeakSet,
      MutationObserver: MockMutationObserver,
      setTimeout: (fn, ms) => {
        timeoutQueue.push({ fn, ms });
        return timeoutQueue.length;
      },
      defineContentScript: (cfg) => cfg,
      document: {
        body: { appendChild: () => {} },
        head: { appendChild: () => {} },
        createElement: () => makeEl(),
        addEventListener: () => {},
        getElementById: (id) => elementsById.get(id) || makeEl(),
        querySelector: (sel) => {
          if (sel === '.board') return boardEl;
          if (sel === 'span.section-heading-title.section-heading-normal') return currentTurnNode;
          return null;
        }
      },
      browser: {
        storage: {
          local: {
            get: async (key) => {
              if (key === 'isFlipped') return { isFlipped: isFlippedStorage };
              return { timerState: 'stopped' };
            }
          },
          onChanged: { addListener: () => {} }
        },
        runtime: {
          getURL: (p) => p,
          onMessage: { addListener: () => {} }
        }
      }
    });

    vm.runInContext(jsCode, context);
    context.__exported.main();
    await new Promise((r) => setTimeout(r, 10));

    // Initial "Black to move" should flip board once
    assert.equal(flipClicks, 1);
    assert.equal(boardFlipped, true);

    // While in 500ms cooldown, turn changes to "White to Move" -> queued
    currentTurnNode.textContent = 'White to Move';
    mutationCallbacks[0]();
    assert.equal(flipClicks, 1); // Still locked by cooldown

    // Flush the 500ms cooldown timer -> queued check executes and un-flips board
    const cooldown = timeoutQueue.shift();
    cooldown.fn();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(flipClicks, 2);
    assert.equal(boardFlipped, false);

    // Flush second cooldown
    timeoutQueue.shift().fn();

    // Simulate chess.com replacing the turn indicator node on next puzzle
    currentTurnNode = { textContent: 'Black to Move' };
    // Trigger body elementFinderObserver (second observer registered)
    mutationCallbacks[1]();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(flipClicks, 3);
    assert.equal(boardFlipped, true);
  });
});

describe('chess-trainer popup script (public/popup-script.js)', () => {
  it('uses 1-arg Firefox browser Promise APIs and preserves chimeInterval across storage events', async () => {
    const popupSource = fs.readFileSync(path.join(rootDir, 'public', 'popup-script.js'), 'utf8');

    let domReadyHandler = null;
    const elements = new Map();
    const getEl = (id) => {
      if (!elements.has(id)) {
        const listeners = {};
        const classes = new Set(id === 'session-modal' ? ['modal-hidden'] : []);
        elements.set(id, {
          id,
          checked: false,
          value: '20',
          textContent: '',
          classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            toggle: (c, force) => {
              if (force === undefined) {
                classes.has(c) ? classes.delete(c) : classes.add(c);
              } else if (force) {
                classes.add(c);
              } else {
                classes.delete(c);
              }
            },
            contains: (c) => classes.has(c)
          },
          addEventListener: (ev, fn) => {
            listeners[ev] = fn;
          },
          trigger: (ev) => listeners[ev] && listeners[ev]()
        });
      }
      return elements.get(id);
    };

    const getCalls = [];
    const context = vm.createContext({
      console,
      Date,
      Number,
      Boolean,
      Promise,
      parseInt,
      isNaN,
      document: {
        body: getEl('body'),
        addEventListener: (ev, fn) => {
          if (ev === 'DOMContentLoaded') domReadyHandler = fn;
        },
        getElementById: (id) => getEl(id)
      },
      browser: {
        storage: {
          local: {
            get: function (...args) {
              getCalls.push(args.length);
              return Promise.resolve({
                isFlipped: true,
                chimeInterval: 30,
                timerState: 'running',
                timerData: { isRunning: true, sessionEndTime: Date.now() + 60_000 }
              });
            },
            set: () => Promise.resolve()
          },
          onChanged: { addListener: () => {} }
        },
        runtime: {
          sendMessage: function (...args) {
            assert.equal(args.length, 1);
            // Simulate cold service worker returning isRunning: false so storage fallback is tested
            return Promise.resolve({ isRunning: false });
          }
        }
      }
    });
    context.globalThis = context;

    vm.runInContext(popupSource, context);
    domReadyHandler();
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(getCalls.every((len) => len === 1), 'Firefox browser.storage.local.get must be called with 1 argument');
    assert.equal(getEl('flip-toggle').checked, true);
    assert.equal(getEl('chime-interval').value, 30);
    assert.equal(getEl('start-stop-button').textContent, 'Stop Session');
  });

  it('declares storage, activeTab, and chess.com/puzzles permissions in wxt.config.ts', () => {
    const wxtConfig = fs.readFileSync(path.join(rootDir, 'wxt.config.ts'), 'utf8');
    assert.match(wxtConfig, /storage/);
    assert.match(wxtConfig, /activeTab/);
    assert.match(wxtConfig, /chess\.com\/puzzles/);
  });
});
