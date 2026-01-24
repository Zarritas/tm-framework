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
            this._el?.dispatchEvent(new CustomEvent(eventName, {
                detail,
                bubbles: true,
                composed: true
            }));
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
            
            // Destroy children
            this._children.forEach(child => child.destroy());
            this._children.clear();
            
            // Cleanup subscriptions
            this._unsubscribers.forEach(unsub => unsub());
            this._unsubscribers = [];
            
            // Remove from DOM
            this._el?.remove();
            this._el = null;
            this._mounted = false;
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
                            node.addEventListener(eventName, (e) => this[handlerName](e));
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
            requestAnimationFrame(() => {
                this._updateScheduled = false;
                this._update();
            });
        }

        _update() {
            if (!this._el || !this._mounted) return;
            
            // Store scroll position
            const scrollPos = this._el.scrollTop;
            
            // Re-render
            const newEl = this._createElement();
            this._el.replaceWith(newEl);
            this._el = newEl;
            
            // Restore scroll
            this._el.scrollTop = scrollPos;
            
            this.onUpdate();
        }
    }

    return { Component };
})();

// Export
if (typeof window !== 'undefined') {
    window.TMComponent = TMComponent;
}