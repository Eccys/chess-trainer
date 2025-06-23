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
  const flipButton = document.getElementById('board-controls-flip');
  const board = getBoardElement();

  if (!flipButton || !board) {
    return;
  }

  browser.storage.local.get('isFlipped').then(data => {
    const shouldBeFlipped = data.isFlipped || false;
    const isActuallyFlipped = board.classList.contains('flipped');

    if (shouldBeFlipped !== isActuallyFlipped) {
      flipButton.click();
    }
  });
}

const debouncedFlipCheck = debounce(flipBoardIfNeeded, 250);

const observer = new MutationObserver(() => {
  debouncedFlipCheck();
});

function run() {
  setTimeout(flipBoardIfNeeded, 500);

  observer.observe(document.body, { childList: true, subtree: true });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isFlipped) {
      flipBoardIfNeeded();
    }
  });
}

run(); 