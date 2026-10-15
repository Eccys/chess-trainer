export default defineContentScript({
  matches: ["*://www.chess.com/puzzles/*"],
  main: () => {
    const turnIndicatorSelector = 'span.section-heading-title.section-heading-normal';
    let isFlipping = false;
    let timerUI: HTMLElement | null = null;
    let timerDisplay: HTMLElement | null = null;
    let nextChimeDisplay: HTMLElement | null = null;
    let minimizeButton: HTMLElement | null = null;
    let timerHeader: HTMLElement | null = null;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function getBoardElement() {
      return document.querySelector('.board') || document.getElementById('board-layout-chessboard');
    }

    function playChimeAudio() {
      try {
        const chime = new Audio(browser.runtime.getURL('/chime.mp3'));
        chime.play().catch(error => console.error('[Chess Trainer] Chime play failed:', error));
      } catch (error) {
        console.error('[Chess Trainer] Failed to create Audio for chime:', error);
      }
    }

    let pendingFlipCheck = false;
    let pendingTurnText: string | undefined = undefined;
    const observedTurnNodes = new WeakSet<Element>();

    function flipBoardIfNeeded(turnText?: string) {
      if (isFlipping) {
        pendingFlipCheck = true;
        if (turnText !== undefined) {
          pendingTurnText = turnText;
        }
        return;
      }

      const flipButton = document.getElementById('board-controls-flip');
      const board = getBoardElement();

      if (!flipButton || !board) {
        return;
      }

      const effectiveTurnText =
        turnText ?? document.querySelector(turnIndicatorSelector)?.textContent?.trim() ?? '';

      isFlipping = true;

      browser.storage.local.get('isFlipped').then(data => {
        const defensiveModeEnabled = Boolean(data.isFlipped);
        const isActuallyFlipped = board.classList.contains('flipped');

        if (!defensiveModeEnabled) {
          if (isActuallyFlipped) {
            flipButton.click();
          }
        } else {
          let shouldBeFlipped = false;

          if (effectiveTurnText) {
            const lowerTurn = effectiveTurnText.toLowerCase();
            // Fix case-sensitivity bug: match both "to Move" and "to move"
            shouldBeFlipped = lowerTurn.includes('black') && lowerTurn.includes('to move');
          } else {
            shouldBeFlipped = isActuallyFlipped;
          }

          if (shouldBeFlipped !== isActuallyFlipped) {
            flipButton.click();
          }
        }
      }).catch(err => {
        console.error('[Chess Trainer] Storage read failed:', err);
      });

      setTimeout(() => {
        isFlipping = false;
        if (pendingFlipCheck) {
          const nextText = pendingTurnText;
          pendingFlipCheck = false;
          pendingTurnText = undefined;
          flipBoardIfNeeded(nextText);
        }
      }, 500);
    }

    function observeTurnIndicator(turnIndicatorNode: Element) {
      if (observedTurnNodes.has(turnIndicatorNode)) {
        return;
      }
      observedTurnNodes.add(turnIndicatorNode);

      const handleTurnChange = (node: Element) => {
        const newText = node.textContent?.trim() || '';

        if (newText.toLowerCase().includes('to move')) {
          flipBoardIfNeeded(newText);
        }
      };

      const observer = new MutationObserver(() => {
        handleTurnChange(turnIndicatorNode);
      });

      observer.observe(turnIndicatorNode, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      handleTurnChange(turnIndicatorNode);
    }

    function createTimerUI() {
      timerUI = document.createElement('div');
      timerUI.id = 'chess-trainer-timer';
      timerUI.innerHTML = `
        <div id="chess-trainer-timer-header">
          <span>Session Timer</span>
          <button id="chess-trainer-minimize-button">-</button>
        </div>
        <div id="chess-trainer-timer-display">--:--</div>
        <div id="chess-trainer-next-chime">Next chime in: --s</div>
      `;
      document.body.appendChild(timerUI);

      timerHeader = document.getElementById('chess-trainer-timer-header');
      timerDisplay = document.getElementById('chess-trainer-timer-display');
      nextChimeDisplay = document.getElementById('chess-trainer-next-chime');
      minimizeButton = document.getElementById('chess-trainer-minimize-button');

      timerHeader?.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      minimizeButton?.addEventListener('click', toggleMinimize);

      const style = document.createElement('style');
      style.innerHTML = `
        #chess-trainer-timer {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 200px;
          background-color: #2c2c2c;
          color: #f0f0f0;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          z-index: 10000;
          display: none;
          user-select: none;
          flex-direction: column;
        }
        #chess-trainer-timer-header {
          padding: 8px 12px;
          background-color: #3e3e3e;
          cursor: move;
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
        }
        #chess-trainer-minimize-button {
          background: none;
          border: none;
          color: #f0f0f0;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          line-height: 1;
        }
        #chess-trainer-timer-display {
          padding: 20px;
          font-size: 36px;
          text-align: center;
          font-weight: 300;
          padding-top: 10px;
        }
        #chess-trainer-next-chime {
          font-size: 12px;
          text-align: center;
          color: #a0a0a0;
          padding-bottom: 10px;
        }
        #chess-trainer-timer.minimized #chess-trainer-timer-display,
        #chess-trainer-timer.minimized #chess-trainer-next-chime {
          display: none;
        }
      `;
      document.head.appendChild(style);

      browser.storage.local.get(['timerState', 'timerData']).then(data => {
        if (data.timerState === 'running') {
          showTimer();
          const td = data.timerData;
          if (td && typeof td.sessionEndTime === 'number' && td.sessionEndTime > Date.now()) {
            const remaining = Math.max(0, Math.round((td.sessionEndTime - Date.now()) / 1000));
            updateTimerDisplay(remaining, null);
          }
        }
      });
    }

    function showTimer() {
      if (timerUI) timerUI.style.display = 'block';
    }

    function hideTimer() {
      if (timerUI) timerUI.style.display = 'none';
    }

    function updateTimerDisplay(time: number | null, timeToNextChime: number | null) {
      if (time !== null && time >= 0) {
        const minutes = Math.floor(time / 60).toString().padStart(2, '0');
        const seconds = (time % 60).toString().padStart(2, '0');
        if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds}`;
      }
      if (nextChimeDisplay) {
        if (timeToNextChime !== null && timeToNextChime > 0) {
          nextChimeDisplay.textContent = `Next chime in: ${timeToNextChime}s`;
          nextChimeDisplay.style.display = 'block';
        } else {
          nextChimeDisplay.style.display = 'none';
        }
      }
    }

    function toggleMinimize() {
      if (timerUI) timerUI.classList.toggle('minimized');
    }

    function onMouseDown(e: MouseEvent) {
      if ((e.target as HTMLElement)?.id === 'chess-trainer-minimize-button') return;
      e.preventDefault();
      isDragging = true;
      if (timerUI) {
        offsetX = e.clientX - timerUI.offsetLeft;
        offsetY = e.clientY - timerUI.offsetTop;
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (isDragging && timerUI) {
        e.preventDefault();
        timerUI.style.right = 'auto';
        timerUI.style.left = `${e.clientX - offsetX}px`;
        timerUI.style.top = `${e.clientY - offsetY}px`;
      }
    }

    function onMouseUp() {
      isDragging = false;
    }

    function run() {
      createTimerUI();

      const existingTurnIndicator = document.querySelector(turnIndicatorSelector);
      if (existingTurnIndicator) {
        observeTurnIndicator(existingTurnIndicator);
      }

      const elementFinderObserver = new MutationObserver(() => {
        const turnIndicatorNode = document.querySelector(turnIndicatorSelector);
        if (turnIndicatorNode && !observedTurnNodes.has(turnIndicatorNode)) {
          observeTurnIndicator(turnIndicatorNode);
        }
      });

      if (document.body) {
        elementFinderObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }

      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.isFlipped) {
          flipBoardIfNeeded();
        }

        if (changes.timerState) {
          if (changes.timerState.newValue === 'running') {
            showTimer();
          } else {
            hideTimer();
          }
        }
      });

      browser.runtime.onMessage.addListener((message) => {
        if (message && message.command === 'updateTimer') {
          if (message.playChime) {
            playChimeAudio();
          }
          if (message.isRunning) {
            showTimer();
            updateTimerDisplay(message.time, message.timeToNextChime ?? null);
          } else {
            hideTimer();
          }
        }
      });
    }

    run();
  }
});