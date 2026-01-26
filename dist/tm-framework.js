/*!
 * TM Framework - Full Framework
 * Version: 1.0.0
 * Built: 2026-01-26T15:16:08.088Z
 * Author: Jesús Lorenzo
 * License: MIT
 */

/* ═══ core/logger.js ═══ */
/**
 * TM Framework - Logger Module
 * Global logging system with configurable levels
 *
 * @module TMLogger
 * @version 1.0.0
 */

const TMLogger = (function() {
    'use strict';

    /**
     * Logger - Sistema de logging global para el framework
     *
     * @example
     * TM.Logger.configure({ enabled: true, level: 'debug' });
     * TM.Logger.info('Component', 'Mounted successfully');
     * TM.Logger.error('Reactive', 'Proxy creation failed', { target });
     */
    const Logger = {
        /**
         * Logger configuration
         * @type {Object}
         */
        config: {
            /** @type {boolean} Whether logging is enabled */
            enabled: false,
            /** @type {string} Minimum log level: 'debug' | 'info' | 'warn' | 'error' */
            level: 'warn',
            /** @type {string} Prefix for all log messages */
            prefix: '[TM]',
            /** @type {boolean} Include timestamps in log messages */
            timestamps: false,
        },

        /**
         * Log level priorities (lower = more verbose)
         * @type {Object}
         */
        levels: {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        },

        /**
         * Configure logger settings
         * @param {Object} options - Configuration options
         * @param {boolean} [options.enabled] - Enable/disable logging
         * @param {string} [options.level] - Minimum log level
         * @param {string} [options.prefix] - Log message prefix
         * @param {boolean} [options.timestamps] - Include timestamps
         */
        configure(options = {}) {
            Object.assign(this.config, options);
        },

        /**
         * Check if a log level should be output
         * @param {string} level - Log level to check
         * @returns {boolean} Whether the level should be logged
         */
        shouldLog(level) {
            if (!this.config.enabled) return false;
            return this.levels[level] >= this.levels[this.config.level];
        },

        /**
         * Format a log message with prefix, timestamp, and module
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @returns {string} Formatted message
         */
        format(module, message) {
            const parts = [this.config.prefix];
            if (this.config.timestamps) {
                parts.push(new Date().toISOString());
            }
            parts.push(`[${module}]`);
            parts.push(message);
            return parts.join(' ');
        },

        /**
         * Log a message at the specified level
         * @param {string} level - Log level ('debug' | 'info' | 'warn' | 'error')
         * @param {string} module - Module name (e.g., 'Component', 'Reactive')
         * @param {string} message - Log message
         * @param {any} [data] - Optional additional data to log
         */
        log(level, module, message, data) {
            if (!this.shouldLog(level)) return;

            const formatted = this.format(module, message);
            const method = level === 'debug' ? 'log' : level;

            if (data !== undefined) {
                console[method](formatted, data);
            } else {
                console[method](formatted);
            }
        },

        /**
         * Log a debug message
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @param {any} [data] - Optional data
         */
        debug(module, message, data) {
            this.log('debug', module, message, data);
        },

        /**
         * Log an info message
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @param {any} [data] - Optional data
         */
        info(module, message, data) {
            this.log('info', module, message, data);
        },

        /**
         * Log a warning message
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @param {any} [data] - Optional data
         */
        warn(module, message, data) {
            this.log('warn', module, message, data);
        },

        /**
         * Log an error message
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @param {any} [data] - Optional data
         */
        error(module, message, data) {
            this.log('error', module, message, data);
        },
    };

    return { Logger };
})();

// Export for CommonJS (Node.js build)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TMLogger;
}


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
                            if (typeof TMLogger !== 'undefined' && TMLogger?.Logger?.error) {
                                TMLogger.Logger.error('Reactive', 'Listener error', e);
                            } else {
                                console.error('[TM] [Reactive] Listener error', e);
                            }
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
    globalThis.TMReactive = TMReactive;
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
            this._lastRender = null; // Cache last render for diffing
            this._updateCount = 0; // Track update frequency
            this._componentId = this.constructor.name + '_' + Date.now().toString(36); // Unique ID for logging
            
            // Debug logging
            this._debugMode = window?.TM_DEBUG || false;
            this._updateLog = []; // Track update history
            this._stateChangeLog = []; // Track state changes
            
            this._log('debug', `Component ${this._componentId} created with props:`, this.props);
            
            // Auto-subscribe to state changes with debouncing
            if (this.state.__subscribe) {
                this._unsubscribers.push(
                    this.state.__subscribe((prop, newVal, oldVal) => {
                        // Log state changes
                        this._logStateChange(prop, newVal, oldVal);
                        
                        // Skip updates during rapid state changes
                        if (this._stateChangeTimeout) {
                            clearTimeout(this._stateChangeTimeout);
                        }
                        
                        this._stateChangeTimeout = setTimeout(() => {
                            this._scheduleUpdate('state_change');
                            this._stateChangeTimeout = null;
                        }, 10); // Small delay to batch rapid changes
                    })
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
                TMLogger.Logger.error('Component', 'Container not found');
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
                this._log('warn', `Event ${eventName} skipped to prevent recursion`);
                return;
            }
            
            this._emittingEvents.add(eventName);
            
            try {
                this._log('debug', `Emitting event: ${eventName}`, detail);
                this._el?.dispatchEvent(new CustomEvent(eventName, {
                    detail,
                    bubbles: true,
                    composed: true
                }));
            } catch (error) {
                this._log('error', `Error emitting event ${eventName}:`, error);
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
            this._log('info', `🗑️ DESTROYING component ${this._componentId}`);
            
            // Clear any pending updates
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
                this._updateTimeout = null;
            }
            
            if (this._stateChangeTimeout) {
                clearTimeout(this._stateChangeTimeout);
                this._stateChangeTimeout = null;
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
            this._userInteracting = false;
            
            // Remove from global registry
            if (typeof window !== 'undefined' && window[this._componentId]) {
                delete window[this._componentId];
            }
            
            // Final debug info dump
            if (this._debugMode || this._componentLogs?.some(log => log.level === 'error')) {
                this._log('info', `Component ${this._componentId} final state:`, this.getDebugInfo());
            }
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
            if (!el || !el.dataset) return;
            
            // Add component identifier for debugging
            el.dataset.tmComponent = this._componentId;
            
            // Make component accessible globally for debugging
            if (!window[this._componentId]) {
                window[this._componentId] = this;
            }
            
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
                            TMLogger.Logger.warn('Component', `Handler "${handlerName}" not found`);
                        }
                        
                        node.removeAttribute(attr.name);
                    }
                });
            };
            
            processNode(el);
            el.querySelectorAll('*').forEach(processNode);
            
            // Add interaction tracking to prevent disruptive updates
            this._setupInteractionTracking(el);
        }
        
        _setupInteractionTracking(el) {
            const interactions = ['mousedown', 'keydown', 'focus', 'input', 'change'];
            const interactionEnd = ['mouseup', 'keyup', 'blur'];
            
            interactions.forEach(event => {
                el.addEventListener(event, () => {
                    this._setUserInteracting(true);
                }, true);
            });
            
            interactionEnd.forEach(event => {
                el.addEventListener(event, () => {
                    setTimeout(() => {
                        this._setUserInteracting(false);
                    }, 200);
                }, true);
            });
        }

        _finishMount() {
            this._mounted = true;
            this.onMount();
        }

        _scheduleUpdate(reason = 'unknown') {
            if (!this._mounted) {
                this._log('warn', `Update skipped - component not mounted (${reason})`);
                return;
            }
            
            if (this._updateScheduled) {
                this._log('debug', `Update already scheduled - skipping (${reason})`);
                return;
            }
            
            this._updateScheduled = true;
            this._updateCount++;
            
            const updateInfo = {
                reason,
                timestamp: Date.now(),
                updateCount: this._updateCount,
                state: this.state.__raw,
                props: this.props
            };
            
            this._log('info', `🔄 UPDATE SCHEDULED #${this._updateCount} (${reason})`, updateInfo);
            
            // Skip updates if user is actively interacting
            if (this._userInteracting) {
                this._log('debug', `Update deferred - user interacting (${reason})`);
                this._updateScheduled = false;
                this._pendingUpdateReason = reason;
                return;
            }
            
            // Aggressive debouncing to prevent rapid updates
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
                this._log('debug', `Previous update cancelled, scheduling new one`);
            }
            
            // Longer delay for stability
            this._updateTimeout = setTimeout(() => {
                this._updateScheduled = false;
                this._update(updateInfo);
                this._updateTimeout = null;
                this._updateCount = 0; // Reset counter
            }, 50); // Longer debounce for stability
        }
        
        /**
         * Call this during user interactions to prevent disruptive updates
         */
        _setUserInteracting(interacting = true) {
            this._userInteracting = interacting;
            
            if (!interacting && this._pendingUpdateReason) {
                const pendingReason = this._pendingUpdateReason;
                this._pendingUpdateReason = null
                // Schedule update when interaction ends
                this._updateTimeout = setTimeout(() => {
                    this._scheduleUpdate(pendingReason);
                }, 100);
            }
        }

        _update(updateInfo = {}) {
            const updateId = `update_${Date.now().toString(36)}`;
            
            if (!this._el || !this._mounted) {
                this._log('warn', `Update ${updateId} cancelled - no element or not mounted`);
                return;
            }
            
            // Throttle rapid successive updates
            if (this._updateCount > 5) {
                this._log('error', `Update ${updateId} SKIPPED - too many updates (${this._updateCount})`);
                return;
            }
            
            const startTime = performance.now();
            this._log('info', `🔄 UPDATE STARTING ${updateId}`, { ...updateInfo, updateId });
            
            try {
                // Get current render string
                const rendered = this.render();
                const renderString = rendered instanceof HTMLElement
                    ? rendered.outerHTML
                    : String(rendered ?? '')
                
                // Skip if render is the same as last time
                if (this._lastRender === renderString) {
                    this._log('debug', `Update ${updateId} SKIPPED - no render changes`);
                    return;
                }
                
                this._lastRender = renderString;
                this._log('debug', `Update ${updateId} - render changed, proceeding`);
                
                // Store scroll position
                const scrollPos = this._el.scrollTop;
                
                // Create new element
                const newEl = rendered instanceof HTMLElement
                    ? rendered
                    : (() =>{
                        const wrapper = document.createElement('div');
                        wrapper.innerHTML = renderString.trim();
                        return wrapper.children.length === 1
                            ? wrapper.firstElementChild
                            : wrapper;
                    })
                
                // Only replace if significantly different
                if (this._shouldUpdate(this._el, newEl)) {
                    this._log('info', `Update ${updateId} - DOM CHANGED, replacing element`);
                    
                    // Process new element before replacing
                    this._processElement(newEl);
                    
                    // Store old element info for comparison
                    const oldInfo = {
                        tagName: this._el.tagName,
                        className: this._el.className,
                        childCount: this._el.children.length,
                        innerHTMLLength: this._el.innerHTML.length
                    };
                    
                    // Replace element
                    this._el.replaceWith(newEl);
                    this._el = newEl;
                    
                    // Restore scroll
                    this._el.scrollTop = scrollPos;
                    
                    const newInfo = {
                        tagName: this._el.tagName,
                        className: this._el.className,
                        childCount: this._el.children.length,
                        innerHTMLLength: this._el.innerHTML.length
                    };
                    
                    this._log('info', `Update ${updateId} - REPLACEMENT COMPLETE`, { old: oldInfo, new: newInfo });
                } else {
                    this._log('debug', `Update ${updateId} - SKIPPED - no significant DOM changes`);
                }
            } catch (error) {
                this._log('error', `Update ${updateId} FAILED:`, error);
            }
            
            // Performance monitoring
            const updateTime = performance.now() - startTime;
            this._log('performance', `Update ${updateId} completed in ${updateTime.toFixed(2)}ms`);
            
            if (updateTime > 100) {
                this._log('warn', `⚠️ SLOW UPDATE ${updateId}: ${updateTime.toFixed(2)}ms`, { updateInfo });
            }
            
            // Log update history
            this._updateLog.push({
                id: updateId,
                timestamp: Date.now(),
                duration: updateTime,
                reason: updateInfo.reason,
                stateSnapshot: this.state.__raw,
                successful: true
            });
            
            // Keep only last 20 updates
            if (this._updateLog.length > 20) {
                this._updateLog = this._updateLog.slice(-20);
            }
            
            this.onUpdate();
        }
        
        /**
         * Enhanced logging system
         */
        _log(level, message, data = null) {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                component: this._componentId,
                level,
                message,
                data
            };
            
            const prefix = `[${timestamp}] [${this._componentId}] [${level.toUpperCase()}]`;
            
            switch (level) {
                case 'error':
                    console.error(prefix, message, data);
                    break;
                case 'warn':
                    console.warn(prefix, message, data);
                    break;
                case 'info':
                    console.info(prefix, message, data);
                    break;
                case 'performance':
                    console.info(`%c${prefix} ${message}`, 'color: #8A2BE2', data);
                    break;
                default: // debug
                    if (this._debugMode) {
                        console.log(prefix, message, data);
                    }
            }
            
            // Store important logs
            if (['error', 'warn', 'info', 'performance'].includes(level)) {
                if (!this._componentLogs) this._componentLogs = [];
                this._componentLogs.push(logEntry);
                
                // Keep only last 50 logs
                if (this._componentLogs.length > 50) {
                    this._componentLogs = this._componentLogs.slice(-50);
                }
            }
        }
        
        /**
         * Log state changes with detailed information
         */
        _logStateChange(prop, newVal, oldVal) {
            const changeEntry = {
                timestamp: Date.now(),
                property: prop,
                oldValue: oldVal,
                newValue: newVal,
                type: this._getChangeType(newVal, oldVal),
                stackTrace: this._debugMode ? new Error().stack : null
            };
            
            this._stateChangeLog.push(changeEntry);
            
            // Keep only last 30 changes
            if (this._stateChangeLog.length > 30) {
                this._stateChangeLog = this._stateChangeLog.slice(-30);
            }
            
            // Only log state changes in debug mode or for significant changes
            if (this._debugMode || this._isSignificantChange(newVal, oldVal)) {
                this._log('debug', `🔄 STATE CHANGE: ${prop}`, changeEntry);
            }
        }
        
        _getChangeType(newVal, oldVal) {
            if (newVal === oldVal) return 'none';
            if (typeof newVal !== typeof oldVal) return 'type_change';
            if (Array.isArray(newVal) && Array.isArray(oldVal)) {
                return newVal.length !== oldVal.length ? 'array_length' : 'array_content';
            }
            if (typeof newVal === 'object' && typeof oldVal === 'object') {
                return 'object_content';
            }
            return 'value_change';
        }
        
        _isSignificantChange(newVal, oldVal) {
            // Consider changes significant if they affect UI
            if (typeof newVal !== typeof oldVal) return true;
            if (Array.isArray(newVal) && Array.isArray(oldVal)) {
                return newVal.length !== oldVal.length;
            }
            if (typeof newVal === 'object' && typeof oldVal === 'object') {
                return JSON.stringify(newVal) !== JSON.stringify(oldVal);
            }
            return newVal !== oldVal;
        }
        
        /**
         * Get debugging information
         */
        getDebugInfo() {
            return {
                componentId: this._componentId,
                mounted: this._mounted,
                updateScheduled: this._updateScheduled,
                updateCount: this._updateCount,
                lastRender: this._lastRender ? this._lastRender.substring(0, 200) + '...' : null,
                updateHistory: this._updateLog.slice(-10),
                stateChangeHistory: this._stateChangeLog.slice(-10),
                componentLogs: this._componentLogs ? this._componentLogs.slice(-20) : [],
                currentProps: this.props,
                currentState: this.state.__raw,
                refs: Object.keys(this.refs),
                childrenCount: this._children.size
            };
        }
        
        /**
         * Print debug information to console
         */
        debug() {
            const info = this.getDebugInfo();
            console.group(`🔍 TM Component Debug: ${this._componentId}`);
            console.log('Component Info:', info);
            
            if (info.updateHistory.length > 0) {
                console.group('📈 Update History');
                info.updateHistory.forEach((update, i) => {
                    console.log(`${i + 1}.`, update);
                });
                console.groupEnd();
            }
            
            if (info.stateChangeHistory.length > 0) {
                console.group('🔄 State Change History');
                info.stateChangeHistory.forEach((change, i) => {
                    console.log(`${i + 1}.`, change);
                });
                console.groupEnd();
            }
            
            console.groupEnd();
            
            return info;
        }
        
        _shouldUpdate(oldEl, newEl) {
            if (!oldEl || !newEl) return true;
            
            // Compare class names
            if (oldEl.className !== newEl.className) return true;
            
            // Compare text content for simple elements
            if (oldEl.children.length === 0 && newEl.children.length === 0) {
                return oldEl.textContent !== newEl.textContent;
            }
            
            // For complex elements, check child count difference
            if (oldEl.children.length !== newEl.children.length) return true;
            
            // Additional basic checks
            if (oldEl.innerHTML !== newEl.innerHTML) {
                // More detailed diffing for complex structures
                return this._hasSignificantChanges(oldEl, newEl);
            }
            
            return false;
        }
        
        _hasSignificantChanges(oldEl, newEl) {
            // Skip updates if only data attributes changed
            const oldData = Array.from(oldEl.attributes).filter(attr => attr.name.startsWith('data-'));
            const newData = Array.from(newEl.attributes).filter(attr => attr.name.startsWith('data-'));
            
            // If only data attributes changed and count is the same, skip
            const oldNonData = Array.from(oldEl.attributes).filter(attr => !attr.name.startsWith('data-'));
            const newNonData = Array.from(newEl.attributes).filter(attr => !attr.name.startsWith('data-'));
            
            return oldNonData.length !== newNonData.length || 
                   oldNonData.some(attr => attr.value !== newEl.getAttribute(attr.name));
        }
    }

    return { Component };
})();

// Export
if (typeof window !== 'undefined') {
    globalThis.TMComponent = TMComponent;
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
                TMLogger.Logger.warn('Utils', `Element "${selector}" not found after ${timeout}ms`);
                reject(new Error(`Element "${selector}" not found after ${timeout}ms`));
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
    function parseUrlParams(url = globalThis.location.href) {
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
    globalThis.TMUtils = TMUtils;
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
            if (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches) {
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
        globalThis.matchMedia?.('(prefers-color-scheme: dark)')
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
    globalThis.TMTheme = TMTheme;
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
    
    const { Logger } = TMLogger;
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

        // Logger
        Logger,

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
        
        // Debugging
        debug: {
            enabled: false,
            enable() {
                this.enabled = true;
                globalThis.TM_DEBUG = true;
                console.log('[TM Debug] Debug mode enabled');
            },
            disable() {
                this.enabled = false;
                globalThis.TM_DEBUG = false;
                console.log('[TM Debug] Debug mode disabled');
            },
            getAllComponentInfo() {
                const components = [];
                document?.querySelectorAll('[data-tm-component]').forEach(el => {
                    const componentId = el.dataset.tmComponent;
                    if (window[componentId] && window[componentId].getDebugInfo) {
                        components.push(window[componentId].getDebugInfo());
                    }
                });
                return components;
            },
            printAllDebugInfo() {
                const info = this.getAllComponentInfo();
                console.group('🔍 TM Framework Debug - All Components');
                info.forEach(comp => {
                    console.group(`Component: ${comp.componentId}`);
                    console.log(comp);
                    console.groupEnd();
                });
                console.groupEnd();
                return info;
            },
            clearLogs() {
                document?.querySelectorAll('[data-tm-component]').forEach(el => {
                    const componentId = el.dataset.tmComponent;
                    if (window[componentId]) {
                        window[componentId]._componentLogs = [];
                        window[componentId]._updateLog = [];
                        window[componentId]._stateChangeLog = [];
                    }
                });
                console.log('[TM Debug] All component logs cleared');
            }
        },
        
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
    globalThis.TM = TM;
}

// Export for CommonJS (Node.js build)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM;
}

/* ═══ components/forms/index.js ═══ */
/**
 * TM Framework - Form Components
 * Button, Input, Textarea, Select, Checkbox, Switch
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames } = TM;

    // ═══════════════════════════════════════════════════════════════
    // BUTTON
    // ═══════════════════════════════════════════════════════════════
    
    class Button extends Component {
        static defaultProps = {
            text: '',
            variant: 'primary',  // primary, secondary, success, danger, warning, ghost
            size: 'md',          // sm, md, lg
            icon: null,
            iconPosition: 'left',
            disabled: false,
            loading: false,
            block: false,
            type: 'button',
            onClick: null
        };

        render() {
            const { text, variant, size, icon, iconPosition, disabled, loading, block, type } = this.props;
            
            const classes = classNames(
                'tm-btn', 'tm-component',
                `tm-btn--${variant}`,
                size !== 'md' && `tm-btn--${size}`,
                block && 'tm-btn--block',
                !text && icon && 'tm-btn--icon'
            );

            const iconHtml = icon ? `<span class="tm-btn__icon">${icon}</span>` : '';
            const spinner = '<span class="tm-spinner tm-spinner--sm"></span>';
            
            return html`
                <button 
                    class="${classes}" 
                    type="${type}" 
                    ${disabled || loading ? 'disabled' : ''} 
                    @click="handleClick"
                >
                    ${loading ? spinner : (iconPosition === 'left' ? iconHtml : '')}
                    ${text ? `<span class="tm-btn__text">${text}</span>` : ''}
                    ${!loading && iconPosition === 'right' ? iconHtml : ''}
                </button>
            `;
        }

        handleClick(e) {
            if (this.props.loading || this.props.disabled) return;
            this.props.onClick?.(e);
            this.emit('click', { originalEvent: e });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INPUT
    // ═══════════════════════════════════════════════════════════════
    
    class Input extends Component {
        static defaultProps = {
            type: 'text',
            value: '',
            placeholder: '',
            label: null,
            helper: null,
            error: null,
            disabled: false,
            readonly: false,
            required: false,
            size: 'md',
            prefix: null,
            suffix: null,
            onInput: null,
            onChange: null,
            onFocus: null,
            onBlur: null
        };

        initialState() {
            return { 
                value: this.props.value,
                focused: false
            };
        }

        render() {
            const { type, placeholder, label, helper, error, disabled, readonly, required, size, prefix, suffix } = this.props;
            const { focused } = this.state;
            
            const wrapperClasses = classNames(
                'tm-input-wrapper',
                focused && 'tm-input-wrapper--focused',
                error && 'tm-input-wrapper--error',
                disabled && 'tm-input-wrapper--disabled'
            );
            
            const inputClasses = classNames(
                'tm-input',
                size !== 'md' && `tm-input--${size}`,
                error && 'tm-input--error'
            );

            return html`
                <div class="tm-form-group tm-component">
                    ${label ? `<label class="tm-label">${label}${required ? ' <span class="tm-required">*</span>' : ''}</label>` : ''}
                    <div class="${wrapperClasses}">
                        ${prefix ? `<span class="tm-input__prefix">${prefix}</span>` : ''}
                        <input 
                            ref="input"
                            class="${inputClasses}"
                            type="${type}"
                            value="${this.state.value}"
                            placeholder="${placeholder}"
                            ${disabled ? 'disabled' : ''}
                            ${readonly ? 'readonly' : ''}
                            ${required ? 'required' : ''}
                            @input="handleInput"
                            @change="handleChange"
                            @focus="handleFocus"
                            @blur="handleBlur"
                        />
                        ${suffix ? `<span class="tm-input__suffix">${suffix}</span>` : ''}
                    </div>
                    ${error ? `<span class="tm-error">${error}</span>` : ''}
                    ${helper && !error ? `<span class="tm-helper">${helper}</span>` : ''}
                </div>
            `;
        }

        handleInput(e) {
            this.state.value = e.target.value;
            this.props.onInput?.(e.target.value, e);
            this.emit('input', { value: e.target.value });
        }

        handleChange(e) {
            this.props.onChange?.(e.target.value, e);
            this.emit('change', { value: e.target.value });
        }

        handleFocus(e) {
            this.state.focused = true;
            this.props.onFocus?.(e);
        }

        handleBlur(e) {
            this.state.focused = false;
            this.props.onBlur?.(e);
        }

        // Public API

        /**
         * Gets the current input value
         * @returns {string} Current input value
         */
        getValue() { return this.state.value; }

        /**
         * Sets the input value programmatically
         * @param {string} val - New value to set
         */
        setValue(val) { this.state.value = val; }

        /**
         * Focuses the input element
         */
        focus() { this.refs.input?.focus(); }

        /**
         * Removes focus from the input element
         */
        blur() { this.refs.input?.blur(); }

        /**
         * Clears the input value
         */
        clear() { this.state.value = ''; }
    }

    // ═══════════════════════════════════════════════════════════════
    // TEXTAREA
    // ═══════════════════════════════════════════════════════════════
    
    class Textarea extends Component {
        static defaultProps = {
            value: '',
            placeholder: '',
            label: null,
            helper: null,
            error: null,
            disabled: false,
            rows: 4,
            maxLength: null,
            autoResize: false,
            onInput: null
        };

        initialState() {
            return { value: this.props.value };
        }

        render() {
            const { placeholder, label, helper, error, disabled, rows, maxLength, autoResize } = this.props;
            const charCount = maxLength ? `${this.state.value.length}/${maxLength}` : '';
            
            return html`
                <div class="tm-form-group tm-component">
                    ${label ? `<label class="tm-label">${label}</label>` : ''}
                    <textarea 
                        ref="textarea"
                        class="tm-input tm-textarea ${error ? 'tm-input--error' : ''}"
                        placeholder="${placeholder}"
                        rows="${rows}"
                        ${disabled ? 'disabled' : ''}
                        ${maxLength ? `maxlength="${maxLength}"` : ''}
                        @input="handleInput"
                    >${this.state.value}</textarea>
                    <div class="tm-textarea__footer">
                        ${error ? `<span class="tm-error">${error}</span>` : ''}
                        ${helper && !error ? `<span class="tm-helper">${helper}</span>` : ''}
                        ${maxLength ? `<span class="tm-helper tm-textarea__count">${charCount}</span>` : ''}
                    </div>
                </div>
            `;
        }

        handleInput(e) {
            this.state.value = e.target.value;
            
            if (this.props.autoResize) {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
            }
            
            this.props.onInput?.(e.target.value, e);
            this.emit('input', { value: e.target.value });
        }

        getValue() { return this.state.value; }
        setValue(val) { this.state.value = val; }
        focus() { this.refs.textarea?.focus(); }
    }

    // ═══════════════════════════════════════════════════════════════
    // SELECT
    // ═══════════════════════════════════════════════════════════════
    
    class Select extends Component {
        static defaultProps = {
            value: '',
            options: [],  // [{ value, label, disabled }] or ['string']
            label: null,
            placeholder: 'Seleccionar...',
            helper: null,
            error: null,
            disabled: false,
            required: false,
            searchable: false,
            onChange: null
        };

        initialState() {
            return { 
                value: this.props.value,
                open: false,
                search: ''
            };
        }

        render() {
            const { options, label, placeholder, helper, error, disabled, required } = this.props;
            
            const normalizedOptions = options.map(opt => 
                typeof opt === 'object' ? opt : { value: opt, label: opt }
            );
            
            const optionsHtml = normalizedOptions.map(opt => {
                const selected = opt.value === this.state.value ? 'selected' : '';
                const optDisabled = opt.disabled ? 'disabled' : '';
                return `<option value="${opt.value}" ${selected} ${optDisabled}>${opt.label}</option>`;
            }).join('');

            return html`
                <div class="tm-form-group tm-component">
                    ${label ? `<label class="tm-label">${label}${required ? ' <span class="tm-required">*</span>' : ''}</label>` : ''}
                    <select 
                        ref="select"
                        class="tm-input tm-select ${error ? 'tm-input--error' : ''}"
                        ${disabled ? 'disabled' : ''}
                        ${required ? 'required' : ''}
                        @change="handleChange"
                    >
                        <option value="" disabled ${!this.state.value ? 'selected' : ''}>${placeholder}</option>
                        ${optionsHtml}
                    </select>
                    ${error ? `<span class="tm-error">${error}</span>` : ''}
                    ${helper && !error ? `<span class="tm-helper">${helper}</span>` : ''}
                </div>
            `;
        }

        handleChange(e) {
            this.state.value = e.target.value;
            this.props.onChange?.(e.target.value, e);
            this.emit('change', { value: e.target.value });
        }

        getValue() { return this.state.value; }
        setValue(val) { this.state.value = val; }
    }

    // ═══════════════════════════════════════════════════════════════
    // CHECKBOX
    // ═══════════════════════════════════════════════════════════════
    
    class Checkbox extends Component {
        static defaultProps = {
            checked: false,
            label: '',
            disabled: false,
            indeterminate: false,
            onChange: null
        };

        initialState() {
            return { checked: this.props.checked };
        }

        render() {
            const { label, disabled, indeterminate } = this.props;
            
            return html`
                <label class="tm-checkbox tm-component ${disabled ? 'tm-checkbox--disabled' : ''}">
                    <input 
                        ref="checkbox"
                        type="checkbox"
                        class="tm-checkbox__input"
                        ${this.state.checked ? 'checked' : ''}
                        ${disabled ? 'disabled' : ''}
                        @change="handleChange"
                    />
                    <span class="tm-checkbox__box ${indeterminate ? 'tm-checkbox__box--indeterminate' : ''}"></span>
                    ${label ? `<span class="tm-checkbox__label">${label}</span>` : ''}
                </label>
            `;
        }

        handleChange(e) {
            this.state.checked = e.target.checked;
            this.props.onChange?.(e.target.checked, e);
            this.emit('change', { checked: e.target.checked });
        }

        isChecked() { return this.state.checked; }
        setChecked(val) { this.state.checked = val; }
        toggle() { this.state.checked = !this.state.checked; }
    }

    // ═══════════════════════════════════════════════════════════════
    // SWITCH (Toggle)
    // ═══════════════════════════════════════════════════════════════
    
    class Switch extends Component {
        static defaultProps = {
            checked: false,
            label: '',
            labelPosition: 'right',  // left, right
            disabled: false,
            size: 'md',
            onChange: null
        };

        initialState() {
            return { checked: this.props.checked };
        }

        render() {
            const { label, labelPosition, disabled, size } = this.props;
            
            const labelHtml = label ? `<span class="tm-switch__label">${label}</span>` : '';
            
            return html`
                <label class="tm-switch tm-component tm-switch--${size} ${disabled ? 'tm-switch--disabled' : ''}">
                    ${labelPosition === 'left' ? labelHtml : ''}
                    <input 
                        ref="switch"
                        type="checkbox"
                        class="tm-switch__input"
                        ${this.state.checked ? 'checked' : ''}
                        ${disabled ? 'disabled' : ''}
                        @change="handleChange"
                    />
                    <span class="tm-switch__track">
                        <span class="tm-switch__thumb"></span>
                    </span>
                    ${labelPosition === 'right' ? labelHtml : ''}
                </label>
            `;
        }

        handleChange(e) {
            this.state.checked = e.target.checked;
            this.props.onChange?.(e.target.checked, e);
            this.emit('change', { checked: e.target.checked });
        }

        isChecked() { return this.state.checked; }
        setChecked(val) { this.state.checked = val; }
        toggle() { this.state.checked = !this.state.checked; }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Button = Button;
    TM.Input = Input;
    TM.Textarea = Textarea;
    TM.Select = Select;
    TM.Checkbox = Checkbox;
    TM.Switch = Switch;

})();

/* ═══ components/overlay/index.js ═══ */
/**
 * TM Framework - Overlay Components
 * Modal, Drawer, Tooltip, ContextMenu
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // MODAL
    // ═══════════════════════════════════════════════════════════════
    
    class Modal extends Component {
        static defaultProps = {
            title: '',
            width: '500px',
            maxHeight: '90vh',
            closable: true,
            closeOnOverlay: true,
            closeOnEsc: true,
            footer: true,
            confirmText: 'Aceptar',
            cancelText: 'Cancelar',
            confirmVariant: 'primary',
            showCancel: true,
            loading: false,
            onConfirm: null,
            onCancel: null,
            onClose: null,
            onOpen: null
        };

        initialState() {
            return { 
                visible: false,
                confirmLoading: false
            };
        }

        onMount() {
            // Handle ESC key
            this._escHandler = (e) => {
                if (e.key === 'Escape' && this.state.visible && this.props.closeOnEsc) {
                    this.close();
                }
            };
            document.addEventListener('keydown', this._escHandler);
        }

        onDestroy() {
            document.removeEventListener('keydown', this._escHandler);
            document.body.style.overflow = '';
        }

        render() {
            if (!this.state.visible) {
                return '<div class="tm-modal-anchor" style="display:none"></div>';
            }
            
            const { title, width, maxHeight, closable, footer, confirmText, cancelText, confirmVariant, showCancel, loading } = this.props;
            const { confirmLoading } = this.state;

            return html`
                <div class="tm-overlay tm-component" @click="handleOverlayClick">
                    <div class="tm-modal" style="width: ${width}; max-height: ${maxHeight};" @click="stopPropagation">
                        <div class="tm-modal__header">
                            <h3 class="tm-modal__title">${title}</h3>
                            ${closable ? `
                                <button class="tm-btn tm-btn--ghost tm-btn--icon tm-modal__close" @click="handleClose">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        <div class="tm-modal__body" ref="body">
                            <!-- Content -->
                        </div>
                        ${footer ? html`
                            <div class="tm-modal__footer">
                                ${showCancel ? `
                                    <button class="tm-btn tm-btn--secondary" @click="handleCancel" ${loading ? 'disabled' : ''}>
                                        ${cancelText}
                                    </button>
                                ` : ''}
                                <button class="tm-btn tm-btn--${confirmVariant}" @click="handleConfirm" ${confirmLoading ? 'disabled' : ''}>
                                    ${confirmLoading ? '<span class="tm-spinner tm-spinner--sm"></span>' : ''}
                                    ${confirmText}
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        /**
         * Opens the modal
         * @fires open
         */
        open() {
            this.state.visible = true;
            document.body.style.overflow = 'hidden';
            this.props.onOpen?.();
            this.emit('open');
        }

        /**
         * Closes the modal
         * @fires close
         */
        close() {
            this.state.visible = false;
            this.state.confirmLoading = false;
            document.body.style.overflow = '';
            this.props.onClose?.();
            this.emit('close');
        }

        /**
         * Updates the modal body content
         * @param {string|Component|HTMLElement} content - New content to display
         */
        setContent(content) {
            requestAnimationFrame(() => {
                if (!this.refs.body) return;

                if (typeof content === 'string') {
                    this.refs.body.innerHTML = content;
                } else if (content instanceof Component) {
                    this.refs.body.innerHTML = '';
                    content.mount(this.refs.body);
                    this.addChild('content', content);
                } else if (content instanceof HTMLElement) {
                    this.refs.body.innerHTML = '';
                    this.refs.body.appendChild(content);
                }
            });
        }

        /**
         * Sets the confirm button loading state
         * @param {boolean} loading - Loading state
         */
        setConfirmLoading(loading) {
            this.state.confirmLoading = loading;
        }

        handleOverlayClick(e) {
            if (this.props.closeOnOverlay && e.target.classList.contains('tm-overlay')) {
                this.close();
            }
        }

        stopPropagation(e) {
            e.stopPropagation();
        }

        handleClose() {
            this.close();
        }

        async handleConfirm() {
            const result = this.props.onConfirm?.();
            
            // If onConfirm returns a promise, show loading
            if (result instanceof Promise) {
                this.state.confirmLoading = true;
                try {
                    await result;
                    this.close();
                } catch (e) {
                    console.error('[TM Modal] Confirm error:', e);
                } finally {
                    this.state.confirmLoading = false;
                }
            } else {
                this.emit('confirm');
            }
        }

        handleCancel() {
            this.props.onCancel?.();
            this.emit('cancel');
            this.close();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DRAWER (Side Panel)
    // ═══════════════════════════════════════════════════════════════
    
    class Drawer extends Component {
        static defaultProps = {
            title: '',
            position: 'right',  // left, right, top, bottom
            size: '400px',
            closable: true,
            closeOnOverlay: true,
            closeOnEsc: true,
            footer: false,
            onClose: null
        };

        initialState() {
            return { visible: false };
        }

        onMount() {
            this._escHandler = (e) => {
                if (e.key === 'Escape' && this.state.visible && this.props.closeOnEsc) {
                    this.close();
                }
            };
            document.addEventListener('keydown', this._escHandler);
        }

        onDestroy() {
            document.removeEventListener('keydown', this._escHandler);
            document.body.style.overflow = '';
        }

        render() {
            if (!this.state.visible) {
                return '<div class="tm-drawer-anchor" style="display:none"></div>';
            }
            
            const { title, position, size, closable, footer } = this.props;
            
            const isHorizontal = position === 'left' || position === 'right';
            const sizeStyle = isHorizontal ? `width: ${size}` : `height: ${size}`;

            return html`
                <div class="tm-overlay tm-component" @click="handleOverlayClick">
                    <div class="tm-drawer tm-drawer--${position}" style="${sizeStyle}">
                        <div class="tm-drawer__header">
                            <h3 class="tm-drawer__title">${title}</h3>
                            ${closable ? `
                                <button class="tm-btn tm-btn--ghost tm-btn--icon" @click="handleClose">✕</button>
                            ` : ''}
                        </div>
                        <div class="tm-drawer__body" ref="body">
                            <!-- Content -->
                        </div>
                        ${footer ? '<div class="tm-drawer__footer" ref="footer"></div>' : ''}
                    </div>
                </div>
            `;
        }

        open() {
            this.state.visible = true;
            document.body.style.overflow = 'hidden';
            this.emit('open');
        }

        close() {
            this.state.visible = false;
            document.body.style.overflow = '';
            this.props.onClose?.();
            this.emit('close');
        }

        setContent(content) {
            requestAnimationFrame(() => {
                if (!this.refs.body) return;
                
                if (typeof content === 'string') {
                    this.refs.body.innerHTML = content;
                } else if (content instanceof Component) {
                    this.refs.body.innerHTML = '';
                    content.mount(this.refs.body);
                } else if (content instanceof HTMLElement) {
                    this.refs.body.innerHTML = '';
                    this.refs.body.appendChild(content);
                }
            });
        }

        handleOverlayClick(e) {
            if (this.props.closeOnOverlay && e.target.classList.contains('tm-overlay')) {
                this.close();
            }
        }

        handleClose() {
            this.close();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP
    // ═══════════════════════════════════════════════════════════════
    
    class Tooltip extends Component {
        static defaultProps = {
            text: '',
            position: 'top',  // top, bottom, left, right
            trigger: 'hover', // hover, click, manual
            delay: 200
        };

        initialState() {
            return { visible: false };
        }

        render() {
            const { text, position } = this.props;
            
            return html`
                <div class="tm-tooltip-wrapper tm-component" ref="wrapper">
                    <div class="tm-tooltip-trigger" ref="trigger">
                        <slot></slot>
                    </div>
                    ${this.state.visible ? `
                        <div class="tm-tooltip tm-tooltip--${position}" ref="tooltip">
                            <div class="tm-tooltip__content">${text}</div>
                            <div class="tm-tooltip__arrow"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        onMount() {
            const { trigger, delay } = this.props;
            
            if (trigger === 'hover') {
                this.refs.wrapper?.addEventListener('mouseenter', () => {
                    this._timeout = setTimeout(() => this.show(), delay);
                });
                this.refs.wrapper?.addEventListener('mouseleave', () => {
                    clearTimeout(this._timeout);
                    this.hide();
                });
            } else if (trigger === 'click') {
                this.refs.wrapper?.addEventListener('click', () => this.toggle());
            }
        }

        show() { this.state.visible = true; }
        hide() { this.state.visible = false; }
        toggle() { this.state.visible = !this.state.visible; }
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTEXT MENU
    // ═══════════════════════════════════════════════════════════════
    
    class ContextMenu extends Component {
        static defaultProps = {
            items: [],  // [{ label, icon?, action?, divider?, disabled?, children? }]
            onSelect: null
        };

        initialState() {
            return { 
                visible: false,
                x: 0,
                y: 0
            };
        }

        render() {
            if (!this.state.visible) {
                return '<div class="tm-context-anchor" style="display:none"></div>';
            }
            
            const { items } = this.props;
            const { x, y } = this.state;

            return html`
                <div class="tm-context-overlay" @click="close" @contextmenu="preventContext">
                    <div class="tm-context-menu tm-component" style="left: ${x}px; top: ${y}px;">
                        ${items.map((item, i) => this.renderItem(item, i)).join('')}
                    </div>
                </div>
            `;
        }

        renderItem(item, index) {
            if (item.divider) {
                return '<div class="tm-context-menu__divider"></div>';
            }
            
            const disabled = item.disabled ? 'tm-context-menu__item--disabled' : '';
            
            return html`
                <div class="tm-context-menu__item ${disabled}" data-index="${index}" @click="handleItemClick">
                    ${item.icon ? `<span class="tm-context-menu__icon">${item.icon}</span>` : ''}
                    <span class="tm-context-menu__label">${item.label}</span>
                    ${item.shortcut ? `<span class="tm-context-menu__shortcut">${item.shortcut}</span>` : ''}
                </div>
            `;
        }

        show(x, y) {
            // Adjust position to stay within viewport
            const padding = 10;
            const menuWidth = 200;  // Approximate
            const menuHeight = this.props.items.length * 36;
            
            if (x + menuWidth > globalThis.innerWidth - padding) {
                x = globalThis.innerWidth - menuWidth - padding;
            }
            if (y + menuHeight > globalThis.innerHeight - padding) {
                y = globalThis.innerHeight - menuHeight - padding;
            }
            
            this.state.x = Math.max(padding, x);
            this.state.y = Math.max(padding, y);
            this.state.visible = true;
        }

        close() {
            this.state.visible = false;
        }

        handleItemClick(e) {
            const index = parseInt(e.currentTarget.dataset.index);
            const item = this.props.items[index];
            
            if (item?.disabled) return;
            
            item?.action?.();
            this.props.onSelect?.(item, index);
            this.emit('select', { item, index });
            this.close();
        }

        preventContext(e) {
            e.preventDefault();
        }
    }

    /**
     * Attach context menu to element
     * @param {HTMLElement} element
     * @param {Array} items
     * @returns {ContextMenu}
     */
    ContextMenu.attach = function(element, items, onSelect) {
        const menu = new ContextMenu({ items, onSelect });
        menu.mount(document.body);
        
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            menu.show(e.clientX, e.clientY);
        });
        
        return menu;
    };

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Modal = Modal;
    TM.Drawer = Drawer;
    TM.Tooltip = Tooltip;
    TM.ContextMenu = ContextMenu;

})();

/* ═══ components/feedback/index.js ═══ */
/**
 * TM Framework - Feedback Components
 * Toast, Alert, Spinner, Progress, Skeleton
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // TOAST NOTIFICATION SYSTEM
    // ═══════════════════════════════════════════════════════════════
    
    const Toast = {
        container: null,
        queue: [],
        maxVisible: 5,
        
        init() {
            if (this.container) return;
            
            this.container = document.createElement('div');
            this.container.className = 'tm-toast-container';
            this.container.setAttribute('role', 'alert');
            this.container.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.container);
        },
        
        /**
         * Show toast notification
         * @param {string|Object} options - Message string or options object
         * @param {string} type - 'success' | 'error' | 'warning' | 'info'
         * @param {number} duration - Auto-dismiss time in ms (0 = manual)
         * @returns {HTMLElement}
         */
        show(options, type = 'info', duration = 3000) {
            this.init();
            
            // Normalize options
            const config = typeof options === 'string' 
                ? { message: options, type, duration }
                : { type, duration, ...options };
            
            const toast = document.createElement('div');
            toast.className = `tm-toast tm-toast--${config.type}`;
            toast.id = uid('toast');
            
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            
            toast.innerHTML = `
                <span class="tm-toast__icon">${icons[config.type] || icons.info}</span>
                <div class="tm-toast__content">
                    ${config.title ? `<div class="tm-toast__title">${config.title}</div>` : ''}
                    <div class="tm-toast__message">${config.message}</div>
                </div>
                <button class="tm-toast__close" aria-label="Cerrar">✕</button>
                ${config.duration > 0 ? `<div class="tm-toast__progress" style="animation-duration: ${config.duration}ms"></div>` : ''}
            `;
            
            // Close button
            toast.querySelector('.tm-toast__close').addEventListener('click', () => {
                this.dismiss(toast);
            });
            
            // Add to container
            this.container.appendChild(toast);
            
            // Manage max visible
            const toasts = this.container.querySelectorAll('.tm-toast');
            if (toasts.length > this.maxVisible) {
                this.dismiss(toasts[0]);
            }
            
            // Auto dismiss
            if (config.duration > 0) {
                setTimeout(() => this.dismiss(toast), config.duration);
            }
            
            return toast;
        },
        
        dismiss(toast) {
            if (!toast || !toast.parentNode) return;
            
            toast.classList.add('tm-toast--exit');
            setTimeout(() => toast.remove(), 300);
        },
        
        dismissAll() {
            this.container?.querySelectorAll('.tm-toast').forEach(t => this.dismiss(t));
        },
        
        // Shortcuts
        success(message, duration) { 
            return this.show(message, 'success', duration); 
        },
        error(message, duration) { 
            return this.show(message, 'error', duration ?? 5000); 
        },
        warning(message, duration) { 
            return this.show(message, 'warning', duration ?? 4000); 
        },
        info(message, duration) { 
            return this.show(message, 'info', duration); 
        },
        
        // Promise helper
        async promise(promise, messages = {}) {
            const { loading = 'Procesando...', success = '¡Completado!', error = 'Error' } = messages;
            
            const toast = this.show({ message: loading, type: 'info' }, 'info', 0);
            toast.classList.add('tm-toast--loading');
            
            try {
                const result = await promise;
                this.dismiss(toast);
                this.success(typeof success === 'function' ? success(result) : success);
                return result;
            } catch (e) {
                this.dismiss(toast);
                this.error(typeof error === 'function' ? error(e) : error);
                throw e;
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // ALERT (Inline message)
    // ═══════════════════════════════════════════════════════════════
    
    class Alert extends Component {
        static defaultProps = {
            type: 'info',      // success, error, warning, info
            title: '',
            message: '',
            closable: false,
            icon: true,
            onClose: null
        };

        initialState() {
            return { visible: true };
        }

        render() {
            if (!this.state.visible) return '';
            
            const { type, title, message, closable, icon } = this.props;
            
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };

            return html`
                <div class="tm-alert tm-alert--${type} tm-component" role="alert">
                    ${icon ? `<span class="tm-alert__icon">${icons[type]}</span>` : ''}
                    <div class="tm-alert__content">
                        ${title ? `<div class="tm-alert__title">${title}</div>` : ''}
                        <div class="tm-alert__message">${message}</div>
                    </div>
                    ${closable ? `<button class="tm-alert__close" @click="handleClose">✕</button>` : ''}
                </div>
            `;
        }

        handleClose() {
            this.state.visible = false;
            this.props.onClose?.();
            this.emit('close');
        }

        show() { this.state.visible = true; }
        hide() { this.state.visible = false; }
    }

    // ═══════════════════════════════════════════════════════════════
    // SPINNER
    // ═══════════════════════════════════════════════════════════════
    
    class Spinner extends Component {
        static defaultProps = {
            size: 'md',      // sm, md, lg, xl
            color: null,     // Custom color
            text: '',
            overlay: false,  // Full screen overlay
            inline: false
        };

        render() {
            const { size, color, text, overlay, inline } = this.props;
            
            const style = color ? `border-top-color: ${color}; border-right-color: ${color};` : '';
            
            const spinner = html`
                <div class="tm-spinner-wrapper ${inline ? 'tm-spinner-wrapper--inline' : ''} tm-component">
                    <div class="tm-spinner tm-spinner--${size}" style="${style}"></div>
                    ${text ? `<span class="tm-spinner__text">${text}</span>` : ''}
                </div>
            `;
            
            if (overlay) {
                return html`
                    <div class="tm-spinner-overlay tm-component">
                        ${spinner}
                    </div>
                `;
            }
            
            return spinner;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PROGRESS BAR
    // ═══════════════════════════════════════════════════════════════
    
    class Progress extends Component {
        static defaultProps = {
            value: 0,          // 0-100
            max: 100,
            size: 'md',        // sm, md, lg
            color: null,
            showLabel: true,
            striped: false,
            animated: false,
            indeterminate: false
        };

        render() {
            const { value, max, size, color, showLabel, striped, animated, indeterminate } = this.props;
            
            const percentage = Math.min(100, Math.max(0, (value / max) * 100));
            
            const barClasses = classNames(
                'tm-progress__bar',
                striped && 'tm-progress__bar--striped',
                animated && 'tm-progress__bar--animated',
                indeterminate && 'tm-progress__bar--indeterminate'
            );
            
            const style = `width: ${indeterminate ? '100%' : percentage + '%'}; ${color ? `background-color: ${color};` : ''}`;

            return html`
                <div class="tm-progress tm-progress--${size} tm-component" role="progressbar" 
                     aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${max}">
                    <div class="tm-progress__track">
                        <div class="${barClasses}" style="${style}">
                            ${showLabel && !indeterminate ? `<span class="tm-progress__label">${Math.round(percentage)}%</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        setValue(val) {
            this.setProps({ value: val });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SKELETON LOADER
    // ═══════════════════════════════════════════════════════════════
    
    class Skeleton extends Component {
        static defaultProps = {
            variant: 'text',    // text, circle, rect, card
            width: '100%',
            height: null,
            lines: 1,          // For text variant
            animated: true
        };

        render() {
            const { variant, width, height, lines, animated } = this.props;
            
            const baseClass = classNames(
                'tm-skeleton',
                `tm-skeleton--${variant}`,
                animated && 'tm-skeleton--animated'
            );
            
            if (variant === 'text' && lines > 1) {
                return html`
                    <div class="tm-skeleton-group tm-component">
                        ${Array(lines).fill(0).map((_, i) => `
                            <div class="${baseClass}" style="width: ${i === lines - 1 ? '70%' : width}; height: ${height || '1em'};"></div>
                        `).join('')}
                    </div>
                `;
            }
            
            if (variant === 'card') {
                return html`
                    <div class="tm-skeleton-card tm-component">
                        <div class="tm-skeleton tm-skeleton--rect tm-skeleton--animated" style="height: 200px;"></div>
                        <div class="tm-skeleton-card__body">
                            <div class="tm-skeleton tm-skeleton--text tm-skeleton--animated" style="width: 60%;"></div>
                            <div class="tm-skeleton tm-skeleton--text tm-skeleton--animated"></div>
                            <div class="tm-skeleton tm-skeleton--text tm-skeleton--animated" style="width: 80%;"></div>
                        </div>
                    </div>
                `;
            }
            
            const style = `width: ${width}; height: ${height || (variant === 'circle' ? width : '1em')};`;
            
            return html`
                <div class="${baseClass} tm-component" style="${style}"></div>
            `;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EMPTY STATE
    // ═══════════════════════════════════════════════════════════════
    
    class Empty extends Component {
        static defaultProps = {
            icon: '📭',
            title: 'Sin datos',
            description: '',
            action: null,      // { text, onClick }
        };

        render() {
            const { icon, title, description, action } = this.props;
            
            return html`
                <div class="tm-empty tm-component">
                    <div class="tm-empty__icon">${icon}</div>
                    <div class="tm-empty__title">${title}</div>
                    ${description ? `<div class="tm-empty__description">${description}</div>` : ''}
                    ${action ? `
                        <button class="tm-btn tm-btn--primary tm-btn--sm" @click="handleAction">
                            ${action.text}
                        </button>
                    ` : ''}
                </div>
            `;
        }

        handleAction() {
            this.props.action?.onClick?.();
            this.emit('action');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Toast = Toast;
    TM.Alert = Alert;
    TM.Spinner = Spinner;
    TM.Progress = Progress;
    TM.Skeleton = Skeleton;
    TM.Empty = Empty;

})();

/* ═══ components/data/index.js ═══ */
/**
 * TM Framework - Data Components
 * Tag, Badge, List, Table
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // TAG / CHIP
    // ═══════════════════════════════════════════════════════════════
    
    class Tag extends Component {
        static defaultProps = {
            text: '',
            variant: 'default',  // default, primary, success, danger, warning, info
            color: null,         // Custom color (overrides variant)
            size: 'md',          // sm, md, lg
            rounded: false,      // Fully rounded (pill)
            outline: false,      // Outline style
            removable: false,
            clickable: false,
            icon: null,
            onClick: null,
            onRemove: null
        };

        render() {
            const { text, variant, color, size, rounded, outline, removable, clickable, icon } = this.props;
            
            const classes = classNames(
                'tm-tag', 'tm-component',
                `tm-tag--${variant}`,
                `tm-tag--${size}`,
                rounded && 'tm-tag--rounded',
                outline && 'tm-tag--outline',
                clickable && 'tm-tag--clickable'
            );
            
            let style = '';
            if (color) {
                style = outline
                    ? `border-color: ${color}; color: ${color};`
                    : `background-color: ${color}; color: white;`;
            }

            return html`
                <span class="${classes}" style="${style}" @click="handleClick">
                    ${icon ? `<span class="tm-tag__icon">${icon}</span>` : ''}
                    <span class="tm-tag__text">${text}</span>
                    ${removable ? `
                        <button class="tm-tag__remove" @click="handleRemove" aria-label="Eliminar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    ` : ''}
                </span>
            `;
        }

        handleClick(e) {
            if (e.target.closest('.tm-tag__remove')) return;
            if (!this.props.clickable) return;
            
            this.props.onClick?.(e);
            this.emit('click');
        }

        handleRemove(e) {
            e.stopPropagation();
            this.props.onRemove?.(e);
            this.emit('remove');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BADGE
    // ═══════════════════════════════════════════════════════════════
    
    class Badge extends Component {
        static defaultProps = {
            value: 0,
            max: 99,
            variant: 'danger',  // primary, success, danger, warning
            dot: false,         // Show dot instead of number
            show: true,
            offset: [0, 0]      // [x, y] offset
        };

        render() {
            const { value, max, variant, dot, show, offset } = this.props;
            
            if (!show || (!dot && value <= 0)) {
                return '<span class="tm-badge-wrapper tm-component"><slot></slot></span>';
            }
            
            const displayValue = value > max ? `${max}+` : value;
            const offsetStyle = `transform: translate(${offset[0]}px, ${offset[1]}px);`;

            return html`
                <span class="tm-badge-wrapper tm-component">
                    <slot></slot>
                    <span class="tm-badge tm-badge--${variant} ${dot ? 'tm-badge--dot' : ''}" style="${offsetStyle}">
                        ${dot ? '' : displayValue}
                    </span>
                </span>
            `;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // LIST
    // ═══════════════════════════════════════════════════════════════
    
    class List extends Component {
        static defaultProps = {
            items: [],          // [{ id, title, subtitle?, icon?, extra?, disabled?, data? }]
            selectable: false,
            selected: null,     // Selected item id(s)
            multiple: false,    // Allow multiple selection
            hoverable: true,
            divided: true,
            size: 'md',
            emptyText: 'Sin elementos',
            onSelect: null,
            onItemClick: null
        };

        initialState() {
            const { selected, multiple } = this.props;
            return {
                selected: multiple 
                    ? (Array.isArray(selected) ? selected : [])
                    : selected
            };
        }

        render() {
            const { items, selectable, multiple, hoverable, divided, size, emptyText } = this.props;
            
            if (!items.length) {
                return html`
                    <div class="tm-list tm-list--empty tm-component">
                        <span class="tm-list__empty">${emptyText}</span>
                    </div>
                `;
            }
            
            const classes = classNames(
                'tm-list', 'tm-component',
                `tm-list--${size}`,
                divided && 'tm-list--divided',
                hoverable && 'tm-list--hoverable',
                selectable && 'tm-list--selectable'
            );

            return html`
                <div class="${classes}" role="${selectable ? 'listbox' : 'list'}">
                    ${items.map(item => this.renderItem(item)).join('')}
                </div>
            `;
        }

        renderItem(item) {
            const { selectable, multiple } = this.props;
            const isSelected = this.isSelected(item.id);
            
            const classes = classNames(
                'tm-list__item',
                isSelected && 'tm-list__item--selected',
                item.disabled && 'tm-list__item--disabled'
            );

            return html`
                <div class="${classes}" 
                     data-id="${item.id}"
                     role="${selectable ? 'option' : 'listitem'}"
                     aria-selected="${isSelected}"
                     @click="handleItemClick">
                    ${item.icon ? `<span class="tm-list__icon">${item.icon}</span>` : ''}
                    ${selectable && multiple ? `
                        <span class="tm-list__checkbox">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} ${item.disabled ? 'disabled' : ''} />
                        </span>
                    ` : ''}
                    <div class="tm-list__content">
                        <div class="tm-list__title">${item.title}</div>
                        ${item.subtitle ? `<div class="tm-list__subtitle">${item.subtitle}</div>` : ''}
                    </div>
                    ${item.extra ? `<span class="tm-list__extra">${item.extra}</span>` : ''}
                </div>
            `;
        }

        isSelected(id) {
            const { multiple } = this.props;
            return multiple 
                ? this.state.selected.includes(id)
                : this.state.selected === id;
        }

        handleItemClick(e) {
            const id = e.currentTarget.dataset.id;
            const item = this.props.items.find(i => String(i.id) === id);
            
            if (!item || item.disabled) return;
            
            this.props.onItemClick?.(item, e);
            this.emit('item-click', { item });
            
            if (this.props.selectable) {
                this.selectItem(item);
            }
        }

        selectItem(item) {
            const { multiple } = this.props;
            
            if (multiple) {
                const idx = this.state.selected.indexOf(item.id);
                if (idx === -1) {
                    this.state.selected = [...this.state.selected, item.id];
                } else {
                    this.state.selected = this.state.selected.filter(id => id !== item.id);
                }
            } else {
                this.state.selected = this.state.selected === item.id ? null : item.id;
            }
            
            this.props.onSelect?.(this.state.selected, item);
            this.emit('select', { selected: this.state.selected, item });
        }

        /**
         * Gets the currently selected ID(s)
         * @returns {string|number|null|Array<string|number>} Selected ID (single mode) or array of IDs (multiple mode)
         */
        getSelected() {
            return this.state.selected;
        }

        /**
         * Sets the selected ID(s) programmatically
         * @param {string|number|null|Array<string|number>} selected - ID or array of IDs to select
         */
        setSelected(selected) {
            const { multiple } = this.props;

            // Normalize input based on mode
            if (multiple) {
                this.state.selected = Array.isArray(selected) ? selected : (selected != null ? [selected] : []);
            } else {
                this.state.selected = Array.isArray(selected) ? selected[0] ?? null : selected;
            }

            this.props.onSelect?.(this.state.selected, null);
            this.emit('select', { selected: this.state.selected, item: null });
        }

        /**
         * Clears the current selection
         */
        clearSelection() {
            this.state.selected = this.props.multiple ? [] : null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SIMPLE TABLE
    // ═══════════════════════════════════════════════════════════════
    
    class Table extends Component {
        static defaultProps = {
            columns: [],  // [{ key, title, width?, align?, render? }]
            data: [],     // [{ ...row data }]
            rowKey: 'id',
            striped: false,
            bordered: false,
            hoverable: true,
            compact: false,
            emptyText: 'Sin datos',
            onRowClick: null
        };

        render() {
            const { columns, data, striped, bordered, hoverable, compact, emptyText } = this.props;
            
            const classes = classNames(
                'tm-table-wrapper', 'tm-component',
                striped && 'tm-table--striped',
                bordered && 'tm-table--bordered',
                hoverable && 'tm-table--hoverable',
                compact && 'tm-table--compact'
            );

            return html`
                <div class="${classes}">
                    <table class="tm-table">
                        <thead>
                            <tr>
                                ${columns.map(col => `
                                    <th style="${col.width ? `width: ${col.width};` : ''} ${col.align ? `text-align: ${col.align};` : ''}">
                                        ${col.title}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.length ? data.map((row, idx) => this.renderRow(row, idx)).join('') : `
                                <tr class="tm-table__empty-row">
                                    <td colspan="${columns.length}">
                                        <span class="tm-table__empty">${emptyText}</span>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            `;
        }

        renderRow(row, index) {
            const { columns, rowKey } = this.props;
            const key = row[rowKey] ?? index;
            
            return html`
                <tr data-row-key="${key}" @click="handleRowClick">
                    ${columns.map(col => {
                        const value = row[col.key];
                        const content = col.render ? col.render(value, row, index) : (value ?? '');
                        const align = col.align ? `text-align: ${col.align};` : '';
                        return `<td style="${align}">${content}</td>`;
                    }).join('')}
                </tr>
            `;
        }

        handleRowClick(e) {
            const key = e.currentTarget.dataset.rowKey;
            const row = this.props.data.find((r, i) => String(r[this.props.rowKey] ?? i) === key);
            
            if (row) {
                this.props.onRowClick?.(row, e);
                this.emit('row-click', { row });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Tag = Tag;
    TM.Badge = Badge;
    TM.List = List;
    TM.Table = Table;

})();

/* ═══ components/layout/index.js ═══ */
/**
 * TM Framework - Layout Components
 * Card, Tabs, Accordion, FloatingButton
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // CARD
    // ═══════════════════════════════════════════════════════════════
    
    class Card extends Component {
        static defaultProps = {
            title: '',
            subtitle: '',
            icon: null,
            footer: null,
            hoverable: false,
            bordered: true,
            shadow: 'sm',       // none, sm, md, lg
            padding: 'md',      // none, sm, md, lg
            headerAction: null  // { icon, onClick }
        };

        render() {
            const { title, subtitle, icon, footer, hoverable, bordered, shadow, padding, headerAction } = this.props;
            
            const classes = classNames(
                'tm-card', 'tm-component',
                bordered && 'tm-card--bordered',
                hoverable && 'tm-card--hoverable',
                shadow !== 'none' && `tm-card--shadow-${shadow}`,
                `tm-card--padding-${padding}`
            );
            
            const hasHeader = title || subtitle || icon || headerAction;

            return html`
                <div class="${classes}">
                    ${hasHeader ? `
                        <div class="tm-card__header">
                            ${icon ? `<span class="tm-card__icon">${icon}</span>` : ''}
                            <div class="tm-card__header-content">
                                ${title ? `<h3 class="tm-card__title">${title}</h3>` : ''}
                                ${subtitle ? `<p class="tm-card__subtitle">${subtitle}</p>` : ''}
                            </div>
                            ${headerAction ? `
                                <button class="tm-btn tm-btn--ghost tm-btn--icon tm-btn--sm" @click="handleHeaderAction">
                                    ${headerAction.icon || '⋮'}
                                </button>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="tm-card__body" ref="body">
                        <!-- Content -->
                    </div>
                    ${footer ? `<div class="tm-card__footer">${footer}</div>` : ''}
                </div>
            `;
        }

        setContent(content) {
            if (!this.refs.body) return;
            
            if (typeof content === 'string') {
                this.refs.body.innerHTML = content;
            } else if (content instanceof Component) {
                this.refs.body.innerHTML = '';
                content.mount(this.refs.body);
            } else if (content instanceof HTMLElement) {
                this.refs.body.innerHTML = '';
                this.refs.body.appendChild(content);
            }
        }

        handleHeaderAction(e) {
            this.props.headerAction?.onClick?.(e);
            this.emit('headerAction');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TABS
    // ═══════════════════════════════════════════════════════════════
    
    class Tabs extends Component {
        static defaultProps = {
            tabs: [],           // [{ key, label, icon?, disabled?, content? }]
            activeKey: null,
            variant: 'line',    // line, card, pills
            size: 'md',         // sm, md, lg
            centered: false,
            onChange: null
        };

        initialState() {
            return {
                activeKey: this.props.activeKey || this.props.tabs[0]?.key
            };
        }

        render() {
            const { tabs, variant, size, centered } = this.props;
            const { activeKey } = this.state;
            
            const navClasses = classNames(
                'tm-tabs__nav',
                `tm-tabs__nav--${variant}`,
                `tm-tabs__nav--${size}`,
                centered && 'tm-tabs__nav--centered'
            );
            
            const activeTab = tabs.find(t => t.key === activeKey);

            return html`
                <div class="tm-tabs tm-component">
                    <div class="${navClasses}" role="tablist">
                        ${tabs.map(tab => `
                            <button 
                                class="tm-tabs__tab ${tab.key === activeKey ? 'tm-tabs__tab--active' : ''} ${tab.disabled ? 'tm-tabs__tab--disabled' : ''}"
                                role="tab"
                                data-key="${tab.key}"
                                aria-selected="${tab.key === activeKey}"
                                ${tab.disabled ? 'disabled' : ''}
                                @click="handleTabClick"
                            >
                                ${tab.icon ? `<span class="tm-tabs__icon">${tab.icon}</span>` : ''}
                                <span class="tm-tabs__label">${tab.label}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div class="tm-tabs__content" ref="content" role="tabpanel">
                        ${activeTab?.content || ''}
                    </div>
                </div>
            `;
        }

        handleTabClick(e) {
            const key = e.currentTarget.dataset.key;
            const tab = this.props.tabs.find(t => t.key === key);
            
            if (!tab || tab.disabled || key === this.state.activeKey) return;
            
            this.state.activeKey = key;
            this.props.onChange?.(key, tab);
            this.emit('change', { key, tab });
        }

        setActiveTab(key) {
            this.state.activeKey = key;
        }

        setTabContent(key, content) {
            const tab = this.props.tabs.find(t => t.key === key);
            if (tab) {
                tab.content = content;
                if (this.state.activeKey === key) {
                    this.forceUpdate();
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ACCORDION
    // ═══════════════════════════════════════════════════════════════
    
    class Accordion extends Component {
        static defaultProps = {
            items: [],          // [{ key, title, content, icon?, disabled? }]
            activeKeys: [],     // Array of expanded keys
            multiple: true,     // Allow multiple open
            bordered: true,
            onChange: null
        };

        initialState() {
            return {
                activeKeys: this.props.activeKeys
            };
        }

        render() {
            const { items, bordered } = this.props;
            
            const classes = classNames(
                'tm-accordion', 'tm-component',
                bordered && 'tm-accordion--bordered'
            );

            return html`
                <div class="${classes}">
                    ${items.map(item => this.renderItem(item)).join('')}
                </div>
            `;
        }

        renderItem(item) {
            const isActive = this.state.activeKeys.includes(item.key);
            
            const itemClasses = classNames(
                'tm-accordion__item',
                isActive && 'tm-accordion__item--active',
                item.disabled && 'tm-accordion__item--disabled'
            );

            return html`
                <div class="${itemClasses}" data-key="${item.key}">
                    <button class="tm-accordion__header" @click="handleHeaderClick" ${item.disabled ? 'disabled' : ''}>
                        ${item.icon ? `<span class="tm-accordion__icon">${item.icon}</span>` : ''}
                        <span class="tm-accordion__title">${item.title}</span>
                        <span class="tm-accordion__arrow">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </span>
                    </button>
                    <div class="tm-accordion__content" style="${isActive ? '' : 'display: none;'}">
                        <div class="tm-accordion__body">${item.content}</div>
                    </div>
                </div>
            `;
        }

        handleHeaderClick(e) {
            const itemEl = e.currentTarget.closest('.tm-accordion__item');
            const key = itemEl.dataset.key;
            const item = this.props.items.find(i => i.key === key);
            
            if (!item || item.disabled) return;
            
            this.toggleItem(key);
        }

        toggleItem(key) {
            const { multiple } = this.props;
            const idx = this.state.activeKeys.indexOf(key);
            
            if (idx === -1) {
                // Open
                this.state.activeKeys = multiple 
                    ? [...this.state.activeKeys, key]
                    : [key];
            } else {
                // Close
                this.state.activeKeys = this.state.activeKeys.filter(k => k !== key);
            }
            
            this.props.onChange?.(this.state.activeKeys);
            this.emit('change', { activeKeys: this.state.activeKeys });
        }

        /**
         * Expands all accordion panels (except disabled ones)
         */
        expandAll() {
            const newActiveKeys = this.props.items
                .filter(i => !i.disabled)
                .map(i => i.key);
            this.state.activeKeys = newActiveKeys;
            this.props.onChange?.(newActiveKeys);
            this.emit('change', { activeKeys: newActiveKeys });
        }

        /**
         * Collapses all accordion panels
         */
        collapseAll() {
            const newActiveKeys = [];
            this.state.activeKeys = newActiveKeys;
            this.props.onChange?.(newActiveKeys);
            this.emit('change', { activeKeys: newActiveKeys });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FLOATING ACTION BUTTON (FAB)
    // ═══════════════════════════════════════════════════════════════
    
    class FloatingButton extends Component {
        static defaultProps = {
            icon: '+',
            text: '',
            variant: 'primary',
            size: 'md',          // sm, md, lg
            position: 'bottom-right',  // bottom-right, bottom-left, bottom-center, top-right, top-left
            offset: { x: 20, y: 20 },
            tooltip: '',
            extended: false,     // Show text beside icon
            actions: [],         // [{ icon, label, onClick }] - Speed dial
            onClick: null
        };

        initialState() {
            return { 
                expanded: false 
            };
        }

        render() {
            const { icon, text, variant, size, position, offset, tooltip, extended, actions } = this.props;
            const { expanded } = this.state;
            
            const positionStyles = this.getPositionStyles(position, offset);
            
            const classes = classNames(
                'tm-fab', 'tm-component',
                `tm-fab--${variant}`,
                `tm-fab--${size}`,
                extended && text && 'tm-fab--extended',
                expanded && 'tm-fab--open'
            );

            return html`
                <div class="tm-fab-wrapper" style="${positionStyles}">
                    ${actions.length ? `
                        <div class="tm-fab__actions ${expanded ? 'tm-fab__actions--visible' : ''}">
                            ${actions.map((action, i) => `
                                <button 
                                    class="tm-fab tm-fab--${variant} tm-fab--sm tm-fab__action"
                                    data-index="${i}"
                                    title="${action.label || ''}"
                                    @click="handleActionClick"
                                    style="transition-delay: ${(actions.length - i) * 50}ms;"
                                >
                                    ${action.icon}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                    <button class="${classes}" title="${tooltip}" @click="handleClick">
                        <span class="tm-fab__icon ${expanded ? 'tm-fab__icon--rotate' : ''}">${icon}</span>
                        ${extended && text ? `<span class="tm-fab__text">${text}</span>` : ''}
                    </button>
                </div>
            `;
        }

        getPositionStyles(position, offset) {
            const styles = {
                'bottom-right': `bottom: ${offset.y}px; right: ${offset.x}px;`,
                'bottom-left': `bottom: ${offset.y}px; left: ${offset.x}px;`,
                'bottom-center': `bottom: ${offset.y}px; left: 50%; transform: translateX(-50%);`,
                'top-right': `top: ${offset.y}px; right: ${offset.x}px;`,
                'top-left': `top: ${offset.y}px; left: ${offset.x}px;`
            };
            return `position: fixed; z-index: 9999; ${styles[position] || styles['bottom-right']}`;
        }

        handleClick(e) {
            if (this.props.actions.length) {
                this.state.expanded = !this.state.expanded;
            } else {
                this.props.onClick?.(e);
                this.emit('click');
            }
        }

        handleActionClick(e) {
            const index = parseInt(e.currentTarget.dataset.index);
            const action = this.props.actions[index];
            
            action?.onClick?.(e);
            this.emit('action', { action, index });
            this.state.expanded = false;
        }

        open() {
            this.state.expanded = true;
        }

        close() {
            this.state.expanded = false;
        }

        toggle() {
            this.state.expanded = !this.state.expanded;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DIVIDER
    // ═══════════════════════════════════════════════════════════════
    
    class Divider extends Component {
        static defaultProps = {
            text: '',
            orientation: 'horizontal',  // horizontal, vertical
            textPosition: 'center',     // left, center, right
            dashed: false
        };

        render() {
            const { text, orientation, textPosition, dashed } = this.props;
            
            const classes = classNames(
                'tm-divider', 'tm-component',
                `tm-divider--${orientation}`,
                text && `tm-divider--text-${textPosition}`,
                dashed && 'tm-divider--dashed'
            );

            if (orientation === 'vertical') {
                return `<span class="${classes}"></span>`;
            }

            return html`
                <div class="${classes}">
                    ${text ? `<span class="tm-divider__text">${text}</span>` : ''}
                </div>
            `;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Card = Card;
    TM.Tabs = Tabs;
    TM.Accordion = Accordion;
    TM.FloatingButton = FloatingButton;
    TM.Divider = Divider;

})();
