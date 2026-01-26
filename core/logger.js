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
        configure(options) {
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
