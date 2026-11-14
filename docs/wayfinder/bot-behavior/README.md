# Wayfinder tracker (local markdown)

This folder is the issue tracker for the [Smarter bot behaviour](map.md) map.

## Layout

- `map.md`: the map. Loaded once per session.
- `tickets/NN-slug.md`: one file per ticket. The file is the ticket's identity.
- `research/<slug>.md`: findings from research tickets, linked from the ticket.
- `assets/`: prototypes or other artefacts made while resolving a ticket.

## Ticket frontmatter

```yaml
title: <the ticket's name; refer to tickets by this, wrapped in a link>
label: wayfinder:research | wayfinder:prototype | wayfinder:grilling | wayfinder:task
status: open | closed
assignee: <empty = unclaimed>
blocked-by: [<ticket filenames>]
```

## Wayfinding operations

- **Claim**: set `assignee` before doing any work.
- **Frontier**: tickets with `status: open`, empty `assignee`, and every `blocked-by` ticket closed. Find them with `grep -L "status: closed" tickets/*.md`, then check `blocked-by`.
- **Resolve**: append a `## Resolution` section to the ticket, set `status: closed`, and add one line to the map's "Decisions so far".
- **New ticket**: next free number; wire `blocked-by` after the file exists.
- **Out of scope**: close the ticket and add one line to the map's "Out of scope". Do not add it to "Decisions so far".
