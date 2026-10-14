export default defineBackground(() => {
  let timerId: ReturnType<typeof setInterval> | null = null;

  let timerState = {
    isRunning: false,
    sessionEndTime: 0,
    chimeInterval: 20,
    chimeLoopStartTime: 0
  };

  function playFallbackChime() {
    if (typeof Audio !== 'undefined') {
      try {
        const chime = new Audio(browser.runtime.getURL('/chime.mp3'));
        chime.play().catch(error => console.error('Chime play failed:', error));
      } catch (error) {
        console.error('Audio initialization failed:', error);
      }
    }
  }

  async function broadcastTimerUpdate(payload: {
    command: 'updateTimer';
    time: number;
    timeToNextChime?: number | null;
    isRunning: boolean;
    playChime?: boolean;
  }) {
    let deliveredToContentScript = false;
    try {
      const puzzleTabs = await browser.tabs.query({ url: '*://www.chess.com/puzzles/*' });
      const targetTabs = puzzleTabs.length > 0
        ? puzzleTabs
        : await browser.tabs.query({ active: true, currentWindow: true });

      await Promise.all(
        targetTabs.map(async (tab) => {
          if (tab.id != null) {
            try {
              await browser.tabs.sendMessage(tab.id, payload);
              deliveredToContentScript = true;
            } catch {
              // Content script may not be injected on non-puzzle tabs
            }
          }
        })
      );
    } catch (error) {
      console.warn('[Background] Failed to query tabs for timer update:', error);
    }

    if (payload.playChime && !deliveredToContentScript) {
      playFallbackChime();
    }
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    timerState.isRunning = false;
    timerState.sessionEndTime = 0;
    browser.storage.local.set({ timerState: 'stopped', timerData: timerState });

    void broadcastTimerUpdate({
      command: 'updateTimer',
      time: 0,
      timeToNextChime: null,
      isRunning: false
    });
  }

  function startTimer(sessionDurationMinutes: number, chimeIntervalSeconds: number) {
    stopTimer(); // Ensure any existing timer is stopped

    const durationMins = Number(sessionDurationMinutes) > 0 ? Number(sessionDurationMinutes) : 20;
    const intervalSecs = Number(chimeIntervalSeconds) >= 0 ? Number(chimeIntervalSeconds) : 0;
    const now = Date.now();

    timerState.isRunning = true;
    timerState.sessionEndTime = now + durationMins * 60 * 1000;
    timerState.chimeInterval = intervalSecs;
    timerState.chimeLoopStartTime = now;
    browser.storage.local.set({ timerState: 'running', timerData: timerState });

    // Send an immediate first update to prevent the UI showing "--:--"
    const remainingTimeInitial = Math.round((timerState.sessionEndTime - now) / 1000);
    void broadcastTimerUpdate({
      command: 'updateTimer',
      time: remainingTimeInitial,
      timeToNextChime: timerState.chimeInterval > 0 ? timerState.chimeInterval : null,
      isRunning: true,
      playChime: false
    });

    // Main timer loop (every second)
    timerId = setInterval(() => {
      const currentNow = Date.now();
      const remainingTime = Math.round((timerState.sessionEndTime - currentNow) / 1000);
      let timeToNextChime: number | null = null;

      if (remainingTime < 0) {
        stopTimer();
        return;
      }

      const elapsedMs = currentNow - timerState.chimeLoopStartTime;
      let shouldPlayChime = false;

      if (timerState.chimeInterval > 0) {
        const cycleMs = timerState.chimeInterval * 1000;
        const timeInCurrentChimeCycle = elapsedMs % cycleMs;
        timeToNextChime = timerState.chimeInterval - Math.floor(timeInCurrentChimeCycle / 1000);
        if (elapsedMs >= cycleMs && timeInCurrentChimeCycle < 1000) {
          shouldPlayChime = true;
        }
      }

      void broadcastTimerUpdate({
        command: 'updateTimer',
        time: remainingTime,
        timeToNextChime,
        isRunning: true,
        playChime: shouldPlayChime
      });
    }, 1000);
  }

  browser.runtime.onInstalled.addListener((details) => {
    console.log('[Background] Extension installed/updated:', details);

    if (details.reason === 'install') {
      browser.storage.local.set({
        isFlipped: false,
        timerState: 'stopped',
        chimeInterval: 20,
        timerData: timerState
      });
    } else {
      browser.storage.local.set({
        timerState: 'stopped',
        timerData: timerState
      });
    }
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.command !== 'string') return false;

    if (message.command === 'startTimer') {
      startTimer(message.sessionDuration, message.interval);
      sendResponse({ ok: true, timerState });
      return false;
    } else if (message.command === 'stopTimer') {
      stopTimer();
      sendResponse({ ok: true, timerState });
      return false;
    } else if (message.command === 'getTimerState') {
      sendResponse(timerState);
      return false;
    }
    return false;
  });
});