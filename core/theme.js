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