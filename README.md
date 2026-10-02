# House Five Ludo

Realtime multiplayer Ludo microfrontend for House Five.

**Version:** 0.4.0

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
