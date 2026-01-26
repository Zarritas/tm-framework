# Changelog

All notable changes to TM Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
