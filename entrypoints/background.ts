export default defineBackground(() => {
  let timerId: number | null = null;
  let chimeIntervalId: number | null = null;

  let timerState = {
    isRunning: false,
    sessionEndTime: 0,
    chimeInterval: 20,
    chimeLoopStartTime: 0
  };

  function playChime() {
    const chime = new Audio(browser.runtime.getURL('chime.mp3'));
    chime.play().catch(error => console.error('Chime play failed:', error));
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    if (chimeIntervalId) clearInterval(chimeIntervalId);
    timerId = null;
    chimeIntervalId = null;
    timerState.isRunning = false;
    browser.storage.local.set({ timerState: 'stopped' });
    
    // Notify content script to hide timer
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id!, { command: 'updateTimer', time: 0, isRunning: false });
      }
    });
  }

  function startTimer(sessionDurationMinutes: number, chimeIntervalSeconds: number) {
    stopTimer(); // Ensure any existing timer is stopped

    timerState.isRunning = true;
    timerState.sessionEndTime = Date.now() + sessionDurationMinutes * 60 * 1000;
    timerState.chimeInterval = chimeIntervalSeconds;
    timerState.chimeLoopStartTime = Date.now();
    browser.storage.local.set({ timerState: 'running' });

    // Send an immediate first update to prevent the UI showing "--:--"
    const remainingTimeInitial = Math.round((timerState.sessionEndTime - Date.now()) / 1000);
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id!, {
          command: 'updateTimer',
          time: remainingTimeInitial,
          timeToNextChime: timerState.chimeInterval,
          isRunning: true
        });
      }
    });

    // Main timer loop (every second)
    timerId = setInterval(() => {
      const now = Date.now();
      const remainingTime = Math.round((timerState.sessionEndTime - now) / 1000);
      let timeToNextChime: number | null = null;

      // Calculate time to next chime only if it's enabled
      let timeInCurrentChimeCycle = 0;
      if (timerState.chimeInterval > 0) {
        const timeSinceChimeLoopStart = now - timerState.chimeLoopStartTime;
        timeInCurrentChimeCycle = timeSinceChimeLoopStart % (timerState.chimeInterval * 1000);
        timeToNextChime = timerState.chimeInterval - Math.floor(timeInCurrentChimeCycle / 1000);
      }

      if (remainingTime < 0) {
        stopTimer();
        return;
      }
      
      if (timerState.chimeInterval > 0 && timeInCurrentChimeCycle < 1000) { // Play chime in the first second of a new cycle
          playChime();
      }

      // Send update to content script
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]) {
          browser.tabs.sendMessage(tabs[0].id!, { 
            command: 'updateTimer', 
            time: remainingTime,
            timeToNextChime: timeToNextChime,
            isRunning: true 
          });
        }
      });
    }, 1000);
  }

  browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.set({ 
      isFlipped: false,
      timerState: 'stopped',
      chimeInterval: 20
    });
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === 'startTimer') {
      startTimer(message.sessionDuration, message.interval);
    } else if (message.command === 'stopTimer') {
      stopTimer();
    } else if (message.command === 'getTimerState') {
      sendResponse(timerState);
    }
  });

  browser.storage.onChanged.addListener((changes, area) => {
    // This listener is no longer needed for chimeInterval
  });
});