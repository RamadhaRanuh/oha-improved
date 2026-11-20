# Wayfinder tracker (local markdown)

This folder is the issue tracker for the [Patch 7.42 support](map.md) map. Same conventions as [../bot-behavior/README.md](../bot-behavior/README.md).

## Layout

- `map.md`: the map. Loaded once per session.
- `tickets/NN-slug.md`: one file per ticket. The file is the ticket's identity.
- `research/<slug>.md`: findings from research tickets, linked from the ticket.
- `research/data/`: raw inputs every ticket shares (flattened patch notes, d2vpkr hero slots before and after, item and neutral data).

## Ticket frontmatter

```yaml
title: <the ticket's name>
label: wayfinder:research | wayfinder:prototype | wayfinder:grilling | wayfinder:task
status: open | closed
assignee: <empty = unclaimed>
blocked-by: [<ticket filenames>]
```

## Wayfinding operations

- **Claim**: set `assignee` before doing any work.
- **Frontier**: `status: open`, empty `assignee`, every `blocked-by` ticket closed.
- **Resolve**: append `## Resolution`, set `status: closed`, add one line to the map's "Decisions so far".
- **New ticket**: next free number; wire `blocked-by` after the file exists.
- **Out of scope**: close the ticket and add one line to the map's "Out of scope".
