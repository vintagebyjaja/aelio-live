# AELIO dashboard benchmark (sample project)

This is an isolated sample app for AELIO's first coding benchmark. It is not a Grooveville production application.

## Assignment
> Create a simple responsive dashboard component that displays system status, recent activity, and three performance metrics.

## Contract
Create `src/dashboard.js` that exports:

```js
export function renderDashboard(data) -> string   // HTML markup
```

`data` has this shape (see `src/data.js`):

```js
{ status:   { state: "operational" | "degraded" | "down", message: string, updatedAt: string },
  activity: [ { time: string, text: string } ],          // show up to 5, newest first
  metrics:  [ { label: string, value: number, unit: string } ] }  // exactly 3 shown
```

## Acceptance criteria
These are enforced by the protected suite `dashboard_benchmark_v1`, which the coding engine cannot edit.
1. Exports `renderDashboard`; the file passes `node --check`.
2. Shows the status state and message inside an element with `data-section="status"`.
3. Shows recent activity as `<li>` items inside `data-section="activity"` (at most 5). When the list is empty, shows "No recent activity".
4. Shows exactly three metric cards, each with a `data-metric` attribute, its label, and its value.
5. Escapes user-supplied text, so it is safe against HTML injection.
6. Is responsive: no horizontal overflow at 375px or 1280px. Metric cards sit in one row at 1280px and stack at 375px.
