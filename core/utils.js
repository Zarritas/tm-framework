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