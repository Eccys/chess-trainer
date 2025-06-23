document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('flip-toggle');
  const startStopButton = document.getElementById('start-stop-button');
  
  // Modal elements
  const modal = document.getElementById('session-modal');
  const modalStartButton = document.getElementById('modal-start-button');
  const modalCancelButton = document.getElementById('modal-cancel-button');
  const sessionDurationInput = document.getElementById('session-duration');
  const chimeToggle = document.getElementById('chime-toggle-checkbox');
  const chimeIntervalContainer = document.getElementById('chime-interval-container');
  const chimeIntervalInput = document.getElementById('chime-interval');

  function updatePopup(state) {
    if (state.isRunning) {
      startStopButton.textContent = 'Stop Session';
      startStopButton.classList.add('running');
    } else {
      startStopButton.textContent = 'Start Session';
      startStopButton.classList.remove('running');
    }
  }

  function showModal() {
    document.body.classList.add('modal-active');
    
    // Set chime to be off by default every time modal is opened
    chimeToggle.checked = false;
    chimeIntervalContainer.classList.add('hidden');
    chimeIntervalInput.value = 20; // Reset to default

    modal.classList.remove('modal-hidden');
  }

  function hideModal() {
    document.body.classList.remove('modal-active');
    modal.classList.add('modal-hidden');
  }

  // Initial state fetch
  browser.storage.local.get(['isFlipped', 'chimeInterval']).then(data => {
    toggle.checked = data.isFlipped || false;
    if (data.chimeInterval) {
      chimeIntervalInput.value = data.chimeInterval;
    }
  });

  browser.runtime.sendMessage({ command: 'getTimerState' }, response => {
    updatePopup(response);
  });
  
  // Listen for storage changes to keep popup sync'd
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.timerState || changes.chimeInterval)) {
        browser.runtime.sendMessage({ command: 'getTimerState' }, response => {
            updatePopup(response);
        });
    }
  });

  // Event listeners
  toggle.addEventListener('change', () => {
    browser.storage.local.set({ isFlipped: toggle.checked });
  });

  startStopButton.addEventListener('click', () => {
    browser.runtime.sendMessage({ command: 'getTimerState' }, state => {
      if (state.isRunning) {
        browser.runtime.sendMessage({ command: 'stopTimer' });
      } else {
        showModal();
      }
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
        newInterval = parseInt(chimeIntervalInput.value, 10);
      }
      browser.storage.local.set({ chimeInterval: newInterval });
      browser.runtime.sendMessage({ command: 'startTimer', sessionDuration: sessionDuration, interval: newInterval });
      hideModal();
    }
  });
}); 