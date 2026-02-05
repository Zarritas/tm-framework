/**
 * TM Framework - Selector Manager
 * Robust DOM selector management with automatic fallbacks
 *
 * @version 1.0.0
 */

const TMSelector = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Patterns that indicate fragile selectors
   */
  const FRAGILE_PATTERNS = [
    /\.css-[a-z0-9]+/i,              // CSS-in-JS (Emotion, etc.)
    /\.sc-[a-z]+-[a-z0-9]+/i,        // styled-components
    /\.[a-z]+_[a-z]+__[a-z0-9]+/i,   // CSS Modules
    /\.jsx?-\d+/i,                    // JSX generated
    /:nth-child\(\d+\)/,              // Positional (fragile)
    /:nth-of-type\(\d+\)/,            // Positional (fragile)
    /#[a-z]+-\d+/i,                   // Generated IDs
    /#ember\d+/,                      // Ember.js
    /#react-[a-z0-9-]+/i,             // React
  ];

  /**
   * Selector stability priority (higher = more stable)
   */
  const SELECTOR_PRIORITY = {
    'data-testid': 10,
    'data-test': 9,
    'data-qa': 9,
    'data-cy': 9,
    'aria-label': 8,
    'aria-labelledby': 8,
    'role': 7,
    'id': 6,
    'name': 5,
    'type': 4,
    'href': 3,
    'class': 2,
    'tag': 1,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTOR MANAGER CLASS
  // ═══════════════════════════════════════════════════════════════════════════

  class SelectorManager {
    /**
     * Create a new SelectorManager instance
     * @param {string} name - Manager name for logging
     * @param {Object} options - Configuration options
     */
    constructor(name = 'TM', options = {}) {
      this.name = name;
      this.selectors = new Map();
      this.stats = new Map();
      this.options = {
        warnOnMiss: options.warnOnMiss ?? true,
        logHits: options.logHits ?? false,
        throwOnMiss: options.throwOnMiss ?? false,
        cacheResults: options.cacheResults ?? false,
        cacheTTL: options.cacheTTL ?? 5000,
        ...options,
      };
      // Use WeakMap to isolate cache entries per context object
      this._cacheByContext = new WeakMap();
      // Separate cache for document context (can't be WeakMap key)
      this._documentCache = new Map();
    }

    /**
     * Register a selector with fallbacks
     * @param {string} key - Unique identifier for this selector
     * @param {string|string[]} selectors - Selector or array of fallback selectors
     * @param {Object} options - Selector-specific options
     * @returns {SelectorManager} this (for chaining)
     */
    register(key, selectors, options = {}) {
      const selectorList = Array.isArray(selectors) ? selectors : [selectors];

      if (selectorList.length === 0) {
        console.warn(`[${this.name}] Empty selector list for "${key}"`);
        return this;
      }

      this.selectors.set(key, {
        list: selectorList,
        required: options.required ?? true,
        validator: options.validator ?? null,
        transform: options.transform ?? null,
        description: options.description ?? '',
      });

      this.stats.set(key, {
        hits: {},
        misses: 0,
        lastHit: null,
        lastMiss: null,
      });

      return this;
    }

    /**
     * Register multiple selectors at once
     * @param {Object} definitions - Key-value pairs of selector definitions
     * @returns {SelectorManager} this (for chaining)
     */
    registerAll(definitions) {
      for (const [key, value] of Object.entries(definitions)) {
        if (Array.isArray(value) || typeof value === 'string') {
          this.register(key, value);
        } else {
          this.register(key, value.selectors, value);
        }
      }
      return this;
    }

    /**
     * Get an element using registered selectors with fallbacks
     * @param {string} key - Registered selector key
     * @param {HTMLElement|Document} context - Context to search within
     * @returns {HTMLElement|null}
     */
    get(key, context = document) {
      const config = this.selectors.get(key);

      if (!config) {
        console.error(`[${this.name}] Unknown selector key: "${key}"`);
        return null;
      }

      // Check cache
      if (this.options.cacheResults) {
        const cached = this._getFromCache(key, context);
        if (cached !== undefined) return cached;
      }

      // Try each selector in order
      for (const selector of config.list) {
        try {
          const el = context.querySelector(selector);

          if (el && this._validate(el, config)) {
            this._recordHit(key, selector);
            const result = this._transform(el, config);

            if (this.options.cacheResults) {
              this._setCache(key, context, result);
            }

            return result;
          }
        } catch (e) {
          // Invalid selector syntax, skip to next
          if (this.options.logHits) {
            console.warn(`[${this.name}] Invalid selector: "${selector}"`);
          }
        }
      }

      // No match found
      this._recordMiss(key);

      if (config.required) {
        if (this.options.throwOnMiss) {
          throw new Error(`[${this.name}] Required element not found: "${key}"`);
        }
        if (this.options.warnOnMiss) {
          this._reportMissing(key);
        }
      }

      return null;
    }

    /**
     * Get all elements matching any of the registered selectors
     * @param {string} key - Registered selector key
     * @param {HTMLElement|Document} context - Context to search within
     * @returns {HTMLElement[]}
     */
    getAll(key, context = document) {
      const config = this.selectors.get(key);

      if (!config) {
        console.error(`[${this.name}] Unknown selector key: "${key}"`);
        return [];
      }

      for (const selector of config.list) {
        try {
          const els = context.querySelectorAll(selector);

          if (els.length > 0) {
            const filtered = Array.from(els).filter(el => this._validate(el, config));

            if (filtered.length > 0) {
              this._recordHit(key, selector);
              return filtered.map(el => this._transform(el, config));
            }
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }

      this._recordMiss(key);
      return [];
    }

    /**
     * Check if an element exists
     * @param {string} key - Registered selector key
     * @param {HTMLElement|Document} context - Context to search within
     * @returns {boolean}
     */
    exists(key, context = document) {
      return this.get(key, context) !== null;
    }

    /**
     * Wait for an element to appear
     * @param {string} key - Registered selector key
     * @param {Object} options - Wait options
     * @returns {Promise<HTMLElement>}
     */
    waitFor(key, options = {}) {
      const {
        timeout = 10000,
        interval = 100,
        context = document.body,
      } = options;

      return new Promise((resolve, reject) => {
        // Safe wrapper for this.get() to handle throwOnMiss exceptions
        const safeGet = (k, ctx) => {
          try {
            return this.get(k, ctx);
          } catch (e) {
            // If throwOnMiss is active, get() may throw - return null instead
            return null;
          }
        };

        // Check immediately
        const immediate = safeGet(key, context);
        if (immediate) return resolve(immediate);

        const startTime = Date.now();
        let pollId = null;
        let timeoutId = null;

        // Cleanup helper to prevent memory leaks
        const cleanup = () => {
          if (pollId) clearInterval(pollId);
          if (timeoutId) clearTimeout(timeoutId);
          observer.disconnect();
        };

        // Set up observer
        const observer = new MutationObserver(() => {
          const el = safeGet(key, context);
          if (el) {
            cleanup();
            if (this.options.logHits) {
              TMLogger.Logger.debug('Selector', `waitFor "${key}" resolved in ${Date.now() - startTime}ms`);
            }
            resolve(el);
          }
        });

        observer.observe(context, {
          childList: true,
          subtree: true,
          attributes: true,
        });

        // Timeout
        timeoutId = setTimeout(() => {
          cleanup();
          const config = this.selectors.get(key);
          reject(new Error(
            `[${this.name}] Timeout waiting for "${key}". Tried: ${config?.list.join(', ')}`
          ));
        }, timeout);

        // Also poll as backup (some mutations might be missed)
        pollId = setInterval(() => {
          const el = safeGet(key, context);
          if (el) {
            cleanup();
            if (this.options.logHits) {
              TMLogger.Logger.debug('Selector', `waitFor "${key}" resolved in ${Date.now() - startTime}ms`);
            }
            resolve(el);
          }
        }, interval);
      });
    }

    /**
     * Query using raw selector (not registered)
     * Useful for one-off queries with fallback support
     * @param {string|string[]} selectors - Selector(s) to try
     * @param {HTMLElement|Document} context - Context to search within
     * @returns {HTMLElement|null}
     */
    query(selectors, context = document) {
      const list = Array.isArray(selectors) ? selectors : [selectors];

      for (const selector of list) {
        try {
          const el = context.querySelector(selector);
          if (el) return el;
        } catch (e) {
          // Skip invalid selectors
        }
      }

      return null;
    }

    /**
     * Query all using raw selector
     * @param {string|string[]} selectors - Selector(s) to try
     * @param {HTMLElement|Document} context - Context to search within
     * @returns {HTMLElement[]}
     */
    queryAll(selectors, context = document) {
      const list = Array.isArray(selectors) ? selectors : [selectors];

      for (const selector of list) {
        try {
          const els = context.querySelectorAll(selector);
          if (els.length > 0) return Array.from(els);
        } catch (e) {
          // Skip invalid selectors
        }
      }

      return [];
    }

    /**
     * Get statistics for all selectors
     * @returns {Object}
     */
    getStats() {
      const stats = {};

      for (const [key, data] of this.stats) {
        const config = this.selectors.get(key);
        stats[key] = {
          ...data,
          selectors: config?.list || [],
          totalHits: Object.values(data.hits).reduce((a, b) => a + b, 0),
        };
      }

      return stats;
    }

    /**
     * Get health report for selectors
     * @returns {Object}
     */
    getHealthReport() {
      const report = {
        total: this.selectors.size,
        healthy: 0,
        degraded: 0,
        failing: 0,
        details: [],
      };

      for (const [key, stat] of this.stats) {
        const config = this.selectors.get(key);
        const totalHits = Object.values(stat.hits).reduce((a, b) => a + b, 0);
        const primaryHits = stat.hits[config.list[0]] || 0;

        let status = 'healthy';
        let reason = '';

        if (stat.misses > 0 && totalHits === 0) {
          status = 'failing';
          reason = 'No successful matches';
        } else if (primaryHits === 0 && totalHits > 0) {
          status = 'degraded';
          reason = 'Using fallback selectors';
        }

        if (status === 'healthy') report.healthy++;
        else if (status === 'degraded') report.degraded++;
        else report.failing++;

        report.details.push({
          key,
          status,
          reason,
          primarySelector: config.list[0],
          usedSelector: this._getMostUsedSelector(stat),
          hits: totalHits,
          misses: stat.misses,
        });
      }

      return report;
    }

    /**
     * Clear cache
     * Note: WeakMap entries are automatically garbage-collected when context is removed
     * This only clears the document cache; per-context caches clear when contexts are GC'd
     */
    clearCache() {
      this._documentCache.clear();
      // WeakMap entries for other contexts will be GC'd automatically
    }

    /**
     * Reset all statistics
     */
    resetStats() {
      for (const key of this.stats.keys()) {
        this.stats.set(key, {
          hits: {},
          misses: 0,
          lastHit: null,
          lastMiss: null,
        });
      }
    }

    /**
     * Check if a selector is fragile
     * @param {string} selector
     * @returns {boolean}
     */
    static isFragile(selector) {
      return FRAGILE_PATTERNS.some(pattern => pattern.test(selector));
    }

    /**
     * Analyze a selector and return stability info
     * @param {string} selector
     * @returns {Object}
     */
    static analyzeSelector(selector) {
      const issues = [];
      let score = 100;

      // Check fragile patterns
      for (const pattern of FRAGILE_PATTERNS) {
        if (pattern.test(selector)) {
          issues.push({
            type: 'fragile-pattern',
            pattern: pattern.toString(),
            message: 'Contains pattern that may change frequently',
          });
          score -= 20;
        }
      }

      // Check depth
      const depth = (selector.match(/>/g) || []).length;
      if (depth > 3) {
        issues.push({
          type: 'deep-nesting',
          depth,
          message: `Selector has ${depth} levels of nesting`,
        });
        score -= depth * 5;
      }

      // Check for stable attributes
      const hasTestId = /\[data-testid/.test(selector);
      const hasAriaLabel = /\[aria-label/.test(selector);
      const hasRole = /\[role=/.test(selector);

      if (hasTestId) score += 10;
      if (hasAriaLabel) score += 5;
      if (hasRole) score += 5;

      return {
        selector,
        score: Math.max(0, Math.min(100, score)),
        issues,
        recommendation: score < 50 ? 'Consider adding fallback selectors' : null,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE METHODS
    // ─────────────────────────────────────────────────────────────────────────

    _validate(el, config) {
      if (!config.validator) return true;
      try {
        return config.validator(el);
      } catch (e) {
        return false;
      }
    }

    _transform(el, config) {
      if (!config.transform) return el;
      try {
        return config.transform(el);
      } catch (e) {
        return el;
      }
    }

    _recordHit(key, selector) {
      const stat = this.stats.get(key);
      if (stat) {
        stat.hits[selector] = (stat.hits[selector] || 0) + 1;
        stat.lastHit = Date.now();
      }

      if (this.options.logHits) {
        console.log(`[${this.name}] Hit: "${key}" via "${selector}"`);
      }
    }

    _recordMiss(key) {
      const stat = this.stats.get(key);
      if (stat) {
        stat.misses++;
        stat.lastMiss = Date.now();
      }
    }

    _reportMissing(key) {
      const config = this.selectors.get(key);
      const stat = this.stats.get(key);

      console.group(`[${this.name}] Selector "${key}" not found`);
      console.log('Tried selectors:', config.list);
      console.log('Description:', config.description || '(none)');
      console.log('Stats:', stat);
      console.groupEnd();
    }

    _getMostUsedSelector(stat) {
      let maxHits = 0;
      let mostUsed = null;

      for (const [selector, hits] of Object.entries(stat.hits)) {
        if (hits > maxHits) {
          maxHits = hits;
          mostUsed = selector;
        }
      }

      return mostUsed;
    }

    _getContextCache(context) {
      // Normalize invalid context values to document to prevent WeakMap TypeError
      const normalizedContext =
        context != null && typeof context === 'object' ? context : document;

      if (normalizedContext === document) {
        return this._documentCache;
      }
      // Get or create a Map for this context object
      let contextCache = this._cacheByContext.get(normalizedContext);
      if (!contextCache) {
        contextCache = new Map();
        this._cacheByContext.set(normalizedContext, contextCache);
      }
      return contextCache;
    }

    _getFromCache(key, context) {
      const contextCache = this._getContextCache(context);
      // Use key and context.id (if present) for the cache key within this context
      const cacheKey = context?.id ? `${key}_${context.id}` : key;
      const cached = contextCache.get(cacheKey);

      if (cached && Date.now() - cached.time < this.options.cacheTTL) {
        // Verify element is still in DOM
        if (cached.element && document.contains(cached.element)) {
          return cached.element;
        }
        // Remove stale entry
        contextCache.delete(cacheKey);
      }

      return undefined;
    }

    _setCache(key, context, element) {
      const contextCache = this._getContextCache(context);
      const cacheKey = context?.id ? `${key}_${context.id}` : key;
      contextCache.set(cacheKey, {
        element,
        time: Date.now(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find element by text content
   * @param {string} tag - HTML tag to search
   * @param {string} text - Text content to match
   * @param {HTMLElement|Document} container - Search context
   * @returns {HTMLElement|null}
   */
  function findByText(tag, text, container = document) {
    const elements = container.querySelectorAll(tag);
    return Array.from(elements).find(el =>
      el.textContent.trim().includes(text)
    ) || null;
  }

  /**
   * Find element relative to an anchor
   * @param {HTMLElement} anchor - Reference element
   * @param {string} selector - Selector to find
   * @param {string} relationship - 'parent', 'sibling', 'child', 'next', 'prev'
   * @returns {HTMLElement|null}
   */
  function findRelative(anchor, selector, relationship = 'sibling') {
    if (!anchor) return null;

    switch (relationship) {
      case 'parent':
        return anchor.closest(selector);

      case 'sibling':
        return anchor.parentElement?.querySelector(selector) || null;

      case 'child':
        return anchor.querySelector(selector);

      case 'next': {
        let next = anchor.nextElementSibling;
        while (next) {
          if (next.matches(selector)) return next;
          next = next.nextElementSibling;
        }
        return null;
      }

      case 'prev': {
        let prev = anchor.previousElementSibling;
        while (prev) {
          if (prev.matches(selector)) return prev;
          prev = prev.previousElementSibling;
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Create a simple query function with fallback support
   * @param {string[]} selectors - Array of fallback selectors
   * @returns {Function}
   */
  function createQuery(selectors) {
    return function(context = document) {
      for (const sel of selectors) {
        try {
          const el = context.querySelector(sel);
          if (el) return el;
        } catch (e) {
          // Skip invalid selector
        }
      }
      return null;
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    SelectorManager,
    findByText,
    findRelative,
    createQuery,
    FRAGILE_PATTERNS,
    SELECTOR_PRIORITY,
  };
})();

// Export to global
if (typeof window !== 'undefined') {
  globalThis.TMSelector = TMSelector;
}
