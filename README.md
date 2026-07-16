# Food Tracker

A small always-on-top desktop widget for logging meals and weight, with macros estimated
by a local LLM (Ollama) and optionally refined against real USDA nutrition data. Includes
an MCP server so Claude (Desktop or Code) can read, add, edit, and analyze your food log
directly.

## Folder structure

```
Food Tracker/
├── Food Tracker.command   # Double-click launcher (builds on first run, then starts the app)
├── app/                   # The Electron + React widget
│   ├── electron/
│   │   ├── main.ts        # Electron main process: window, tray, IPC handlers
│   │   ├── preload.ts     # Exposes a safe window.foodTracker API to the UI
│   │   ├── db/index.ts    # SQLite schema + queries (meals, weight_logs, settings)
│   │   ├── macros.ts      # Talks to Ollama to estimate/split macros per meal item
│   │   └── fdc.ts         # Optional USDA FoodData Central lookup for real nutrient data
│   ├── src/
│   │   ├── App.tsx        # Widget UI: category tabs, entry form, totals, settings panel
│   │   ├── main.tsx       # React entry point
│   │   ├── index.css      # Glassmorphic styling (tunable via CSS variables)
│   │   └── foodTracker.d.ts # Types for the window.foodTracker bridge
│   ├── .env.example       # Copy to .env and fill in your own FDC API key
│   └── package.json
└── mcp-server/            # Standalone MCP server (stdio) — same DB as the app
    ├── src/
    │   ├── index.ts       # MCP server: tool definitions (add_meal, get_day_log, etc.)
    │   └── db.ts           # Same SQLite schema/queries, used independently of the app
    └── package.json
```

Both `app/` and `mcp-server/` read and write the **same** SQLite database at
`~/FoodTrackerData/data.db` (created automatically on first run). This file is *not* part
of the repo — it's your personal data and lives outside the project directory.

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.com), running locally, with a model pulled (this project defaults
  to `qwen2.5:7b`):
  ```
  ollama pull qwen2.5:7b
  ```
- (Optional) A free [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup)
  if you want macro estimates refined against real nutrition data instead of relying purely
  on the LLM's guess.

## Setup

```bash
# 1. Install dependencies
cd app && npm install
cd ../mcp-server && npm install

# 2. Configure your FDC API key (optional — the app works without it, FDC lookup just stays off)
cd ../app
cp .env.example .env
# edit .env and set FDC_API_KEY=your_key_here

# 3. Build both packages
npm run build
cd ../mcp-server && npm run build
```

## Running the widget

**Easiest**: double-click `Food Tracker.command` at the project root. It builds the app on
first run (if needed) and launches it.

**Manually**:
```bash
cd app
npm run start     # production build, no dev server — use this for daily use
# or
npm run dev       # dev mode with hot reload, for making changes
```

The widget is a frameless, always-on-top, draggable window with a tray icon (click the tray
icon or use its menu to show/hide or quit). Its position and size are remembered between
launches.

### Using the widget

- Pick a category tab (Breakfast / Lunch / Dinner / Other), type what you ate — free text,
  e.g. `"3 eggs, a roasted chicken drumstick, a can of redbull, 5 sticks of celery"` — and
  hit Add. The description is split into individual items, each estimated separately, and
  today's totals update automatically.
- The ⚖ button logs a weight entry for today.
- The ⚙ button opens settings: toggle "Use USDA FoodData Central lookup" to refine macro
  estimates with real nutrition data (requires the API key from setup), and view/edit that
  key.

## Connecting the MCP server to Claude

The MCP server (`mcp-server/dist/index.js`) exposes tools to read/add/edit meals, log
weight, and analyze trends — usable from Claude Code, Claude Desktop, or both, since they
each just spawn the same local process.

**Claude Code:**
```bash
claude mcp add --scope user food-tracker -- node "/absolute/path/to/Food Tracker/mcp-server/dist/index.js"
```

**Claude Desktop:** add this to `~/Library/Application Support/Claude/claude_desktop_config.json`
(merge into the existing `mcpServers` object if you already have other servers configured),
then fully quit and reopen Claude Desktop:
```json
{
  "mcpServers": {
    "food-tracker": {
      "command": "node",
      "args": ["/absolute/path/to/Food Tracker/mcp-server/dist/index.js"]
    }
  }
}
```

Available tools: `add_meal`, `edit_meal`, `delete_meal`, `get_day_log`, `log_weight`,
`get_weight_history`, `analyze_range`.

Note: the widget only refreshes its own view every ~10 seconds (or when it regains focus),
so changes made through Claude may take a moment to appear if the widget is already open.

## Notes on secrets

- The only secret this project uses is the USDA FDC API key, kept in `app/.env` (gitignored,
  never committed — `app/.env.example` is the template that *is* committed).
- All personal data (meal logs, weight history) lives in `~/FoodTrackerData/data.db`, outside
  this repo, and is never committed.
