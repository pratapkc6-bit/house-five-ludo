# House Five Ludo

Full-screen Nepali-inspired Ludo microfrontend for the House Five platform.

**Version:** 0.2.1

This repository remains independent from the main `house-five` repo. Version 0.2.0 is prepared to be reverse-proxied by House Five at `/ludo` while keeping game code and deployment isolated.

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
- Canonical Vercel asset base so the UI works when reverse-proxied behind House Five `/ludo`\n- Optional `player` display-name launch context and safe same-origin return handling

## Local verification

```bash
npm run check
python3 -m http.server 4174
```

Open `http://localhost:4174`.

## Important multiplayer boundary

Version 0.2.1 still uses local browser state. In the connected version, dice rolls, room membership, and move validation must become server-authoritative. See `ARCHITECTURE.md`.
