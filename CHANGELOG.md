# Changelog

All notable changes to TM Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-09-11

### Changed

- `injectButton()` mounts a copy at **every** anchor the page offers instead
  of picking one. On an issue that means next to Edit and, once GitLab mounts
  its condensed `[data-testid="work-item-sticky-header"]`, next to that
  header's own Edit too. Copies past the first get a derived id
  (`<id>--sticky`), so the caller's own id still finds the main one.
- `placement` defaults back to `'header'`. `'topbar'` still gives a single
  copy in the fixed breadcrumb bar.
- `onPage()`'s string `guard` now means "this button id is mounted at every
  anchor" rather than "this element exists". Finding the header copy used to
  be enough to skip the callback, which left the sticky header without one.
  `guard` also accepts a function.

### Added

- `getActionBarAnchors(placement)`, `isButtonMounted(id, placement)` and
  `buttonIdFor(id, key)`.
- Selector keys `stickyHeader`, `editButton` and `editButtonSticky`.

### Notes

The sticky header follows a scroll-up-to-reveal pattern: it appears when you
scroll back up, not on the way down, and GitLab destroys it when it hides. The
copy is re-injected on its own each time it comes back, from the same
MutationObserver `onPage()` already uses.

## [1.3.0] - 2026-09-11

### Fixed

- **Injected buttons disappeared on scroll.** The work item header is not
  sticky: it leaves the viewport as you scroll, taking anything injected into
  it along — the same thing happens to GitLab's own Edit button. The node was
  never removed, it just stopped being visible.

### Changed

- `injectButton()` now defaults to `placement: 'topbar'`, placing the button in
  `[data-testid="top-bar"]` — the fixed breadcrumb bar, the only container that
  stays on screen while scrolling. Pass `placement: 'header'` for the previous
  spot next to GitLab's own controls.
- `createButton()` takes `size` (`'sm'` in the 48px top bar, `'md'` elsewhere)
  and separates the icon from the text: `icon` for an emoji, `iconUrl` for an
  image. The button's `title` falls back to its text.

### Added

- `setButtonLabels(visible)` / `toggleButtonLabels()` / `areButtonLabelsVisible()`
  show or hide the text of every injected button, keeping the icon. Buttons
  injected later inherit the setting, so a userscript calls it once at startup
  and again from its `GM_registerMenuCommand`. A button with no icon always
  keeps its label — hiding it would leave an empty button.
- `topBar` selector key.
- `getVersionParts()` and `atLeast(major, minor, patch)` for behaviour that
  genuinely depends on the release. Not for picking selectors: GitLab ships
  layouts behind feature flags, and on 18.2.8 one instance already serves the
  work item layout for issues and the classic one for merge requests, which is
  why `getLayout()` reads the DOM instead.
- `override(key, selectors)` adds selector candidates at runtime, so a
  userscript can patch a GitLab upgrade without waiting for a framework
  release.
- `resolve()` warns once per key when no candidate matches, naming the version
  and the layout: the early signal that an upgrade moved something.

## [1.2.0] - 2026-09-11

### Added

- **plugins/gitlab-dom.js** (`TMGitLabDOM`): single source of truth for every
  GitLab DOM selector. Verified against GitLab 18.2.8.
  - `getLayout()` detects whether the page uses the new **work item** view
    (issues on GitLab >= 18.x) or the **classic** `.issuable-sidebar` layout
    (merge requests). Every lookup resolves against the active layout and falls
    back to the other one, so the eventual work item migration of merge
    requests needs no change here.
  - `query()` / `queryAll()` / `resolve()` / `waitFor()` over named keys
    (`sidebar`, `labelsBlock`, `title`, `notes`, `commentEditor`, ...) instead
    of hardcoded CSS strings.
  - `injectButton()` places a GitLab-styled button in the right action bar for
    the current layout, idempotently.
  - `onPage()` replaces `window.addEventListener('load', ...)`: it re-runs on
    SPA navigation and whenever a Vue re-render drops the injected nodes.
  - Page data helpers: `getContext()`, `getProjectId()`, `getProjectPath()`,
    `getProjectUrl()`, `getTitle()`, `getCurrentUser()`, `getNotesText()`,
    `getCurrentLabels()`.
  - Built to `dist/tm-gitlab-dom.js` for `@require` from the userscripts.

### Changed

- **plugins/gitlab.js**: all selectors now delegate to `TMGitLabDOM`.
  `selectors` became a getter, since its values depend on the page layout.
  `gitlab-dom.js` must be loaded first.
- **plugins/gitlab.js** `addSidebarButton()`: no longer anchors on
  `[data-testid="sidebar-todo"]` inside `.issuable-sidebar-header`. It accepts
  an `id` for idempotent injection.

### Fixed

- GitLab 18.x broke every sidebar selector. On issues the whole
  `.issuable-sidebar` tree is gone; on merge requests `[data-testid="sidebar-todo"]`
  survived but moved out of `.issuable-sidebar-header` into
  `.merge-request-tabs-actions`, so the old compound selector matched nothing
  on either page type.
- `meta[name="project-id"]` was removed; the project now comes from
  `body[data-project-id]` / `body[data-full-path]`.
- `insertQuickAction()` silently did nothing on the work item view, where the
  comment field is a TipTap/ProseMirror contenteditable and not a `<textarea>`.
  It now returns `false` and logs a warning instead of failing quietly.

## [1.1.0] - 2026-01-26

### Added

- **TM.Logger**: New global logging system with configurable levels
  - `TM.Logger.configure({ enabled: true, level: 'debug' })`
  - Methods: `debug()`, `info()`, `warn()`, `error()`
  - Supports timestamps and custom prefixes

### Changed

- **Event Naming**: Standardized all emitted events to camelCase
  - `List`: `'item-click'` → `'itemClick'`
  - `Card`: `'header-action'` → `'headerAction'`

- **State Naming**: Standardized visibility state properties
  - `FloatingButton`: `showActions` → `expanded`

- **Internal Logging**: Core modules now use `TM.Logger` instead of direct `console.*` calls

### Breaking Changes

#### Event Names (camelCase)

If you were listening to kebab-case events, update your code:

```javascript
// Before
list.on('item-click', handler);
card.on('header-action', handler);

// After
list.on('itemClick', handler);
card.on('headerAction', handler);
```

#### FloatingButton State

```javascript
// Before
floatingButton.state.showActions = true;

// After
floatingButton.state.expanded = true;
```

### Migration Guide

1. Search your codebase for `'item-click'` and `'header-action'` event listeners
2. Replace with camelCase equivalents
3. Update any references to `FloatingButton.state.showActions`

## [1.0.0] - 2026-01-01

### Added

- Initial release
- Core reactive system
- Component base class
- 20+ UI components (forms, overlay, feedback, data, layout)
- Theme system with auto-detection
- GitLab and Odoo plugins
