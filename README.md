# Chess.com Puzzle Helper

A modern browser extension that enhances chess.com puzzles with an optional auto-flip 'defensive mode' and a configurable session timer with chimes. Inspired by chesspage1's course!

Built with [WXT](https://wxt.dev) for modern development and cross-browser compatibility.

## Features

- **Defensive Mode**: Automatically flips the board when doing puzzles to practice from the defensive perspective
- **Session Timer**: Configurable timer with visual display for focused practice sessions
- **Audio Chimes**: Optional periodic chimes to help maintain focus during study sessions
- **Modern UI**: Clean, dark-themed popup interface

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or pnpm

### Setup

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd chess-flipper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development Commands

```bash
# Start development server (Chrome)
npm run dev

# Start development server (Firefox)
npm run dev:firefox

# Build for production
npm run build

# Build for Firefox
npm run build:firefox

# Create distribution ZIP
npm run zip

# Create Firefox distribution ZIP
npm run zip:firefox
```

## Installation

### For Development

1. Run `npm run build` to build the extension
2. Open your browser's extension management page:
   - **Chrome**: Navigate to `chrome://extensions/`
   - **Firefox**: Navigate to `about:debugging#/runtime/this-firefox`
3. Enable "Developer mode" (Chrome) or click "Load Temporary Add-on" (Firefox)
4. Load the extension from `.output/chrome-mv3/` (Chrome) or `.output/firefox-mv2/` (Firefox)

### For Production

Download the latest release from the releases page and install through your browser's extension store or load as an unpacked extension.

## How to Use

1. Navigate to `https://www.chess.com/puzzles/learning`
2. Click on the extension's icon in the toolbar
3. Toggle "Defensive Mode" to automatically flip the board for each puzzle
4. Use "Start Session" to begin a timed practice session with optional chimes

## Project Structure

```
├── entrypoints/
│   ├── background.ts      # Background service worker
│   ├── content.ts         # Content script for chess.com
│   └── popup.html         # Extension popup interface
├── public/                # Static assets (icons, audio)
├── wxt.config.ts         # WXT configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Migration from Legacy Extension

This extension has been migrated from a traditional Firefox extension to use WXT. See [MIGRATION.md](./MIGRATION.md) for detailed information about the migration process and benefits.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Please check the license file for details. 