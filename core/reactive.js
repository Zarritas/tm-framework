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
