document.addEventListener('DOMContentLoaded', () => {
  // Cross-browser extension API compatibility (Firefox `browser` Promise API + Chrome `chrome` callback API)
  const hasFirefoxBrowser =
    typeof globalThis.browser !== 'undefined' &&
    globalThis.browser &&
    globalThis.browser.storage &&
    globalThis.browser.runtime;
  const rawExt = hasFirefoxBrowser ? globalThis.browser : globalThis.chrome;

  const storageGet = (keys) => {
    if (hasFirefoxBrowser) {
      return Promise.resolve(globalThis.browser.storage.local.get(keys)).then((res) => res || {});
    }
    return new Promise((resolve, reject) => {
      try {
        globalThis.chrome.storage.local.get(keys, (res) => {
          if (globalThis.chrome.runtime?.lastError) {
            reject(globalThis.chrome.runtime.lastError);
          } else {
            resolve(res || {});
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  const storageSet = (items) => {
    if (hasFirefoxBrowser) {
      return Promise.resolve(globalThis.browser.storage.local.set(items));
    }
    return new Promise((resolve, reject) => {
      try {
        globalThis.chrome.storage.local.set(items, () => {
          if (globalThis.chrome.runtime?.lastError) {
            reject(globalThis.chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  const sendRuntimeMessage = (msg) => {
    if (hasFirefoxBrowser) {
      return Promise.resolve(globalThis.browser.runtime.sendMessage(msg));
    }
    return new Promise((resolve, reject) => {
      try {
        globalThis.chrome.runtime.sendMessage(msg, (response) => {
          if (globalThis.chrome.runtime?.lastError) {
            reject(globalThis.chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  const toggle = document.getElementById('flip-toggle');
  const startStopButton = document.getElementById('start-stop-button');

  if (!toggle || !startStopButton) {
    console.error('[Popup] ERROR: Could not find required popup controls!');
    return;
  }

  // Modal elements
  const modal = document.getElementById('session-modal');
  const modalStartButton = document.getElementById('modal-start-button');
  const modalCancelButton = document.getElementById('modal-cancel-button');
  const sessionDurationInput = document.getElementById('session-duration');
  const chimeToggle = document.getElementById('chime-toggle-checkbox');
  const chimeIntervalContainer = document.getElementById('chime-interval-container');
  const chimeIntervalInput = document.getElementById('chime-interval');

  let savedChimeInterval = 0;

  function updatePopup(state) {
    if (state && state.isRunning) {
      startStopButton.textContent = 'Stop Session';
      startStopButton.classList.add('running');
    } else {
      startStopButton.textContent = 'Start Session';
      startStopButton.classList.remove('running');
    }
  }

  function showModal() {
    document.body.classList.add('modal-active');
    const enableChime = Number(savedChimeInterval) > 0;
    chimeToggle.checked = enableChime;
    chimeIntervalContainer.classList.toggle('hidden', !enableChime);
    chimeIntervalInput.value = enableChime ? savedChimeInterval : 20;
    modal.classList.remove('modal-hidden');
  }

  function hideModal() {
    document.body.classList.remove('modal-active');
    modal.classList.add('modal-hidden');
  }

  // Initial state fetch
  storageGet(['isFlipped', 'chimeInterval']).then(data => {
    toggle.checked = Boolean(data.isFlipped);
    if (typeof data.chimeInterval === 'number' && data.chimeInterval >= 0) {
      savedChimeInterval = data.chimeInterval;
      if (data.chimeInterval > 0) {
        chimeIntervalInput.value = data.chimeInterval;
      }
    }
  }).catch(error => {
    console.error('[Popup] Failed to fetch initial storage state:', error);
  });

  function resolveActiveTimerState() {
    return sendRuntimeMessage({ command: 'getTimerState' })
      .catch(() => null)
      .then((response) => {
        if (response && response.isRunning) {
          return response;
        }
        return storageGet(['timerState', 'timerData']).then((stored) => {
          const td = stored && stored.timerData;
          if (stored && stored.timerState === 'running' && td && td.isRunning && Number(td.sessionEndTime) > Date.now()) {
            return td;
          }
          return { isRunning: false };
        });
      })
      .catch(() => ({ isRunning: false }));
  }

  resolveActiveTimerState().then(response => {
    updatePopup(response);
  });

  // Listen for storage changes to keep popup synced
  rawExt.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.isFlipped && changes.isFlipped.newValue !== toggle.checked) {
        toggle.checked = Boolean(changes.isFlipped.newValue);
      }

      if (changes.chimeInterval && typeof changes.chimeInterval.newValue === 'number') {
        savedChimeInterval = changes.chimeInterval.newValue;
      }

      if (changes.timerState || changes.chimeInterval) {
        sendRuntimeMessage({ command: 'getTimerState' }).then(response => {
          updatePopup(response);
        }).catch(() => {});
      }
    }
  });

  // Event listeners
  toggle.addEventListener('change', () => {
    storageSet({ isFlipped: toggle.checked }).catch(error => {
      console.error('[Popup] ERROR setting storage:', error);
    });
  });

  startStopButton.addEventListener('click', () => {
    sendRuntimeMessage({ command: 'getTimerState' }).then(state => {
      if (state && state.isRunning) {
        return sendRuntimeMessage({ command: 'stopTimer' }).then(() => {
          updatePopup({ isRunning: false });
        });
      } else {
        showModal();
      }
    }).catch(error => {
      console.error('[Popup] ERROR getting timer state:', error);
      showModal();
    });
  });

  chimeToggle.addEventListener('change', () => {
    chimeIntervalContainer.classList.toggle('hidden', !chimeToggle.checked);
  });

  modalCancelButton.addEventListener('click', hideModal);

  modalStartButton.addEventListener('click', () => {
    const sessionDuration = parseInt(sessionDurationInput.value, 10);
    if (!isNaN(sessionDuration) && sessionDuration > 0) {
      let newInterval = 0;
      if (chimeToggle.checked) {
        const parsedInterval = parseInt(chimeIntervalInput.value, 10);
        newInterval = !isNaN(parsedInterval) && parsedInterval > 0 ? parsedInterval : 20;
      }
      savedChimeInterval = newInterval;
      storageSet({ chimeInterval: newInterval }).catch(() => {});
      sendRuntimeMessage({
        command: 'startTimer',
        sessionDuration: sessionDuration,
        interval: newInterval
      }).then(() => {
        updatePopup({ isRunning: true });
      }).catch(() => {});
      hideModal();
    }
  });
});

