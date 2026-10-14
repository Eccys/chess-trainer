document.addEventListener('DOMContentLoaded', () => {
  // Cross-browser extension API compatibility (Firefox `browser` + Chrome `chrome`)
  const rawExt = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;

  const storageGet = (keys) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = rawExt.storage.local.get(keys, (res) => {
          if (rawExt.runtime?.lastError) {
            reject(rawExt.runtime.lastError);
          } else {
            resolve(res || {});
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });

  const storageSet = (items) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = rawExt.storage.local.set(items, () => {
          if (rawExt.runtime?.lastError) {
            reject(rawExt.runtime.lastError);
          } else {
            resolve();
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });

  const sendRuntimeMessage = (msg) =>
    new Promise((resolve, reject) => {
      try {
        const maybePromise = rawExt.runtime.sendMessage(msg, (response) => {
          if (rawExt.runtime?.lastError) {
            reject(rawExt.runtime.lastError);
          } else {
            resolve(response);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });

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
    chimeToggle.checked = false;
    chimeIntervalContainer.classList.add('hidden');
    chimeIntervalInput.value = 20;
    modal.classList.remove('modal-hidden');
  }

  function hideModal() {
    document.body.classList.remove('modal-active');
    modal.classList.add('modal-hidden');
  }

  // Initial state fetch
  storageGet(['isFlipped', 'chimeInterval']).then(data => {
    toggle.checked = Boolean(data.isFlipped);
    if (data.chimeInterval) {
      chimeIntervalInput.value = data.chimeInterval;
    }
  }).catch(error => {
    console.error('[Popup] Failed to fetch initial storage state:', error);
  });

  sendRuntimeMessage({ command: 'getTimerState' }).then(response => {
    updatePopup(response);
  }).catch(() => {
    updatePopup({ isRunning: false });
  });

  // Listen for storage changes to keep popup synced
  rawExt.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.isFlipped && changes.isFlipped.newValue !== toggle.checked) {
        toggle.checked = Boolean(changes.isFlipped.newValue);
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
