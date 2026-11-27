# Paths

Paths are the long-running areas of a life: Writer, Engineer, Money, Body. Each path answers two questions at a glance:

- **Am I showing up?** Its *signal*, built from stats the user already logs, gives every week a strength.
- **Where is it going?** Its *milestones*, each the end of one project, sit ahead on the road with their checkpoints.

Paths get a page of their own, `/paths`, drawn as roads in a dark vortex. The agreed look is in [paths-sketch.html](paths-sketch.html). Open it in a browser; the Writer path uses a real book plan and everything else is example data.

## Model

```
Path ── Signal (exactly one) ── Inputs (one or more stats)
  │
  └── Milestones (ordered) ── each the end of exactly one Project
                                   └── Checkpoints (each with a target metric)
                                         └── Tasks
```

### Path

| Field | Notes |
|---|---|
| name, colour, icon | Colour is the road's colour, in the past and on milestone rings. |
| displayOrder | "My order" on the Paths page. |
| paused | A paused road is drawn dimmed. Paths never end. |

A path cannot exist without a signal. Creating a path means choosing at least one input.

### Signal and inputs

A signal turns several inputs into one **strength** per week. Each input points at a stat and says what "doing well" means for it.

| Input field | Values |
|---|---|
| statDefinitionId | Any stat or sub stat (sub stats are their own definitions). |
| valueSource | `VALUE`, or one of the stat's additional input types, such as `DURATION`. |
| direction | `MORE_IS_BETTER` or `LESS_IS_BETTER`. Defaults from the stat's morality. Both kinds make the road brighter when the user does well. |
| period | `DAY` or `WEEK`: what the target is per. |
| target | A number in the stat's unit: 4 (times), 120 (g), 2 (h). |
| scoring | How a week is scored; see below. |
| weight | Used by the weighted average. Default 1. |

**Scoring a week for one input.** The user picks one per input:

| Period | Scoring | Week score | Example |
|---|---|---|---|
| WEEK | `TIMES` | days with a qualifying entry ÷ target | Gym 4 times a week |
| WEEK | `TOTAL` | sum of values ÷ target | Words, 2,600 a week |
| DAY | `DAYS_MET` | days meeting the target ÷ 7 | Protein at least 120 g a day |
| DAY | `AVERAGE` | mean of each day's value ÷ target | Protein, partial days count |

For `LESS_IS_BETTER` inputs the comparisons flip: a day is met when its value is at or under the target, `AVERAGE` scores each day as target ÷ value, and `TOTAL` scores target ÷ sum. A day with a value of 0 counts as fully met.

A "qualifying entry" for `TIMES` is a logged day whose value is non-zero (yes for yes/no stats), or meets the stat's good threshold when it has one.

**Unlogged days** follow the stat's existing "include unlogged days as zero" setting. When it is off, unlogged days are left out of `AVERAGE` and never count as met for `DAYS_MET` or `TIMES`.

**Exceptional weeks.** Scores are capped at **1.25**, not 1. A score of 1 is a fully kept week; scores between 1 and 1.25 draw a little brighter, so exceptional weeks stand out without one great week hiding several weak ones.

**Combining inputs into the signal.** Chosen per signal:

| Method | Strength |
|---|---|
| `AVERAGE` | Weighted mean of the input scores. |
| `WEAKEST` | The lowest input score. |
| `ALL_MET` | Fraction of inputs scoring at least 1. When all are met: 1 plus the mean of the inputs' excess over 1, capped at 1.25. |

**Weeks** run Sunday to Saturday, like the rest of the app, using the user's local dates as stats do. The current week is judged against how much of it has passed: weekly targets are multiplied by elapsed days ÷ 7, and daily methods use only the elapsed days. Thursday with 2 of 4 gym sessions is nearly on pace.

History is computed from existing stat entries, so a newly created path shows its past immediately.

### Milestone

A milestone is the end of a project. It is one-to-one with its project and gets almost everything from it.

| Field | Notes |
|---|---|
| pathId | |
| projectId | Unique. Creating a milestone creates its project. |
| targetDate | Optional. Only where the ring sits on the road. It has no effect on whether the milestone is done; finishing early is fine. A milestone without a date is drawn in the Someday zone. |
| displayOrder | Order along the path. |

Name, progress and status come from the project. A milestone is **done** when its project is marked done, or when all of its checkpoints are done, whichever comes first.

### Project

Existing entity, gaining:

| Field | Notes |
|---|---|
| completedAt | Set when the user marks it done, or when its last checkpoint completes. |

There are no existing projects to migrate. Every project belongs to exactly one milestone.

### Checkpoint

A dated step inside a project. Every checkpoint must have a target metric; that is the point of it.

| Field | Notes |
|---|---|
| projectId | |
| name | "Act II done" |
| targetDate | Optional, like a milestone's. |
| displayOrder | |
| metric: statDefinitionId, valueSource | The stat measured, such as the words sub stat. |
| metric: aggregation | `SUM` (total since `countFrom`), `COUNT_DAYS` (logged days since `countFrom`), or `LATEST` (most recent value, for things like a savings balance). |
| metric: countFrom | Date counting starts. Defaults to the project's creation date. |
| metric: baseline | Added to `SUM` and `COUNT_DAYS`, for progress made before logging started: the 70.1k words already written. |
| metric: targetValue | Reached when the metric gets there (or falls to it, for less-is-better stats). |
| completedAt | Set automatically when the target is reached. |

### Task

Gains an optional `checkpointId`. A task either belongs to no project at all, or to a project through one of its checkpoints. Tasks are never linked to paths directly; a task's path is checkpoint → project → milestone → path.

## The Paths page

Route `/paths`, with its own nav item. A path's detail page is `/paths/:pathId`, under the same first path segment so the page stays mounted when moving between them.

**Header.** "This week, N of M paths are on pace" (on pace means the current week's strength is at least 1), one dot per path coloured by reinforcement (green on pace, through yellow, to orange), and three switches: sort, road shape, road edges.

**The vortex.** A dark panel taking the full height below the header, always dark in both themes, with a faint spiral that stays still while the roads scroll over it. It scrolls both ways:

- **Vertically through time.** Future above, past below. It opens with today a little below the middle; a Today button returns there. Month labels run down a column pinned to the left; the Today pill sits at today's line, and a month label that would collide with it moves aside.
- **Sideways through paths.** Roads are spread evenly across the width, each in an equal share; with too many for the width, the vortex scrolls sideways. Each path's name, icon, signal summary and 4-week strength chip are pinned at the top of its column.

**A road.**

- One continuous curve for past and future, so nothing kinks or breaks at today. Two dashed walls run its whole length.
- **Past:** the walls are in the path's own colour. Their strength follows the week: full colour in a kept week, greyer and fainter as strength drops, a faint grey dash for a week with nothing. Only weeks at strength 1 or more get a slight glow; exceptional weeks glow a little more. Colour carries the signal and glow is used sparingly.
- **Centre line:** one white dash per past week, its opacity following the same strength. Hovering a dash brightens it and shows a small label, "Week of Nov 16 · 3 of 4" (per input when there are several). Nothing else on the road shows a label on hover.
- **Today:** a plain dot in the path's colour (no outline), glowing slightly only once the current week is on pace, with the week's count beside it.
- **Future:** muted grey with a hint of the path's colour, brighter up to the active milestone, fading towards Someday. The road narrows into the distance. It shows only milestones and checkpoints.
- **Milestones:** thick rings around the road, labelled with name, progress and date. Done milestones below today are rings in the path's colour with the same thick border, labelled with a ✓. Undated milestones sit in the Someday zone.
- **Checkpoints:** ticks across the road; hover shows name, date and metric progress.
- **Pace marker:** where a checkpoint or milestone has a stat metric, a small orange marker shows when the current pace would reach it, if that is later than the date.

**Switches**, saved as user preferences:

| Switch | Options |
|---|---|
| Sort | Needs attention (weakest 4-week strength first), Strongest, My order (drag a column's header to reorder; sets `displayOrder`). Columns slide to their new places. |
| Shape | Curved, Straight. |
| Edges | Follow weeks (walls vary with strength, as above), Constant (walls stay at one strength in the path's colour, no glow; only the centre line varies). |

Reinforcement colours (green, yellow, orange) appear only in the header dots and strength chips, never on the roads.

## The path page

`/paths/:pathId`, in this order:

1. **Signal:** each input with its target and its recent weeks, and the combined strength.
2. **Milestones** in order, with status and progress.
3. **The active project:** a timeline of its checkpoints (the Ribbon from the project mockups) and progress against plan, with the pace projection.

Creating and editing paths, signals, milestones and checkpoints happens from here and from the Paths page.

## Backend

New package `org.osama.path`, following the usual entity / repository / service / controller pattern. Checkpoints live in `project/`.

| Endpoint | Purpose |
|---|---|
| `GET/POST/PATCH/DELETE /api/v1/paths` | Paths. Creating requires a signal with at least one input. |
| `PUT /api/v1/paths/{id}/signal` | Replace the signal: combine method and inputs. |
| `POST/PATCH/DELETE /api/v1/paths/{id}/milestones` | Milestones. POST creates the project too. |
| `POST/PATCH/DELETE /api/v1/projects/{id}/checkpoints` | Checkpoints. |
| `GET /api/v1/paths/overview?from&to` | Everything the Paths page draws: per path, weekly strengths with per-input scores, the current week, milestones and checkpoints with progress, and pace projections. |
| `GET /api/v1/paths/{id}` | The path page. |
| `POST /api/v1/paths/signal-preview` | How an unsaved signal would have scored the last 8 weeks, for the editor. |
| `PUT /api/v1/paths/order` | "My order": path ids in their new order. |
| `PUT /api/v1/paths/view` | The page switches (sort, shape, edges), kept in their own `path_view_preference` table rather than the user preferences. |

Read endpoints take `today`, the user's local date, so weeks follow their calendar. The path table is `life_path` (PostgreSQL has a built-in `path` type).

Scoring is pure and unit-tested on its own: an input-scoring function (entries, input, week → score), a combining function (scores, method → strength) and a checkpoint-progress function. The overview service only loads entries and calls them.

Liquibase changesets add `life_path`, `path_signal`, `path_signal_input`, `milestone` and `checkpoint`, plus `project.completed_at` and `task.checkpoint_id`. Indexes are named `idx_app_<table>_<column>` with `ifNotExists: true`.

## Frontend

- The overview loads through `useRevalidatingResource` and the app heartbeat, merged with `keepUnchanged`, so the page shows cached roads at once and refreshes quietly.
- Road geometry and the time scale (curve, width, week and month positions) live in a pure layout module with colocated tests. So does the mapping from strength to wall colour, opacity, glow and centre-line opacity.
- The vortex is SVG per column with a canvas background, as in the sketch.
- Component tests render the page against the fake backend (`src/test/fakeBackend.ts`).
- Desktop local mode works unchanged since it runs the same backend. Mobile is out of scope for now.

## Phases

1. **Paths and signals.** Path, signal and inputs; scoring; the overview endpoint with past weeks only; the Paths page with roads, centre line, today and the three switches; creating and editing a path and its signal with a stat picker and a preview of recent weeks.
2. **Milestones and checkpoints.** Milestones, project completion, checkpoints with metrics, tasks under checkpoints; the future road, rings, ticks and Someday; done milestones in the past.
3. **The path page and pace.** The path page, the checkpoint timeline and progress view, and pace markers.

## Not now

Activities and calendar chunks as signal inputs; planned chunks or recurring tasks on the future road; mobile.

## Assumptions to confirm

- A task inside a project always belongs to one of its checkpoints. (Tasks can still belong to no project.)
- A checkpoint is done when its metric reaches the target, even if some of its tasks are still open.
- The existing Projects page keeps working as a place to work through a project's tasks, now grouped by checkpoint; new projects are created as milestones on a path.
