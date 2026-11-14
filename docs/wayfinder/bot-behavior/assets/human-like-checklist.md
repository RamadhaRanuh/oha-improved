# Human-like checklist

Asset for [What human-like looks like, behaviour by behaviour](../tickets/04-what-human-like-looks-like-behaviour-by-behaviour.md). Written 2026-11-13.

Each item can be ticked by watching a game: in the spectator view, from a hero's camera, or from a replay. Score each item **Yes**, **Sometimes** or **No** for the team under test. Items marked **(tell)** describe a bot-like behaviour, so for those **No** is the good answer.

The checklist is the second success measure, next to win rate. It is scored for the baseline once, during the Phase 0 baseline observation in the spec, and again after each stage's confirmation run.

## Attack and fight

1. Several bots hit the same enemy hero in a fight, and switch together when that hero dies or escapes.
2. A bot keeps attacking its target rather than switching every second or two.
3. Bots stop chasing a hero that is clearly escaping (more than about 5 s of chasing without closing in, or into enemy fog or tower range).
4. A ranged bot fights from near its maximum range instead of walking up to melee distance.
5. Bots go in together. One hero commits, and the others follow within about 2 s or not at all.
6. **(tell)** A lone bot walks into two or more enemies and dies without the team moving to help or backing off.
7. **(tell)** A bot keeps attacking a hero under Blade Mail, Borrowed Time or Aeon Disk.
8. **(tell)** Bots stand still, or move back and forth, for more than 1 s during a fight.

## Laning

1. Cores take most of the last hits in their lane, and supports do not take a last hit a core next to them could have taken.
2. Bots deny allied creeps when they are not busy with a last hit.
3. Bots trade hits with the enemy laner when it is safe to: in range, few enemy creeps nearby, and not losing on health.
4. After hitting an enemy hero, a bot steps back so the enemy creeps lose interest.
5. The wave stays near the middle of the lane or near the bot's own tower. Bots do not right-click creeps that are not last hits and push the wave into the enemy tower.
6. A bot drops tower aggro or backs out when an enemy tower targets it.
7. **(tell)** A bot jitters in place, re-issuing tiny moves several times a second.
8. **(tell)** A bot stands at the lane front while being hit by an enemy hero and does nothing.

## Farming

1. Each core has its own farming area (a lane or a group of camps). Two cores rarely farm the same spot.
2. Supports do not take lane farm while a core is nearby.
3. Bots stop farming far lanes when several enemies have been missing from the map for a while.
4. **(tell)** A bot farms alone in the enemy half while the rest of the team is fighting.

## Defend

1. The number of bots that come to defend matches the threat: one or two for a lone pusher, everyone for a five-man push.
2. Defenders arrive together rather than one at a time.
3. **(tell)** All five bots leave their lanes to defend against one creep wave.

## Push

1. Bots push together after a won fight, an enemy death, or a Roshan kill.
2. Bots back off from a push when several enemies are missing and their own position is not covered by vision.
3. **(tell)** Bots push into high ground and lose several heroes without killing a building.
4. **(tell)** A single bot pushes deep alone in the late game and dies.

## Retreat

1. A bot that is about to die backs off before it reaches the last few percent of health.
2. Retreating bots move away from where enemies are, not in a straight line through them.
3. When the team backs off from a fight, all of it backs off rather than one or two bots.
4. **(tell)** A bot leaves an even fight at about half health, and the team loses the fight because of it.
5. **(tell)** A bot walks back to lane at low health and dies again within 30 s.

## Roam and gank

1. Ganks arrive in a lane where an enemy hero is out of position (far from its tower, or low on health).
2. A gank is called off when the target backs off or disappears.
3. **(tell)** A bot walks across the map to gank a lane and arrives after the target has left.

## Team coordination

1. The team looks like it has a plan: it groups for objectives at sensible times and spreads out to farm otherwise.
2. When a teammate is jumped nearby, other bots react within about 1 s.
3. **(tell)** Different bots on the same team are clearly doing contradictory things, for example one starting a fight while two others walk away.

## Overall feel

1. Reactions are not instant. A bot reacts to a blink-in or a stun after a short, human-sized delay instead of on the same frame.
2. Bots behave somewhat differently from game to game.
3. **(tell)** Bots switch what they are doing so often that their movement looks indecisive.
