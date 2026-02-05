/**
 * TM Framework - Base Component Class
 * Provides lifecycle, props, state, and rendering
 */

const TMComponent = (function() {
    'use strict';

    const { reactive } = TMReactive;

    // Counter for unique component IDs
    let _componentCounter = 0;

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
            this._componentId = `${this.constructor.name}_${Date.now().toString(36)}_${(++_componentCounter).toString(36)}`;
            
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
                this._pendingUpdateReason = null;
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
                    : (() => {
                        const wrapper = document.createElement('div');
                        wrapper.innerHTML = renderString.trim();
                        return wrapper.children.length === 1
                            ? wrapper.firstElementChild
                            : wrapper;
                    })();

                // Only replace if significantly different
                if (this._shouldUpdate(this._el, newEl)) {
                    this._log('info', `Update ${updateId} - DOM CHANGED, replacing element`);
                    
                    // Process new element before replacing
                    this._processElement(newEl);
                    
                    // Store old element info for comparison (with safety checks)
                    const oldInfo = {
                        tagName: this._el?.tagName || 'unknown',
                        className: this._el?.className || '',
                        childCount: this._el?.children?.length ?? 0,
                        innerHTMLLength: this._el?.innerHTML?.length ?? 0
                    };

                    // Replace element
                    this._el.replaceWith(newEl);
                    this._el = newEl;

                    // Restore scroll
                    if (this._el) this._el.scrollTop = scrollPos;

                    const newInfo = {
                        tagName: this._el?.tagName || 'unknown',
                        className: this._el?.className || '',
                        childCount: this._el?.children?.length ?? 0,
                        innerHTMLLength: this._el?.innerHTML?.length ?? 0
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
            // Safety checks for null/undefined elements
            if (!oldEl || !newEl) return true;

            // Safety check for elements without children property (text nodes, etc.)
            const oldChildren = oldEl.children;
            const newChildren = newEl.children;
            if (!oldChildren || !newChildren) return true;

            // Compare class names
            if (oldEl.className !== newEl.className) return true;

            // Compare text content for simple elements
            if (oldChildren.length === 0 && newChildren.length === 0) {
                return oldEl.textContent !== newEl.textContent;
            }

            // For complex elements, check child count difference
            if (oldChildren.length !== newChildren.length) return true;

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