# House Five Ludo architecture boundary

This repository implements the first microfrontend candidate from the House Five architecture decision record dated 2 October 2026.

## Ownership

Ludo owns game UI, rooms, matches, rules, moves, matchmaking/realtime behavior, and future game-specific data. House Five core remains the canonical source for users, household membership, roles, authentication, and non-game household features.

## Current mode

Version 0.1.0 is a standalone functional local game. It supports a lobby, room code, bots, dice rolls, piece movement, captures, safe squares, home lanes, victory, and selectable house rules. Local game state is stored in `localStorage` so this repo can be tested without changing House Five or requiring production secrets.

## Future multiplayer contract

When this module is connected to House Five, the host should route `/ludo` (or `/games/ludo`) to this deployment. The server must validate the existing House Five session and derive `userId`, `houseId`, and permissions server-side.

Suggested server endpoints:

- `POST /api/ludo/rooms` - create a room
- `POST /api/ludo/rooms/:id/join` - join room after membership validation
- `GET /api/ludo/rooms/:id` - authoritative room/match snapshot
- `POST /api/ludo/rooms/:id/roll` - authoritative server dice roll
- `POST /api/ludo/rooms/:id/move` - validate and persist a move
- `POST /api/ludo/rooms/:id/leave`

Suggested module-owned tables: `ludo_rooms`, `ludo_players`, `ludo_matches`, `ludo_moves`, `ludo_rule_sets`.

For real multiplayer, random dice values and move validation must be server-authoritative. Browser-generated rolls are acceptable only for standalone/local preview mode.
