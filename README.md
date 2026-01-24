## 🌐 Idiomas / Languages

- 🇪🇸 **Español** (actual)
- 🇺🇸 [**English**](./README.en.md)

# 🔧 TM Framework

Framework de componentes reactivos para Tampermonkey, inspirado en Vue y React.

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/Zarritas/tm-framework/releases/tag/Versión-1.0.0)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/Zarritas/tm-framework/blob/main/LICENSE)
[![CONTRIBUTING](https://img.shields.io/badge/CONTRIBUTING-orange)](https://github.com/Zarritas/tm-framework/blob/main/CONTRIBUTING.md)

## ✨ Características

- 🧩 **Componentes reactivos** con estado y props y protección contra stack overflow
- 🎨 **Sistema de temas** auto-detecta dark/light (GitLab, Odoo, sistema)
- 📦 **+20 componentes UI** listos para usar
- 🔄 **Lifecycle hooks**: onMount, onUpdate, onDestroy
- 🎯 **Event binding** declarativo con `@click`, `@input` sin recursión infinita
- 🔗 **Referencias** a elementos con `ref="nombre"`
- 🔌 **Plugins** para GitLab y Odoo con APIs nativas de Tampermonkey
- 📱 **Build system** con concatenación y minificación
- 💾 **Storage optimizado** con GM_setValue/GM_getValue y fallback automático
- 🌐 **Peticiones API** con GM_xmlhttpRequest y mejor manejo de errores

## 📁 Estructura del Proyecto

```
tm-framework/
├── core/                    # Núcleo del framework
│   ├── reactive.js          # Sistema reactivo
│   ├── component.js         # Clase base Component
│   ├── utils.js             # Utilidades (html, classNames...)
│   ├── theme.js             # Gestión de temas
│   └── tm.js                # Entry point
├── components/              # Componentes UI
│   ├── forms/               # Button, Input, Select...
│   ├── overlay/             # Modal, Drawer, Tooltip...
│   ├── feedback/            # Toast, Alert, Spinner...
│   ├── data/                # Tag, List, Table...
│   └── layout/              # Card, Tabs, Accordion...
├── styles/                  # Estilos CSS
│   ├── variables.css
│   ├── base.css
│   └── components/
├── plugins/                 # Extensiones
│   ├── gitlab.js
│   └── odoo.js
├── dist/                    # Archivos compilados
├── scripts/                 # Build tools
│   └── build.js
└── package.json
```

## 🚀 Instalación

### Opción 1: Usar archivos compilados (Recomendado)

```javascript
// ==UserScript==
// @name         Mi Script
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

GM_addStyle(GM_getResourceText("TM_CSS"));

// ¡Listo! Usa TM.*
```

### Opción 2: Solo Core (sin componentes)

```javascript
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @require https://raw.githubusercontent.com/.../dist/tm-core.js
```

### Opción 3: Con plugins específicos

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

> **ℹ️ Nota**: Desde la versión 1.0.0+, el framework utiliza APIs nativas de Tampermonkey (`GM_setValue`, `GM_xmlhttpRequest`) para mejor rendimiento y seguridad, con fallback automático a APIs del navegador.

## 📖 Uso Básico

### Crear un componente

```javascript
class MiComponente extends TM.Component {
  static defaultProps = {
    titulo: "Hola",
    contador: 0,
  };

  initialState() {
    return { clicks: 0 };
  }

  render() {
    return TM.html`
            <div class="mi-componente">
                <h2>${this.props.titulo}</h2>
                <p>Clicks: ${this.state.clicks}</p>
                <button @click="incrementar">+1</button>
                <input ref="input" type="text" @input="handleInput" />
            </div>
        `;
  }

  incrementar() {
    this.state.clicks++; // Auto re-render!
  }

  handleInput(e) {
    console.log("Valor:", e.target.value);
  }

  onMount() {
    console.log("Componente montado");
    this.refs.input.focus();
  }
}

// Usar
const comp = new MiComponente({ titulo: "Demo" });
comp.mount("#container");
```

## 🧩 Componentes Disponibles

### Forms

| Componente    | Props principales                               |
| ------------- | ----------------------------------------------- |
| `TM.Button`   | text, variant, icon, size, loading, onClick     |
| `TM.Input`    | value, type, label, error, placeholder, onInput |
| `TM.Textarea` | value, rows, maxLength, autoResize              |
| `TM.Select`   | options, value, placeholder, onChange           |
| `TM.Checkbox` | checked, label, onChange                        |
| `TM.Switch`   | checked, label, size                            |

### Overlay

| Componente       | Props principales                        |
| ---------------- | ---------------------------------------- |
| `TM.Modal`       | title, width, footer, onConfirm, onClose |
| `TM.Drawer`      | title, position, size, onClose           |
| `TM.Tooltip`     | text, position, trigger                  |
| `TM.ContextMenu` | items, onSelect                          |

### Feedback

| Componente    | Props principales                              |
| ------------- | ---------------------------------------------- |
| `TM.Toast`    | (static) success(), error(), warning(), info() |
| `TM.Alert`    | type, title, message, closable                 |
| `TM.Spinner`  | size, text, overlay                            |
| `TM.Progress` | value, max, striped, animated                  |
| `TM.Skeleton` | variant, lines, animated                       |

### Data

| Componente | Props principales                 |
| ---------- | --------------------------------- |
| `TM.Tag`   | text, variant, color, removable   |
| `TM.Badge` | value, max, variant, dot          |
| `TM.List`  | items, selectable, multiple       |
| `TM.Table` | columns, data, striped, hoverable |

### Layout

| Componente          | Props principales                  |
| ------------------- | ---------------------------------- |
| `TM.Card`           | title, subtitle, footer, hoverable |
| `TM.Tabs`           | tabs, activeKey, variant           |
| `TM.Accordion`      | items, multiple, bordered          |
| `TM.FloatingButton` | icon, position, actions            |
| `TM.Divider`        | text, orientation, dashed          |

## 📝 Ejemplos de Componentes

### Modal con formulario

```javascript
const modal = new TM.Modal({
  title: "⏱️ Nueva Imputación",
  width: "450px",
  onConfirm: () => handleSubmit(),
});
modal.mount(document.body);

// Abrir
modal.open();
modal.setContent(`
    <div class="tm-form-group">
        <label class="tm-label">Descripción</label>
        <textarea class="tm-input tm-textarea"></textarea>
    </div>
`);
```

### Toast notifications

```javascript
TM.Toast.success("Guardado correctamente");
TM.Toast.error("Error al procesar", 5000);
TM.Toast.warning("Atención");

// Con promesa
await TM.Toast.promise(fetch("/api/save"), {
  loading: "Guardando...",
  success: "Guardado!",
  error: (e) => `Error: ${e.message}`,
});
```

### Lista seleccionable

```javascript
const list = new TM.List({
  items: [
    { id: 1, title: "Opción 1", subtitle: "Descripción" },
    { id: 2, title: "Opción 2", icon: "📁" },
    { id: 3, title: "Opción 3", disabled: true },
  ],
  selectable: true,
  multiple: true,
  onSelect: (selected) => console.log(selected),
});
list.mount("#container");
```

### Tabs

```javascript
const tabs = new TM.Tabs({
  tabs: [
    { key: "general", label: "General", icon: "⚙️" },
    { key: "advanced", label: "Avanzado" },
    { key: "help", label: "Ayuda", disabled: true },
  ],
  activeKey: "general",
  onChange: (key) => console.log("Tab:", key),
});
tabs.mount("#container");
tabs.setTabContent("general", "<p>Contenido general</p>");
```

## 🔌 Plugins

### GitLab Plugin

```javascript
// Detectar contexto
const ctx = TM.gitlab.getContext();
// { type: 'issue', project: 'fl-v16', iid: '123', ... }

// Obtener labels
const labels = await TM.gitlab.getLabels();

// Añadir botón al sidebar
TM.gitlab.addLabelsButton({
  icon: "🏷️",
  onClick: () => openLabelEditor(),
});

// Quick actions
TM.gitlab.applyLabelsViaQuickAction(
  ["bug", "urgent"], // add
  ["pending", "review"], // remove
);
```

### Odoo Plugin

```javascript
// Configurar
TM.odoo.configure({
  baseUrl: "https://odoo.factorlibre.com",
  database: "production",
});

// Buscar proyectos
const projects = await TM.odoo.searchProjects("fl-v16");

// Crear timesheet
await TM.odoo.createTimesheet({
  projectId: 123,
  taskId: 456,
  description: "Desarrollo feature X",
  hours: 2.5,
  date: "2025-01-24",
});

// RPC genérico
const partners = await TM.odoo.search(
  "res.partner",
  [["is_company", "=", true]],
  { fields: ["name", "email"], limit: 10 },
);
```

## 🎨 Sistema de Temas

El framework detecta automáticamente el tema:

1. **GitLab**: clase `gl-dark`
2. **Odoo**: `data-color-scheme="dark"`
3. **Sistema**: `prefers-color-scheme`

```javascript
// Ver tema actual
console.log(TM.theme.current); // 'light' | 'dark'
console.log(TM.theme.isDark); // true | false

// Forzar tema
TM.theme.setMode("dark"); // 'light', 'dark', 'auto'

// Toggle
TM.theme.toggle();
```

### Variables CSS disponibles

```css
/* Colores */
--tm-primary, --tm-success, --tm-danger, --tm-warning
--tm-bg, --tm-bg-secondary, --tm-bg-tertiary
--tm-text, --tm-text-secondary, --tm-text-muted
--tm-border, --tm-border-focus

/* Espaciado */
--tm-space-xs (4px), --tm-space-sm (8px), --tm-space-md (12px)
--tm-space-lg (16px), --tm-space-xl (24px)

/* Bordes */
--tm-radius, --tm-radius-lg, --tm-radius-full

/* Transiciones */
--tm-transition, --tm-transition-slow
```

## 🔧 Utilidades

```javascript
// Template HTML
TM.html`<div>${items.map((i) => `<li>${i}</li>`)}</div>`;

// Class names condicionales
TM.classNames("btn", { active: isActive }, condition && "extra");

// Esperar elemento
await TM.waitForElement(".sidebar", 5000);

// Debounce / Throttle
const debouncedFn = TM.debounce(fn, 300);
const throttledFn = TM.throttle(fn, 100);

// Storage con JSON (usa GM_setValue/GM_getValue automáticamente)
TM.storage.set("config", { theme: "dark" });
TM.storage.get("config", {});
TM.storage.remove("key");
TM.storage.clear();

// Utilidades
TM.uid("prefix"); // 'prefix-xyz123'
TM.escapeHtml("<script>"); // '&lt;script&gt;'
TM.formatDate(new Date()); // '24/01/2025'
TM.deepClone(obj);
TM.deepMerge(target, source);
```

## 🏗️ Build

```bash
# Instalar dependencias (opcional, solo para lint)
npm install

# Compilar
npm run build

# Watch mode (desarrollo)
npm run watch

# Limpiar y recompilar
npm run rebuild
```

### Archivos generados en `/dist`

| Archivo           | Descripción                 |
| ----------------- | --------------------------- |
| `tm-core.js`      | Solo core (sin componentes) |
| `tm-framework.js` | Framework completo          |
| `tm-styles.css`   | Estilos                     |
| `tm-gitlab.js`    | Plugin GitLab               |
| `tm-odoo.js`      | Plugin Odoo                 |
| `*.min.js/css`    | Versiones minificadas       |

## 📄 Ejemplo Completo: Imputaciones

```javascript
// ==UserScript==
// @name         Imputaciones
// @match        https://git.factorlibre.com/*/-/issues/*
// @require      https://raw.githubusercontent.com/.../dist/tm-framework.js
// @require      https://raw.githubusercontent.com/.../dist/tm-gitlab.js
// @require      https://raw.githubusercontent.com/.../dist/tm-odoo.js
// @resource     TM_CSS https://raw.githubusercontent.com/.../dist/tm-styles.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

GM_addStyle(GM_getResourceText("TM_CSS"));

TM.odoo.configure({
  baseUrl: "https://odoo.factorlibre.com",
  database: "production",
});

class ImputarForm extends TM.Component {
  static defaultProps = { proyecto: "", tarea: "" };

  initialState() {
    return {
      descripcion: "",
      horas: "",
      fecha: new Date().toISOString().split("T")[0],
    };
  }

  render() {
    return TM.html`
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; gap: 8px;">
                    <span class="tm-tag tm-tag--primary">📁 ${this.props.proyecto}</span>
                    <span class="tm-tag tm-tag--success">#${this.props.tarea}</span>
                </div>
                <div class="tm-form-group">
                    <label class="tm-label">Descripción</label>
                    <textarea ref="desc" class="tm-input tm-textarea" @input="onDesc">${this.state.descripcion}</textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="tm-form-group">
                        <label class="tm-label">Horas</label>
                        <input class="tm-input" placeholder="1.5" @input="onHoras" />
                    </div>
                    <div class="tm-form-group">
                        <label class="tm-label">Fecha</label>
                        <input class="tm-input" type="date" value="${this.state.fecha}" @change="onFecha" />
                    </div>
                </div>
            </div>
        `;
  }

  onDesc(e) {
    this.state.descripcion = e.target.value;
  }
  onHoras(e) {
    this.state.horas = e.target.value;
  }
  onFecha(e) {
    this.state.fecha = e.target.value;
  }

  getData() {
    return { ...this.state, ...this.props };
  }
}

// Inicializar
TM.gitlab.waitForSidebar().then(() => {
  const ctx = TM.gitlab.getContext();

  const modal = new TM.Modal({
    title: "⏱️ Imputar Horas",
    onConfirm: async () => {
      const data = form.getData();
      await TM.odoo.createTimesheet({
        projectId: await findProject(data.proyecto),
        description: data.descripcion,
        hours: parseFloat(data.horas),
        date: data.fecha,
      });
      TM.Toast.success("Imputación creada");
    },
  }).mount(document.body);

  const form = new ImputarForm({ proyecto: ctx.project, tarea: ctx.iid });

  TM.gitlab.addSidebarButton({
    text: "Imputar",
    icon: "⏱️",
    onClick: () => {
      modal.open();
      modal.setContent(form);
    },
  });
});
```

## 📝 Licencia

MIT © Jesús Lorenzo
