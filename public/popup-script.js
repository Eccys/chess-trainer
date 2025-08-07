document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('flip-toggle');
  const startStopButton = document.getElementById('start-stop-button');
  
  console.log('[Popup] DOM loaded, toggle element:', toggle);
  console.log('[Popup] Browser APIs available - browser:', typeof browser, 'browser.storage:', typeof browser?.storage);
  
  if (!toggle) {
    console.error('[Popup] ERROR: Could not find flip-toggle element!');
    return;
  }
  
  // Test storage API immediately
  console.log('[Popup] Testing storage API...');
  browser.storage.local.get('test').then(data => {
    console.log('[Popup] Storage API test successful:', data);
  }).catch(error => {
    console.error('[Popup] Storage API test FAILED:', error);
  });
  
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
    console.log('[Popup] Initial state fetch:', data);
    toggle.checked = data.isFlipped || false;
    console.log('[Popup] Set toggle.checked to:', toggle.checked);
    if (data.chimeInterval) {
      chimeIntervalInput.value = data.chimeInterval;
    }
  });

  browser.runtime.sendMessage({ command: 'getTimerState' }).then(response => {
    updatePopup(response);
  });
  
  // Listen for storage changes to keep popup sync'd
  browser.storage.onChanged.addListener((changes, area) => {
    console.log('[Popup] Storage changed:', { changes, area });
    
    if (area === 'local') {
      if (changes.isFlipped) {
        console.log('[Popup] isFlipped changed:', changes.isFlipped);
        console.log('[Popup] Current toggle state:', toggle.checked);
        // Update toggle if it changed from elsewhere
        if (changes.isFlipped.newValue !== toggle.checked) {
          console.log('[Popup] Updating toggle to match storage:', changes.isFlipped.newValue);
          toggle.checked = changes.isFlipped.newValue;
        }
      }
      
      if (changes.timerState || changes.chimeInterval) {
        browser.runtime.sendMessage({ command: 'getTimerState' }).then(response => {
          updatePopup(response);
        });
      }
    }
  });

  // Event listeners
  toggle.addEventListener('change', () => {
    console.log('[Popup] Toggle changed to:', toggle.checked);
    browser.storage.local.set({ isFlipped: toggle.checked }).then(() => {
      console.log('[Popup] Storage updated with isFlipped:', toggle.checked);
      // Verify the storage was actually set
      browser.storage.local.get('isFlipped').then(data => {
        console.log('[Popup] Verification - storage now contains:', data);
      });
    }).catch(error => {
      console.error('[Popup] ERROR setting storage:', error);
    });
  });

  startStopButton.addEventListener('click', () => {
    console.log('[Popup] Start/Stop button clicked');
    browser.runtime.sendMessage({ command: 'getTimerState' }).then(state => {
      console.log('[Popup] Timer state:', state);
      if (state.isRunning) {
        console.log('[Popup] Stopping timer');
        browser.runtime.sendMessage({ command: 'stopTimer' });
      } else {
        console.log('[Popup] Showing modal');
        showModal();
      }
    }).catch(error => {
      console.error('[Popup] ERROR getting timer state:', error);
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
