import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: "Chess Trainer",
    version: "2.5",
    description: "Enhances chess.com puzzles with an optional auto-flip 'defensive mode' and a configurable session timer with chimes. Inspired by chesspage1's course!",
    permissions: [
      "storage",
      "activeTab",
      "tabs"
    ],
    host_permissions: [
      "https://www.chess.com/puzzles/learning*"
    ],
    action: {
      default_popup: "popup.html",
      default_icon: {
        "16": "icon-16.png",
        "48": "icon-48.png"
      }
    },
    icons: {
      "48": "icon-48.png",
      "128": "icon-128.png"
    },
    web_accessible_resources: [
      {
        resources: ["chime.mp3"],
        matches: ["*://www.chess.com/*"]
      }
    ]
  }
});