let isFlipping = false;

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function getBoardElement() {
  return document.querySelector('.board') || document.getElementById('board-layout-chessboard');
}

function flipBoardIfNeeded() {
  console.log('Flip Check: Starting...');
  if (isFlipping) {
    console.log('Flip Check: Aborted (already flipping).');
    return;
  }

  const flipButton = document.getElementById('board-controls-flip');
  const board = getBoardElement();

  if (!flipButton || !board) {
    console.log('Flip Check: Aborted (board or button not found).');
    return;
  }

  isFlipping = true;
  console.log('Flip Check: Lock acquired.');

  browser.storage.local.get('isFlipped').then(data => {
    const shouldBeFlipped = data.isFlipped || false;
    const isActuallyFlipped = board.classList.contains('flipped');
    console.log(`Flip Check: Should be flipped? ${shouldBeFlipped}. Is it actually flipped? ${isActuallyFlipped}.`);

    if (shouldBeFlipped !== isActuallyFlipped) {
      console.log('Flip Check: Mismatch detected. Clicking flip button.');
      flipButton.click();
    } else {
      console.log('Flip Check: Board is in the correct state.');
    }
  });

  setTimeout(() => {
    isFlipping = false;
    console.log('Flip Check: Lock released.');
  }, 500);
}

const debouncedFlipCheck = debounce(flipBoardIfNeeded, 250);

const observer = new MutationObserver((mutations) => {
  console.log('Observer: Detected page change.');
  debouncedFlipCheck();
});

function run() {
  console.log('Defensive Mode: Content script loaded.');
  setTimeout(flipBoardIfNeeded, 500);

  observer.observe(document.body, { childList: true, subtree: true });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isFlipped) {
      console.log('Observer: Storage change detected.');
      flipBoardIfNeeded();
    }
  });
}

run(); 