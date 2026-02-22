
# Insert Academic Program into event_activities

## Overview

Insert all 39 sessions for the XIII Congreso Nacional de Farmacia Hospitalaria across 3 days into the `event_activities` table, linked to event `5efca36a-deef-489b-be85-3dc9d1501ed7`.

## Data Mapping

The `activity_type` column uses lowercase English values to match the SessionCard component's border color mapping:
- "Conferencia" -> `conference`
- "Taller" -> `workshop`
- "Receso" -> `break`
- "Plenaria" -> `plenary`

The `requires_checkin` column maps to `has_certificate` (true for Conferencia/Taller, false for Receso/Plenaria).

## Sessions Count

| Day | Date | Sessions |
|---|---|---|
| Day 1 | 2026-04-23 | 13 sessions |
| Day 2 | 2026-04-24 | 20 sessions |
| Day 3 | 2026-04-25 | 6 sessions |
| **Total** | | **39 sessions** |

## Execution

A single SQL INSERT statement will add all 39 rows to `event_activities` using the Supabase insert tool. After insertion, navigate to the Agenda page to verify all 3 days display correctly with the day selector and session cards.

## Technical Details

Each row includes:
- `event_id`: `5efca36a-deef-489b-be85-3dc9d1501ed7`
- `title`: Session name as provided
- `scheduled_date`: `2026-04-23`, `2026-04-24`, or `2026-04-25`
- `start_time` / `end_time`: Time range
- `location`: Room/area
- `speaker_name`: Speaker with country (null for breaks/registration)
- `activity_type`: `conference`, `workshop`, `break`, or `plenary`
- `requires_checkin`: true for conference/workshop, false for break/plenary

No schema changes needed -- this is purely a data insert operation.
