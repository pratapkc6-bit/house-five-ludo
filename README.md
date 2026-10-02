# House Five Ludo

Realtime multiplayer Ludo microfrontend for House Five.

**Version:** 0.4.3

## Multiplayer v1

Housemate mode now uses the authenticated House Five backend:

- Create a secure room with a six-character code
- Join from another signed-in House Five device
- Up to four approved housemates
- Host-controlled match start
- Server-generated dice
- Server-validated moves, captures, safe squares, home lanes and wins
- Persistent Neon/Postgres room and match state
- House Five realtime long-poll updates
- Refresh/reconnect recovery
- Presence indicator based on recent room activity
- Leave room and reconnect support

Bot mode remains local for instant offline play.

Open Ludo through House Five at `/ludo` for authenticated multiplayer. Direct standalone deployment is intended for frontend preview and bot play.

## Proxy integration note

Multiplayer API and session requests are pinned to `location.origin` so House Five authentication continues to work even though Ludo static assets use the standalone deployment as their document base.

- Host-controlled rematch after a completed online game.

## v0.4.3 reliability fix

Housemate multiplayer now uses the dedicated House Five `/api/ludo` endpoint instead of the generic `/api/app` action router. This prevents the room flow from surfacing unrelated `Unknown House Five action` errors and keeps create/join/state/realtime commands in one versioned API.
