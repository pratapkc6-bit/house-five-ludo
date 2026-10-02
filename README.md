# House Five Ludo

Full-screen Nepali-inspired Ludo microfrontend for the House Five platform.

**Version:** 0.1.0

This repository is deliberately independent from the main `house-five` repo. The main application has not been modified.

## Included now

- Proper 15x15 full-screen Ludo board
- Room creation and waiting lobby
- Quick play with three bots
- Working animated dice roll
- Four pieces per player, entry on six, full track, coloured home lanes, and finish
- Capture logic and safe squares
- Extra-turn rules, three-sixes rule, exact finish, and protected-stack option
- Selectable custom house rules
- Responsive mobile layout designed to keep the board as the visual focus
- Nepali-inspired House Five visual treatment
- Local persistence for testing without production infrastructure
- `/api/health` endpoint
- `/ludo` and `/games/ludo` compatibility for future House Five rewrites

## Local verification

```bash
npm run check
python3 -m http.server 4174
```

Open `http://localhost:4174`.

## Important multiplayer boundary

Version 0.1.0 uses local browser state. In the connected version, dice rolls, room membership, and move validation must become server-authoritative. See `ARCHITECTURE.md`.
