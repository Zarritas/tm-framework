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