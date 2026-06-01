# Visual Research Board

> Drag images from any browser tab → manually taxonomy them → explore as a multi-dimensional graph.

A desktop research tool built with **Tauri 2.0 + React 19** and a **Chrome Extension (WXT)**.

---

## What it does

1. **Capture** — Drag any image from Chrome, right-click → "Capture", or screenshot a region
2. **Taxonomy** — Instantly tag it across multiple axes (Mood, Style, Color, Project, custom...)
3. **Visualize** — Switch between Grid, 2D Force Graph, and 3D Galaxy views
4. **Explore** — Filter by tags → graph re-layouts in real-time

---

## Views

| View | Description |
|------|-------------|
| **Grid** | Filterable thumbnail grid, grouped by taxonomy |
| **Graph 2D** | Force-directed graph — images as nodes, edges = shared tags |
| **Galaxy 3D** | Three.js depth view — constellations per project/mood |
| **Axis View** | Pick 2 taxonomy axes as X/Y — images spread across the plane |

---

## Repo structure

```
visual-research-board/
├── apps/
│   ├── desktop/          # Tauri 2.0 + React 19 app
│   └── extension/        # WXT Chrome Extension (MV3)
├── docs/
│   ├── RESEARCH.md       # Tech stack deep research & decisions
│   ├── ARCHITECTURE.md   # System architecture & data flow
│   ├── DATABASE.md       # SQLite schema & query patterns
│   └── UI_DESIGN.md      # Visual design system & component spec
└── README.md
```

---

## Quick start (coming soon)

```bash
# Install dependencies
pnpm install

# Run desktop app (dev)
pnpm --filter desktop tauri dev

# Run extension (dev)
pnpm --filter extension dev
```

---

## Documentation

- [Tech Stack Research](./docs/RESEARCH.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE.md)
- [UI Design System](./docs/UI_DESIGN.md)
