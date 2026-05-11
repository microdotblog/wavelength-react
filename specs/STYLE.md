# Style

We aim to write code that is a pleasure to read, and we have a lot of opinions about how to do it well. Writing great code is an essential part of our programming culture, and we deliberately set a high bar for every code change anyone contributes. We care about how code reads, how code looks, and how code makes you feel when you read it.

When writing new code, unless you are very familiar with our approach, try to find similar code elsewhere to look for inspiration.

## MobX / MST Conventions
When using MobX in this codebase, prefer `mobx-state-tree` models plus `observer`-wrapped React Native components. We want state code to feel predictable and unsurprising.

### Model the shape of state explicitly

Prefer `mobx-state-tree` models and `flow(function* ...)` actions over plain MobX `makeObservable` or `makeAutoObservable` stores unless an existing area already follows a different pattern.

Put root-level stores in `src/stores/`. Put nested domain models in `src/stores/models/`.

Use `types.optional`, `types.maybeNull`, `types.array`, `types.reference`, and `types.safeReference` intentionally. If a value can be absent, say so in the model. If a relation can disappear, model that honestly.

Use snake_case for observable fields and flags such as `is_loading`, `selected_tag`, and `temp_notebook_name`. Keep store methods action-oriented, for example `fetch_notebooks`, `set_selected_notebook`, or `trigger_notebook_delete`.

### Put derived state in views

Put derived or computed state in MST `.views(...)` instead of storing duplicate booleans, counts, filtered lists, or other values that can be recomputed from source state.

```js
// Bad
const Notebook = types
  .model("Notebook", {
    notes: types.array(Note),
    visible_notes_count: types.optional(types.number, 0),
  })
  .actions(self => ({
    recalculate_visible_notes_count() {
      self.visible_notes_count = self.notes.filter(note => note.is_visible).length
    },
  }))

// Good
const Notebook = types
  .model("Notebook", {
    notes: types.array(Note),
  })
  .views(self => ({
    visible_notes_count() {
      return self.notes.filter(note => note.is_visible).length
    },
  }))
```

If a value can be recomputed from current state, we prefer to recompute it rather than keep it in sync by hand.

### Let actions own mutation

Mutate observable state inside store actions and flows. Components should trigger store methods, not perform cross-store mutations inline.

```js
// Good
onPress={() => Auth.logout_user()}

// Bad
onPress={() => {
  SheetManager.hide("menu-sheet")
  Analytics.track("logout_pressed")
  Auth.logout_user()
}}
```

Keep API clients responsible for transport and payload fetching. Stores and models should own normalization, snapshot application, and observable updates.

Keep React local state for transient UI concerns only. Shared, persisted, or cross-screen state belongs in stores.

### Keep async style consistent

Inside MST `flow(function* ...)`, prefer `yield` consistently and avoid mixing `yield` with `.then(...)` chains in the same action.

```js
// Bad
load_user: flow(function* (id) {
  const user = yield Api.fetch_user(id).then(data => normalize_user(data))
  self.user = user
})

// Good
load_user: flow(function* (id) {
  const data = yield Api.fetch_user(id)
  self.user = normalize_user(data)
})
```

This makes error handling and state transitions easier to follow.

### Persist only the right state

Keep persisted or snapshot-backed state in MST models. Use `.volatile(...)` only for ephemeral runtime state that should not be serialized.

Persist snapshots from the appropriate root store, and debounce persistence work when it can fire frequently. Do not treat `.volatile(...)` state as something to save.

When replacing whole branches of MST state or removing models, prefer MST APIs such as `applySnapshot(...)` and `destroy(...)` over ad hoc deep mutation.

### References should match reality

Prefer `types.safeReference(...)` when a related model can disappear. Use plain `types.reference(...)` only when the target must exist for the model to remain valid.

This keeps references honest. A disappearing record should not leave behind a state shape that looks valid until it explodes later.

### Reactions need cleanup

Any `reaction`, `autorun`, or listener created in a component or store must have an explicit cleanup path.

```js
componentDidMount() {
  this.reaction_disposer = reaction(
    () => Auth.selected_user,
    user => {
      this.setState({ user })
    },
  )
}

componentWillUnmount() {
  if (this.reaction_disposer) {
    this.reaction_disposer()
  }
}
```

If a reactive subscription has no cleanup story, it is not finished.

### Keep store usage consistent

Follow one store access pattern within a feature. By feature, we mean a coherent slice of UI and state such as authentication, notes, bookmarks, or posting.

Do not mix direct store imports, provider wrappers, and ad hoc context layers inside the same feature unless there is a concrete boundary forcing it, such as third-party integration, test harness setup, or a legacy area being migrated in stages.

Wrap screens and components that read observable state with `observer`. Stay consistent with the observer style already used in the surrounding code.

New stateful behavior should be testable at the store level without rendering a screen first.

## Conditional returns

In general, we prefer explicit branches over nested ternaries and mid-function guard clauses.

```js
// Bad
function render_title(note) {
  return note?.title ? note.title : "Untitled"
}

// Good
function render_title(note) {
  if (note?.title) {
    return note.title
  } else {
    return "Untitled"
  }
}
```

This keeps render logic easier to scan, especially once conditions become more involved.

As an exception, guard clauses are fine when they return immediately at the top of a method and remove an invalid state before the main logic begins.

```js
function handle_submit(form) {
  if (!form.can_submit()) {
    return
  }

  if (form.is_editing) {
    form.update()
  } else {
    form.create()
  }
}
```

## Render logic stays shallow

Avoid doing heavy filtering, branching, and transformation inline in JSX. Compute values above the `return` or move them into a small helper method.

```js
// Bad
return items.filter(item => item.visible).map(item => (
  <Row key={item.id} item={item} />
))

// Good
const visible_items = items.filter(item => item.visible)

return visible_items.map(item => (
  <Row key={item.id} item={item} />
))
```

This is especially important in React Native screens, where large render methods become hard to reason about quickly.

## Method ordering

For class components, screens, and store modules, order methods in the sequence a reader experiences them:

1. Public entrypoints and lifecycle methods.
2. Event handlers and public actions.
3. Render helpers or private helpers.
4. `render()` last for class components.

Within each group, prefer vertical ordering by invocation order. If `render()` calls `_render_header()` and `_render_list()`, keep those helpers near `render()` and in the same order they are used. If you keep `render()` last, place the helpers directly above it.

## One async style per layer

We prefer one async style per layer:

- In MST stores, use `flow(function* ...)`.
- In API and utility modules, use `async` / `await`.
- Do not mix `yield`, `await`, and `.then(...)` in the same code path unless there is a strong reason.

This keeps async code easier to debug and makes failure handling more obvious.

## Keep invariants explicit

Use optional chaining when a value is genuinely optional. Do not use `?.` to quietly hide state that should already exist.

```js
// Bad if selected_user must exist here
Auth.selected_user?.posting?.send_post()

// Good
if (Auth.selected_user == null) {
  return
}

Auth.selected_user.posting.send_post()
```

Code reads better when invariants are made explicit rather than implied.

## Event handlers should delegate

UI event handlers should stay thin. They should forward intent to store actions, model methods, or focused helpers instead of owning business logic themselves.

```js
// Good
onPress={() => Auth.logout_user()}

// Bad
onPress={() => {
  SheetManager.hide("menu-sheet")
  Tokens.destroy_token(user.username)
  // More business logic here
}}
```

When an event handler starts coordinating multiple state transitions, it usually wants a named method somewhere else.
