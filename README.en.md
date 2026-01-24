[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/Zarritas/tm-framework/releases/tag/Version-1.0.0)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/Zarritas/tm-framework/blob/main/LICENSE_EN)
[![CONTRIBUTING](https://img.shields.io/badge/CONTRIBUTING-orange)](https://github.com/Zarritas/tm-framework/blob/main/CONTRIBUTING_EN.md)

## 🌐 Languages / Idiomas

- 🇺🇸 **English** (current)
- 🇪🇸 [**Español**](./README.md)

# 🔧 TM Framework

Reactive component framework for Tampermonkey, inspired by Vue and React.

## ✨ Features

- 🧩 **Reactive components** with state and props and stack overflow protection
- 🎨 **Theme system** auto-detects dark/light (GitLab, Odoo, system)
- 📦 **+20 UI components** ready to use
- 🔄 **Lifecycle hooks**: onMount, onUpdate, onDestroy
- 🎯 **Event binding** declarative with `@click`, `@input` without infinite recursion
- 🔗 **Element references** with `ref="name"`
- 🔌 **Plugins** for GitLab and Odoo with native Tampermonkey APIs
- 📱 **Build system** with concatenation and minification
- 💾 **Optimized storage** with GM_setValue/GM_getValue and automatic fallback
- 🌐 **API requests** with GM_xmlhttpRequest and improved error handling

## 📁 Project Structure

```
tm-framework/
├── core/                    # Framework core
│   ├── reactive.js          # Reactive system
│   ├── component.js         # Component base class
│   ├── utils.js             # Utilities (html, classNames...)
│   ├── theme.js             # Theme management
│   └── tm.js                # Entry point
├── components/              # UI components
│   ├── forms/               # Button, Input, Select...
│   ├── overlay/             # Modal, Drawer, Tooltip...
│   ├── feedback/            # Toast, Alert, Spinner...
│   ├── data/                # Tag, List, Table...
│   └── layout/              # Card, Tabs, Accordion...
├── styles/                  # CSS styles
│   ├── variables.css
│   ├── base.css
│   └── components/
├── plugins/                 # Extensions
│   ├── gitlab.js
│   └── odoo.js
├── dist/                    # Compiled files
├── scripts/                 # Build tools
│   └── build.js
└── package.json
```

## 🚀 Installation

### Option 1: Use compiled files (Recommended)

```javascript
// ==UserScript==
// @name         My Script
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tm-framework/main/dist/tm-framework.js
// @resource     TM_CSS https://raw.githubusercontent.com/FlJesusLorenzo/tm-framework/main/dist/tm-styles.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// ==/UserScript==

GM_addStyle(GM_getResourceText('TM_CSS'));

// Ready! Use TM.* 
```

### Option 2: Core only (no components)

```javascript
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @require https://raw.githubusercontent.com/.../dist/tm-core.js
```

### Option 3: With specific plugins

```javascript
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @require https://raw.githubusercontent.com/.../dist/tm-framework.js
// @require https://raw.githubusercontent.com/.../dist/tm-gitlab.js
// @require https://raw.githubusercontent.com/.../dist/tm-odoo.js
```

> **ℹ️ Note**: Since version 1.0.0+, the framework uses native Tampermonkey APIs (`GM_setValue`, `GM_xmlhttpRequest`) for better performance and security, with automatic fallback to browser APIs.

## 📖 Basic Usage

### Create a component

```javascript
class MyComponent extends TM.Component {
    static defaultProps = {
        title: 'Hello',
        counter: 0
    };

    initialState() {
        return { clicks: 0 };
    }

    render() {
        return TM.html`
            <div class="my-component">
                <h2>${this.props.title}</h2>
                <p>Clicks: ${this.state.clicks}</p>
                <button @click="increment">+1</button>
                <input ref="input" type="text" @input="handleInput" />
            </div>
        `;
    }

    increment() {
        this.state.clicks++;  // Auto re-render!
    }

    handleInput(e) {
        console.log('Value:', e.target.value);
    }

    onMount() {
        console.log('Component mounted');
        this.refs.input.focus();
    }
}

// Use
const comp = new MyComponent({ title: 'Demo' });
comp.mount('#container');
```

## 🧩 Available Components

### Forms

| Component | Main Props |
|-----------|------------|
| `TM.Button` | text, variant, icon, size, loading, onClick |
| `TM.Input` | value, type, label, error, placeholder, onInput |
| `TM.Textarea` | value, rows, maxLength, autoResize |
| `TM.Select` | options, value, placeholder, onChange |
| `TM.Checkbox` | checked, label, onChange |
| `TM.Switch` | checked, label, size |

### Overlay

| Component | Main Props |
|-----------|------------|
| `TM.Modal` | title, width, footer, onConfirm, onClose |
| `TM.Drawer` | title, position, size, onClose |
| `TM.Tooltip` | text, position, trigger |
| `TM.ContextMenu` | items, onSelect |

### Feedback

| Component | Main Props |
|-----------|------------|
| `TM.Toast` | (static) success(), error(), warning(), info() |
| `TM.Alert` | type, title, message, closable |
| `TM.Spinner` | size, text, overlay |
| `TM.Progress` | value, max, striped, animated |
| `TM.Skeleton` | variant, lines, animated |

### Data

| Component | Main Props |
|-----------|------------|
| `TM.Tag` | text, variant, color, removable |
| `TM.Badge` | value, max, variant, dot |
| `TM.List` | items, selectable, multiple |
| `TM.Table` | columns, data, striped, hoverable |

### Layout

| Component | Main Props |
|-----------|------------|
| `TM.Card` | title, subtitle, footer, hoverable |
| `TM.Tabs` | tabs, activeKey, variant |
| `TM.Accordion` | items, multiple, bordered |
| `TM.FloatingButton` | icon, position, actions |
| `TM.Divider` | text, orientation, dashed |

## 📝 Component Examples

### Modal with form

```javascript
const modal = new TM.Modal({
    title: '⏱️ New Time Entry',
    width: '450px',
    onConfirm: () => handleSubmit()
});
modal.mount(document.body);

// Open
modal.open();
modal.setContent(`
    <div class="tm-form-group">
        <label class="tm-label">Description</label>
        <textarea class="tm-input tm-textarea"></textarea>
    </div>
`);
```

### Toast notifications

```javascript
TM.Toast.success('Successfully saved');
TM.Toast.error('Error processing', 5000);
TM.Toast.warning('Attention');

// With promise
await TM.Toast.promise(
    fetch('/api/save'),
    {
        loading: 'Saving...',
        success: 'Saved!',
        error: (e) => `Error: ${e.message}`
    }
);
```

### Selectable list

```javascript
const list = new TM.List({
    items: [
        { id: 1, title: 'Option 1', subtitle: 'Description' },
        { id: 2, title: 'Option 2', icon: '📁' },
        { id: 3, title: 'Option 3', disabled: true }
    ],
    selectable: true,
    multiple: true,
    onSelect: (selected) => console.log(selected)
});
list.mount('#container');
```

### Tabs

```javascript
const tabs = new TM.Tabs({
    tabs: [
        { key: 'general', label: 'General', icon: '⚙️' },
        { key: 'advanced', label: 'Advanced' },
        { key: 'help', label: 'Help', disabled: true }
    ],
    activeKey: 'general',
    onChange: (key) => console.log('Tab:', key)
});
tabs.mount('#container');
tabs.setTabContent('general', '<p>General content</p>');
```

## 🔌 Plugins

### GitLab Plugin

```javascript
// Detect context
const ctx = TM.gitlab.getContext();
// { type: 'issue', project: 'fl-v16', iid: '123', ... }

// Get labels
const labels = await TM.gitlab.getLabels();

// Add button to sidebar
TM.gitlab.addLabelsButton({
    icon: '🏷️',
    onClick: () => openLabelEditor()
});

// Quick actions
TM.gitlab.applyLabelsViaQuickAction(
    ['bug', 'urgent'],      // add
    ['pending', 'review']   // remove
);
```

### Odoo Plugin

```javascript
// Configure
TM.odoo.configure({
    baseUrl: 'https://odoo.factorlibre.com',
    database: 'production'
});

// Search projects
const projects = await TM.odoo.searchProjects('fl-v16');

// Create timesheet
await TM.odoo.createTimesheet({
    projectId: 123,
    taskId: 456,
    description: 'Develop feature X',
    hours: 2.5,
    date: '2025-01-24'
});

// Generic RPC
const partners = await TM.odoo.search('res.partner', 
    [['is_company', '=', true]], 
    { fields: ['name', 'email'], limit: 10 }
);
```

## 🎨 Theme System

The framework automatically detects the theme:

1. **GitLab**: class `gl-dark`
2. **Odoo**: `data-color-scheme="dark"`  
3. **System**: `prefers-color-scheme`

```javascript
// Check current theme
console.log(TM.theme.current);  // 'light' | 'dark'
console.log(TM.theme.isDark);   // true | false

// Force theme
TM.theme.setMode('dark');   // 'light', 'dark', 'auto'

// Toggle
TM.theme.toggle();
```

### Available CSS variables

```css
/* Colors */
--tm-primary, --tm-success, --tm-danger, --tm-warning
--tm-bg, --tm-bg-secondary, --tm-bg-tertiary
--tm-text, --tm-text-secondary, --tm-text-muted
--tm-border, --tm-border-focus

/* Spacing */
--tm-space-xs (4px), --tm-space-sm (8px), --tm-space-md (12px)
--tm-space-lg (16px), --tm-space-xl (24px)

/* Borders */
--tm-radius, --tm-radius-lg, --tm-radius-full

/* Transitions */
--tm-transition, --tm-transition-slow
```

## 🔧 Utilities

```javascript
// HTML template
TM.html`<div>${items.map(i => `<li>${i}</li>`)}</div>`

// Conditional class names
TM.classNames('btn', { active: isActive }, condition && 'extra')

// Wait for element
await TM.waitForElement('.sidebar', 5000);

// Debounce / Throttle
const debouncedFn = TM.debounce(fn, 300);
const throttledFn = TM.throttle(fn, 100);

// Storage with JSON
TM.storage.set('config', { theme: 'dark' });
TM.storage.get('config', {});

// Utilities
TM.uid('prefix');           // 'prefix-xyz123'
TM.escapeHtml('<script>');  // '&lt;script&gt;'
TM.formatDate(new Date());  // '24/01/2025'
TM.deepClone(obj);
TM.deepMerge(target, source);
```

## 🏗️ Build

```bash
# Install dependencies (optional, only for lint)
npm install

# Build
npm run build

# Watch mode (development)
npm run watch

# Clean and rebuild
npm run rebuild
```

### Generated files in `/dist`

| File | Description |
|------|-------------|
| `tm-core.js` | Core only (no components) |
| `tm-framework.js` | Full framework |
| `tm-styles.css` | Styles |
| `tm-gitlab.js` | GitLab Plugin |
| `tm-odoo.js` | Odoo Plugin |
| `*.min.js/css` | Minified versions |

## 📄 Complete Example: Time Entries

```javascript
// ==UserScript==
// @name         Time Entries
// @match        https://git.factorlibre.com/*/-/issues/*
// @require      https://raw.githubusercontent.com/.../dist/tm-framework.js
// @require      https://raw.githubusercontent.com/.../dist/tm-gitlab.js
// @require      https://raw.githubusercontent.com/.../dist/tm-odoo.js
// @resource     TM_CSS https://raw.githubusercontent.com/.../dist/tm-styles.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

GM_addStyle(GM_getResourceText('TM_CSS'));

TM.odoo.configure({
    baseUrl: 'https://odoo.factorlibre.com',
    database: 'production'
});

class TimeEntryForm extends TM.Component {
    static defaultProps = { project: '', task: '' };
    
    initialState() {
        return { description: '', hours: '', date: new Date().toISOString().split('T')[0] };
    }
    
    render() {
        return TM.html`
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; gap: 8px;">
                    <span class="tm-tag tm-tag--primary">📁 ${this.props.project}</span>
                    <span class="tm-tag tm-tag--success">#${this.props.task}</span>
                </div>
                <div class="tm-form-group">
                    <label class="tm-label">Description</label>
                    <textarea ref="desc" class="tm-input tm-textarea" @input="onDesc">${this.state.description}</textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="tm-form-group">
                        <label class="tm-label">Hours</label>
                        <input class="tm-input" placeholder="1.5" @input="onHours" />
                    </div>
                    <div class="tm-form-group">
                        <label class="tm-label">Date</label>
                        <input class="tm-input" type="date" value="${this.state.date}" @change="onDate" />
                    </div>
                </div>
            </div>
        `;
    }
    
    onDesc(e) { this.state.description = e.target.value; }
    onHours(e) { this.state.hours = e.target.value; }
    onDate(e) { this.state.date = e.target.value; }
    
    getData() { return { ...this.state, ...this.props }; }
}

// Initialize
TM.gitlab.waitForSidebar().then(() => {
    const ctx = TM.gitlab.getContext();
    
    const modal = new TM.Modal({
        title: '⏱️ Log Hours',
        onConfirm: async () => {
            const data = form.getData();
            await TM.odoo.createTimesheet({
                projectId: await findProject(data.project),
                description: data.description,
                hours: parseFloat(data.hours),
                date: data.date
            });
            TM.Toast.success('Time entry created');
        }
    }).mount(document.body);
    
    const form = new TimeEntryForm({ project: ctx.project, task: ctx.iid });
    
    TM.gitlab.addSidebarButton({
        text: 'Log Time',
        icon: '⏱️',
        onClick: () => {
            modal.open();
            modal.setContent(form);
        }
    });
});
```

## 📄 License

MIT © Jesús Lorenzo
