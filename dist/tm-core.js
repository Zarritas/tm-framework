/*!
 * TM Framework - Core
 * Version: 1.0.0
 * Built: 2026-01-24T21:01:11.676Z
 * Author: Jesús Lorenzo
 * License: MIT
 */

/* ═══ core/reactive.js ═══ */
/**
 * TM Framework - Reactive System
 * Proxy-based reactivity similar to Vue 3
 */

const TMReactive = (function() {
    'use strict';

    /**
     * Creates a reactive proxy that notifies subscribers on changes
     * @param {Object} obj - Object to make reactive
     * @returns {Proxy} Reactive proxy
     */
    function reactive(obj) {
        const listeners = new Set();
        
        const handler = {
            get(target, prop) {
                // Internal properties
                if (prop === '__isReactive') return true;
                if (prop === '__listeners') return listeners;
                if (prop === '__subscribe') {
                    return (fn) => {
                        listeners.add(fn);
                        return () => listeners.delete(fn);
                    };
                }
                if (prop === '__raw') return target;
                
                // Recursively make nested objects reactive
                const value = target[prop];
                if (value && typeof value === 'object' && !value.__isReactive) {
                    target[prop] = reactive(value);
                    return target[prop];
                }
                return value;
            },
            
            set(target, prop, value) {
                const oldValue = target[prop];
                if (oldValue !== value) {
                    target[prop] = value;
                    listeners.forEach(fn => {
                        try {
                            fn(prop, value, oldValue);
                        } catch (e) {
                            console.error('[TM Reactive] Listener error:', e);
                        }
                    });
                }
                return true;
            },
            
            deleteProperty(target, prop) {
                if (prop in target) {
                    const oldValue = target[prop];
                    delete target[prop];
                    listeners.forEach(fn => fn(prop, undefined, oldValue));
                }
                return true;
            }
        };
        
        return new Proxy(obj, handler);
    }

    /**
     * Creates a computed value that caches and auto-updates
     * @param {Function} fn - Computation function
     * @param {Array} deps - Reactive dependencies
     * @returns {Function} Getter function
     */
    function computed(fn, deps = []) {
        let cached;
        let dirty = true;
        
        deps.forEach(dep => {
            if (dep?.__subscribe) {
                dep.__subscribe(() => { dirty = true; });
            }
        });
        
        return () => {
            if (dirty) {
                cached = fn();
                dirty = false;
            }
            return cached;
        };
    }

    /**
     * Watch a reactive object for changes
     * @param {Proxy} source - Reactive object
     * @param {Function} callback - Called on change
     * @param {Object} options - { immediate: boolean, deep: boolean }
     * @returns {Function} Unwatch function
     */
    function watch(source, callback, options = {}) {
        const { immediate = false } = options;
        
        if (immediate) {
            callback(source.__raw, undefined);
        }
        
        return source.__subscribe((prop, newVal, oldVal) => {
            callback(source.__raw, { prop, newVal, oldVal });
        });
    }

    /**
     * Create a ref (single value wrapper)
     * @param {*} initialValue 
     * @returns {Proxy}
     */
    function ref(initialValue) {
        return reactive({ value: initialValue });
    }

    return {
        reactive,
        computed,
        watch,
        ref
    };
})();

// Export for concatenation
if (typeof window !== 'undefined') {
    window.TMReactive = TMReactive;
}


/* ═══ core/component.js ═══ */
/**
 * TM Framework - Base Component Class
 * Provides lifecycle, props, state, and rendering
 */

const TMComponent = (function() {
    'use strict';

    const { reactive } = TMReactive;

    class Component {
        /**
         * Default props (override in subclass)
         */
        static defaultProps = {};

        /**
         * @param {Object} props - Component properties
         */
        constructor(props = {}) {
            this.props = Object.freeze({ ...this.constructor.defaultProps, ...props });
            this.state = reactive(this.initialState?.() || {});
            this.refs = {};
            this._el = null;
            this._mounted = false;
            this._updateScheduled = false;
            this._children = new Map();
            this._unsubscribers = [];
            this._emittingEvents = new Set(); // Prevent infinite recursion
            
            // Auto-subscribe to state changes
            if (this.state.__subscribe) {
                this._unsubscribers.push(
                    this.state.__subscribe(() => this._scheduleUpdate())
                );
            }
        }

        /**
         * Override to define initial state
         * @returns {Object}
         */
        initialState() {
            return {};
        }

        /**
         * Override to render component
         * @returns {string|HTMLElement}
         */
        render() {
            return '';
        }

        // ═══════════════════════════════════════════════════════════
        // LIFECYCLE HOOKS (override in subclass)
        // ═══════════════════════════════════════════════════════════

        /** Called after mount */
        onMount() {}
        
        /** Called after each update */
        onUpdate() {}
        
        /** Called before destroy */
        onDestroy() {}

        // ═══════════════════════════════════════════════════════════
        // PUBLIC API
        // ═══════════════════════════════════════════════════════════

        /** @returns {HTMLElement|null} */
        get el() {
            return this._el;
        }

        /** @returns {boolean} */
        get isMounted() {
            return this._mounted;
        }

        /**
         * Mount component into container
         * @param {string|HTMLElement} container
         * @returns {this}
         */
        mount(container) {
            if (typeof container === 'string') {
                container = document.querySelector(container);
            }
            if (!container) {
                console.error('[TM Component] Container not found');
                return this;
            }
            
            this._el = this._createElement();
            container.appendChild(this._el);
            this._finishMount();
            
            return this;
        }

        /**
         * Insert before reference element
         * @param {HTMLElement} refElement
         * @returns {this}
         */
        insertBefore(refElement) {
            if (!refElement?.parentNode) return this;
            
            this._el = this._createElement();
            refElement.parentNode.insertBefore(this._el, refElement);
            this._finishMount();
            
            return this;
        }

        /**
         * Insert after reference element
         * @param {HTMLElement} refElement
         * @returns {this}
         */
        insertAfter(refElement) {
            if (!refElement?.parentNode) return this;
            
            this._el = this._createElement();
            refElement.parentNode.insertBefore(this._el, refElement.nextSibling);
            this._finishMount();
            
            return this;
        }

        /**
         * Replace existing element
         * @param {HTMLElement} oldElement
         * @returns {this}
         */
        replace(oldElement) {
            if (!oldElement?.parentNode) return this;
            
            this._el = this._createElement();
            oldElement.parentNode.replaceChild(this._el, oldElement);
            this._finishMount();
            
            return this;
        }

        /**
         * Update props and trigger re-render
         * @param {Object} newProps
         */
        setProps(newProps) {
            this.props = Object.freeze({ ...this.props, ...newProps });
            this._scheduleUpdate();
        }

        /**
         * Emit custom event
         * @param {string} eventName
         * @param {*} detail
         */
        emit(eventName, detail = {}) {
            // Prevent infinite recursion
            if (this._emittingEvents.has(eventName)) {
                return;
            }
            
            this._emittingEvents.add(eventName);
            
            try {
                this._el?.dispatchEvent(new CustomEvent(eventName, {
                    detail,
                    bubbles: true,
                    composed: true
                }));
            } finally {
                this._emittingEvents.delete(eventName);
            }
        }

        /**
         * Force re-render
         */
        forceUpdate() {
            this._update();
        }

        /**
         * Destroy component and cleanup
         */
        destroy() {
            this.onDestroy();
            
            // Clear any pending updates
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
                this._updateTimeout = null;
            }
            
            // Destroy children
            this._children.forEach(child => child.destroy());
            this._children.clear();
            
            // Cleanup subscriptions
            this._unsubscribers.forEach(unsub => unsub());
            this._unsubscribers = [];
            
            // Clear emitting events
            this._emittingEvents?.clear();
            
            // Remove from DOM
            this._el?.remove();
            this._el = null;
            this._mounted = false;
            this._updateScheduled = false;
        }

        // ═══════════════════════════════════════════════════════════
        // CHILD COMPONENT MANAGEMENT
        // ═══════════════════════════════════════════════════════════

        /**
         * Register a child component
         * @param {string} key - Unique identifier
         * @param {Component} child
         */
        addChild(key, child) {
            this._children.set(key, child);
        }

        /**
         * Get child component
         * @param {string} key
         * @returns {Component|undefined}
         */
        getChild(key) {
            return this._children.get(key);
        }

        /**
         * Remove child component
         * @param {string} key
         */
        removeChild(key) {
            const child = this._children.get(key);
            if (child) {
                child.destroy();
                this._children.delete(key);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // PRIVATE METHODS
        // ═══════════════════════════════════════════════════════════

        _createElement() {
            const rendered = this.render();
            
            if (rendered instanceof HTMLElement) {
                this._processElement(rendered);
                return rendered;
            }
            
            const wrapper = document.createElement('div');
            wrapper.innerHTML = (rendered || '').trim();
            
            const el = wrapper.children.length === 1 
                ? wrapper.firstElementChild 
                : wrapper;
            
            this._processElement(el);
            
            return el;
        }

        _processElement(el) {
            if (!el) return;
            
            // Process refs
            el.querySelectorAll('[ref]').forEach(refEl => {
                const refName = refEl.getAttribute('ref');
                this.refs[refName] = refEl;
                refEl.removeAttribute('ref');
            });
            
            // Check root element ref
            if (el.hasAttribute?.('ref')) {
                this.refs[el.getAttribute('ref')] = el;
                el.removeAttribute('ref');
            }
            
            // Process event bindings (@click, @input, etc.)
            this._bindEvents(el);
        }

        _bindEvents(el) {
            const processNode = (node) => {
                if (node.nodeType !== 1) return;
                
                Array.from(node.attributes || []).forEach(attr => {
                    if (attr.name.startsWith('@')) {
                        const eventName = attr.name.slice(1);
                        const handlerName = attr.value;
                        
                        if (typeof this[handlerName] === 'function') {
                            node.addEventListener(eventName, (e) => {
                                // Prevent infinite recursion for component-emitted events
                                if (e.detail?.originalEvent) {
                                    return; // Skip if this event originated from this component
                                }
                                this[handlerName](e);
                            });
                        } else {
                            console.warn(`[TM Component] Handler "${handlerName}" not found`);
                        }
                        
                        node.removeAttribute(attr.name);
                    }
                });
            };
            
            processNode(el);
            el.querySelectorAll('*').forEach(processNode);
        }

        _finishMount() {
            this._mounted = true;
            this.onMount();
        }

        _scheduleUpdate() {
            if (!this._mounted || this._updateScheduled) return;
            
            this._updateScheduled = true;
            
            // Debounce updates to prevent excessive re-renders
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
            }
            
            this._updateTimeout = setTimeout(() => {
                this._updateScheduled = false;
                this._update();
                this._updateTimeout = null;
            }, 16); // ~60fps throttle
        }

        _update() {
            if (!this._el || !this._mounted) return;
            
            // Performance optimization: avoid unnecessary updates
            const startTime = performance.now();
            
            // Store scroll position
            const scrollPos = this._el.scrollTop;
            
            try {
                // Re-render
                const newEl = this._createElement();
                
                // Only replace if actually changed
                if (!this._elementsEqual(this._el, newEl)) {
                    this._el.replaceWith(newEl);
                    this._el = newEl;
                    
                    // Restore scroll
                    this._el.scrollTop = scrollPos;
                }
            } catch (error) {
                console.error('[TM Component] Update error:', error);
            }
            
            // Warn if update takes too long
            const updateTime = performance.now() - startTime;
            if (updateTime > 100) {
                console.warn(`[TM Component] Slow update detected: ${updateTime.toFixed(2)}ms`);
            }
            
            this.onUpdate();
        }
        
        _elementsEqual(el1, el2) {
            if (!el1 || !el2) return false;
            if (el1 === el2) return true;
            
            // Simple optimization: compare outerHTML for now
            // In a more sophisticated implementation, could do diffing
            return el1.outerHTML === el2.outerHTML;
        }
    }

    return { Component };
})();

// Export
if (typeof window !== 'undefined') {
    window.TMComponent = TMComponent;
}

/* ═══ core/utils.js ═══ */
/**
 * TM Framework - Utilities
 * Helper functions for common operations
 */

const TMUtils = (function() {
    'use strict';

    /**
     * Tagged template literal for HTML
     * Handles arrays and falsy values gracefully
     * @example html`<div>${items.map(i => `<span>${i}</span>`)}</div>`
     */
    function html(strings, ...values) {
        return strings.reduce((result, str, i) => {
            let value = values[i] ?? '';
            
            // Flatten arrays
            if (Array.isArray(value)) {
                value = value.join('');
            }
            
            // Handle booleans (for conditional rendering)
            if (typeof value === 'boolean') {
                value = '';
            }
            
            return result + str + value;
        }, '');
    }

    /**
     * Conditional class names builder
     * @example classNames('btn', { active: isActive }, condition && 'extra')
     * @returns {string}
     */
    function classNames(...args) {
        return args
            .flat(Infinity)
            .filter(Boolean)
            .map(c => {
                if (typeof c === 'object') {
                    return Object.entries(c)
                        .filter(([, v]) => v)
                        .map(([k]) => k);
                }
                return c;
            })
            .flat()
            .join(' ');
    }

    /**
     * Wait for an element to appear in the DOM
     * @param {string} selector - CSS selector
     * @param {number} timeout - Max wait time in ms
     * @param {HTMLElement} parent - Parent element to observe
     * @returns {Promise<HTMLElement>}
     */
    function waitForElement(selector, timeout = 5000, parent = document.body) {
        return new Promise((resolve, reject) => {
            // Check if already exists
            const existing = document.querySelector(selector);
            if (existing) return resolve(existing);
            
            const observer = new MutationObserver((mutations, obs) => {
                const el = document.querySelector(selector);
                if (el) {
                    obs.disconnect();
                    resolve(el);
                }
            });
            
            observer.observe(parent, {
                childList: true,
                subtree: true
            });
            
            // Timeout
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`[TM Utils] Element "${selector}" not found after ${timeout}ms`));
            }, timeout);
        });
    }

    /**
     * Wait for multiple elements
     * @param {string[]} selectors
     * @param {number} timeout
     * @returns {Promise<HTMLElement[]>}
     */
    function waitForElements(selectors, timeout = 5000) {
        return Promise.all(selectors.map(s => waitForElement(s, timeout)));
    }

    /**
     * Debounce function
     * @param {Function} fn
     * @param {number} delay
     * @returns {Function}
     */
    function debounce(fn, delay = 300) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Throttle function
     * @param {Function} fn
     * @param {number} limit
     * @returns {Function}
     */
    function throttle(fn, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Deep clone an object
     * @param {*} obj
     * @returns {*}
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(deepClone);
        if (obj instanceof Object) {
            return Object.fromEntries(
                Object.entries(obj).map(([k, v]) => [k, deepClone(v)])
            );
        }
        return obj;
    }

    /**
     * Deep merge objects
     * @param {Object} target
     * @param  {...Object} sources
     * @returns {Object}
     */
    function deepMerge(target, ...sources) {
        if (!sources.length) return target;
        
        const source = sources.shift();
        
        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return deepMerge(target, ...sources);
    }

    function isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Generate unique ID
     * @param {string} prefix
     * @returns {string}
     */
    function uid(prefix = 'tm') {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }

    /**
     * Escape HTML special characters
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Parse URL parameters
     * @param {string} url
     * @returns {Object}
     */
    function parseUrlParams(url = window.location.href) {
        const params = {};
        const searchParams = new URL(url).searchParams;
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        return params;
    }

    /**
     * Format date
     * @param {Date|string} date
     * @param {string} format - 'short', 'long', 'iso', 'time'
     * @returns {string}
     */
    function formatDate(date, format = 'short') {
        const d = new Date(date);
        
        const formats = {
            short: { day: '2-digit', month: '2-digit', year: 'numeric' },
            long: { day: 'numeric', month: 'long', year: 'numeric' },
            time: { hour: '2-digit', minute: '2-digit' },
            iso: null
        };
        
        if (format === 'iso') return d.toISOString().split('T')[0];
        
        return d.toLocaleDateString('es-ES', formats[format] || formats.short);
    }

    /**
     * Storage wrapper with JSON support using Tampermonkey APIs
     */
    const storage = {
        get(key, defaultValue = null) {
            try {
                // Try Tampermonkey API first
                if (typeof GM_getValue !== 'undefined') {
                    const item = GM_getValue(key, null);
                    return item !== null ? JSON.parse(item) : defaultValue;
                }
                
                // Fallback to localStorage
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch {
                return defaultValue;
            }
        },
        
        set(key, value) {
            try {
                // Try Tampermonkey API first
                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue(key, JSON.stringify(value));
                    return true;
                }
                
                // Fallback to localStorage
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },
        
        remove(key) {
            try {
                // Try Tampermonkey API first
                if (typeof GM_deleteValue !== 'undefined') {
                    GM_deleteValue(key);
                } else {
                    localStorage.removeItem(key);
                }
            } catch {
                // Silently fail
            }
        },
        
        clear() {
            try {
                // Tampermonkey API doesn't have a direct clear method
                if (typeof GM_listValues !== 'undefined') {
                    const keys = GM_listValues();
                    keys.forEach(key => GM_deleteValue(key));
                } else {
                    localStorage.clear();
                }
            } catch {
                // Silently fail
            }
        }
    };

    return {
        html,
        classNames,
        waitForElement,
        waitForElements,
        debounce,
        throttle,
        deepClone,
        deepMerge,
        uid,
        escapeHtml,
        parseUrlParams,
        formatDate,
        storage
    };
})();

// Export
if (typeof window !== 'undefined') {
    window.TMUtils = TMUtils;
}

/* ═══ core/theme.js ═══ */
/**
 * TM Framework - Theme System
 * Auto-detects and manages dark/light themes
 */

const TMTheme = (function() {
    'use strict';

    const { reactive } = TMReactive;

    // Theme state
    const state = reactive({
        mode: 'auto',      // 'light', 'dark', 'auto'
        current: 'light',  // Resolved theme
        platform: null     // Detected platform
    });

    // Platform detection strategies
    const detectors = {
        gitlab: () => {
            if (document.body.classList.contains('gl-dark')) return 'dark';
            if (document.documentElement.classList.contains('gl-dark')) return 'dark';
            if (document.body.classList.contains('ui-indigo')) return 'light';
            return null;
        },
        
        odoo: () => {
            const scheme = document.body.dataset.colorScheme;
            if (scheme === 'dark') return 'dark';
            if (scheme === 'light') return 'light';
            return null;
        },
        
        github: () => {
            const mode = document.documentElement.dataset.colorMode;
            if (mode === 'dark') return 'dark';
            if (mode === 'light') return 'light';
            return null;
        },
        
        meet: () => {
            // Google Meet uses specific classes
            if (document.body.classList.contains('dark-theme')) return 'dark';
            return 'light';
        },
        
        system: () => {
            if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
            return 'light';
        }
    };

    /**
     * Detect current theme from platform or system
     * @returns {string} 'light' or 'dark'
     */
    function detectTheme() {
        // Try each platform detector
        for (const [platform, detector] of Object.entries(detectors)) {
            if (platform === 'system') continue;
            
            const result = detector();
            if (result) {
                state.platform = platform;
                return result;
            }
        }
        
        // Fallback to system preference
        state.platform = 'system';
        return detectors.system();
    }

    /**
     * Update theme based on current mode
     */
    function updateTheme() {
        state.current = state.mode === 'auto' ? detectTheme() : state.mode;
        document.documentElement.setAttribute('data-tm-theme', state.current);
        
        // Also set on body for better compatibility
        document.body.setAttribute('data-tm-theme', state.current);
    }

    /**
     * Set theme mode
     * @param {'light'|'dark'|'auto'} mode
     */
    function setMode(mode) {
        if (!['light', 'dark', 'auto'].includes(mode)) {
            console.warn(`[TM Theme] Invalid mode: ${mode}`);
            return;
        }
        state.mode = mode;
        updateTheme();
    }

    /**
     * Toggle between light and dark
     */
    function toggle() {
        setMode(state.current === 'light' ? 'dark' : 'light');
    }

    /**
     * Initialize theme system
     */
    function init() {
        // Initial detection
        updateTheme();
        
        // Watch for system preference changes
        window.matchMedia?.('(prefers-color-scheme: dark)')
            .addEventListener('change', () => {
                if (state.mode === 'auto') updateTheme();
            });
        
        // Watch for DOM class changes (platform theme toggles)
        const observer = new MutationObserver(() => {
            if (state.mode === 'auto') updateTheme();
        });
        
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'data-color-scheme', 'data-theme']
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-color-mode', 'data-theme']
        });
        
        console.log(`[TM Theme] Initialized: ${state.current} (platform: ${state.platform})`);
    }

    /**
     * Get CSS variable value
     * @param {string} varName - Variable name (with or without --)
     * @returns {string}
     */
    function getCssVar(varName) {
        const name = varName.startsWith('--') ? varName : `--${varName}`;
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    /**
     * Set CSS variable
     * @param {string} varName
     * @param {string} value
     */
    function setCssVar(varName, value) {
        const name = varName.startsWith('--') ? varName : `--${varName}`;
        document.documentElement.style.setProperty(name, value);
    }

    /**
     * Add custom platform detector
     * @param {string} name
     * @param {Function} detector - Should return 'light', 'dark', or null
     */
    function addDetector(name, detector) {
        detectors[name] = detector;
    }

    return {
        state,
        init,
        setMode,
        toggle,
        detectTheme,
        getCssVar,
        setCssVar,
        addDetector,
        
        // Getters
        get mode() { return state.mode; },
        get current() { return state.current; },
        get isDark() { return state.current === 'dark'; },
        get isLight() { return state.current === 'light'; },
        get platform() { return state.platform; }
    };
})();

// Export
if (typeof window !== 'undefined') {
    window.TMTheme = TMTheme;
}

/* ═══ core/tm.js ═══ */
/**
 * TM Framework - Entry Point
 * Combines all core modules into unified TM namespace
 * 
 * @version 1.0.0
 * @author Jesús Lorenzo
 * @license MIT
 */

const TM = (function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // COLLECT MODULES
    // ═══════════════════════════════════════════════════════════════
    
    const { reactive, computed, watch, ref } = TMReactive;
    const { Component } = TMComponent;
    const { 
        html, classNames, waitForElement, waitForElements,
        debounce, throttle, deepClone, deepMerge,
        uid, escapeHtml, parseUrlParams, formatDate, storage
    } = TMUtils;
    const theme = TMTheme;

    // ═══════════════════════════════════════════════════════════════
    // STYLE INJECTION
    // ═══════════════════════════════════════════════════════════════
    
    const injectedStyles = new Set();

    /**
     * Inject CSS styles into the page
     * @param {string} css - CSS content
     * @param {string} id - Optional unique ID (prevents duplicates)
     */
    function injectStyles(css, id = null) {
        const styleId = id || `tm-style-${uid()}`;
        
        if (injectedStyles.has(styleId)) return styleId;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
        injectedStyles.add(styleId);
        
        return styleId;
    }

    /**
     * Remove injected styles
     * @param {string} id
     */
    function removeStyles(id) {
        const style = document.getElementById(id);
        if (style) {
            style.remove();
            injectedStyles.delete(id);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PLUGIN SYSTEM
    // ═══════════════════════════════════════════════════════════════
    
    const plugins = new Map();

    /**
     * Register a plugin
     * @param {string} name
     * @param {Object} plugin
     */
    function use(name, plugin) {
        if (plugins.has(name)) {
            console.warn(`[TM] Plugin "${name}" already registered`);
            return;
        }
        
        plugins.set(name, plugin);
        
        // Call install if exists
        if (typeof plugin.install === 'function') {
            plugin.install(TM);
        }
        
        console.log(`[TM] Plugin "${name}" registered`);
    }

    /**
     * Get registered plugin
     * @param {string} name
     * @returns {Object|undefined}
     */
    function getPlugin(name) {
        return plugins.get(name);
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    
    let initialized = false;

    /**
     * Initialize framework
     * @param {Object} options
     */
    function init(options = {}) {
        if (initialized) {
            console.warn('[TM] Already initialized');
            return;
        }
        
        // Initialize theme
        theme.init();
        
        // Set initial theme mode if provided
        if (options.theme) {
            theme.setMode(options.theme);
        }
        
        initialized = true;
        console.log('[TM Framework] Initialized v1.0.0');
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        // Small delay to ensure all scripts are loaded
        setTimeout(() => init(), 0);
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    
    const TM = {
        // Version
        version: '1.0.0',
        
        // Core
        Component,
        
        // Reactivity
        reactive,
        computed,
        watch,
        ref,
        
        // Theme
        theme,
        
        // Utilities
        html,
        classNames,
        waitForElement,
        waitForElements,
        debounce,
        throttle,
        deepClone,
        deepMerge,
        uid,
        escapeHtml,
        parseUrlParams,
        formatDate,
        storage,
        
        // Styles
        injectStyles,
        removeStyles,
        
        // Plugins
        use,
        getPlugin,
        
        // Init
        init
    };

    return TM;
})();

// Export to window
if (typeof window !== 'undefined') {
    window.TM = TM;
}

// Export for CommonJS (Node.js build)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM;
}
