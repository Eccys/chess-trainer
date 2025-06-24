export default defineContentScript({
  matches: ["*://www.chess.com/puzzles/learning"],
  main: () => {
    let isFlipping = false;
    let timerUI: HTMLElement | null = null;
    let timerDisplay: HTMLElement | null = null;
    let nextChimeDisplay: HTMLElement | null = null;
    let minimizeButton: HTMLElement | null = null;
    let timerHeader: HTMLElement | null = null;
    let isDragging = false;
    let offsetX: number, offsetY: number;

    function getBoardElement() {
      return document.querySelector('.board') || document.getElementById('board-layout-chessboard');
    }

    function flipBoardIfNeeded() {
      console.log('[Chess Trainer] Flip Check: Starting...');
      if (isFlipping) {
        console.log('[Chess Trainer] Flip Check: Aborted (already flipping).');
        return;
      }

      const flipButton = document.getElementById('board-controls-flip');
      const board = getBoardElement();

      if (!flipButton || !board) {
        console.log('[Chess Trainer] Flip Check: Aborted (board or button not found).');
        return;
      }

      isFlipping = true;
      console.log('[Chess Trainer] Flip Check: Lock acquired.');

      browser.storage.local.get('isFlipped').then(data => {
        const shouldBeFlipped = data.isFlipped || false;
        const isActuallyFlipped = board.classList.contains('flipped');
        console.log(`[Chess Trainer] Flip Check: Should be flipped? ${shouldBeFlipped}. Is it actually flipped? ${isActuallyFlipped}.`);

        if (shouldBeFlipped !== isActuallyFlipped) {
          console.log('[Chess Trainer] Flip Check: Mismatch detected. Clicking flip button.');
          flipButton.click();
        } else {
          console.log('[Chess Trainer] Flip Check: Board is in the correct state.');
        }
      });

      setTimeout(() => {
        isFlipping = false;
        console.log('[Chess Trainer] Flip Check: Lock released.');
      }, 500);
    }

    function observeTurnIndicator(turnIndicatorNode: Element) {
      let lastTurnText = '';
      console.log('[Chess Trainer] Observer: Now watching turn indicator.', turnIndicatorNode);

      const handleTurnChange = (node: Element) => {
        const newText = node.textContent?.trim() || '';
        console.log(`[Chess Trainer] Observer: Turn indicator text changed to "${newText}".`);

        if (newText.includes('to Move')) {
          if (newText !== lastTurnText) {
            console.log(`[Chess Trainer] Observer: New turn detected ("${newText}"). Triggering flip check.`);
            lastTurnText = newText;
            flipBoardIfNeeded();
          } else {
            console.log(`[Chess Trainer] Observer: Turn reverted to the same state ("${newText}"). Ignoring flip.`);
          }
        } else {
          console.log(`[Chess Trainer] Observer: Text is not a turn indicator (e.g., "Correct"). Ignoring.`);
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

      // Initial check in case the script loads after the indicator is already there
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
          display: none; /* Hidden by default */
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

      // Check initial state
      browser.storage.local.get('timerState').then(data => {
        if (data.timerState === 'running') {
          showTimer();
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
      if (time !== null) {
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
        timerUI.style.left = `${e.clientX - offsetX}px`;
        timerUI.style.top = `${e.clientY - offsetY}px`;
      }
    }

    function onMouseUp() {
      isDragging = false;
    }

    function run() {
      console.log('[Chess Trainer] Content script loaded.');

      createTimerUI();

      const turnIndicatorSelector = 'span.section-heading-title.section-heading-normal';

      const elementFinderObserver = new MutationObserver((mutations, observer) => {
        const turnIndicatorNode = document.querySelector(turnIndicatorSelector);
        if (turnIndicatorNode) {
          console.log('[Chess Trainer] Observer: Found turn indicator element.');
          observer.disconnect();
          observeTurnIndicator(turnIndicatorNode);
        }
      });

      elementFinderObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.isFlipped) {
          console.log('[Chess Trainer] Observer: Storage change detected from popup.');
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

      browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.command === 'updateTimer') {
          if (message.isRunning) {
            showTimer();
            updateTimerDisplay(message.time, message.timeToNextChime);
          } else {
            hideTimer();
          }
        }
      });
    }

    run();
  }
});