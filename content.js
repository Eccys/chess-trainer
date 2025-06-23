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

function processBoard() {
  browser.storage.local.get('isFlipped').then(data => {
    if (!data.isFlipped) {
      return;
    }

    const board = document.querySelector('.board, #board-layout-chessboard');
    const flipButton = document.getElementById('board-controls-flip');

    if (!board || !flipButton) {
      return;
    }

    if (board.dataset.boardFlipperApplied) {
      return;
    }

    flipButton.click();
    board.dataset.boardFlipperApplied = 'true';
  });
}

const debouncedProcessBoard = debounce(processBoard, 250);
const observer = new MutationObserver(debouncedProcessBoard);

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.isFlipped && changes.isFlipped.newValue === true) {
    const board = document.querySelector('.board, #board-layout-chessboard');
    if (board) {
      delete board.dataset.boardFlipperApplied;
    }
    processBoard();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

debouncedProcessBoard(); 