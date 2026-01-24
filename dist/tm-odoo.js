/*!
 * TM Framework - Plugin: odoo
 * Version: 1.0.0
 * Built: 2026-01-24T18:16:56.410Z
 * Author: Jesús Lorenzo
 * License: MIT
 */
/**
 * TM Framework - Odoo Plugin
 * Helpers for interacting with Odoo pages and RPC API
 */

(function() {
    'use strict';

    const Odoo = {
        name: 'odoo',
        
        // Configuration (set by user)
        config: {
            baseUrl: '',
            database: ''
        },

        // ═══════════════════════════════════════════════════════════════
        // INSTALLATION
        // ═══════════════════════════════════════════════════════════════
        
        install(TM) {
            TM.odoo = this;
            console.log('[TM Odoo] Plugin installed');
        },

        /**
         * Configure the plugin
         * @param {Object} options - { baseUrl, database }
         */
        configure(options = {}) {
            this.config = { ...this.config, ...options };
        },

        // ═══════════════════════════════════════════════════════════════
        // DETECTION & CONTEXT
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Check if current page is Odoo
         */
        isOdoo() {
            return window.odoo !== undefined || 
                   document.querySelector('.o_web_client') !== null ||
                   document.querySelector('script[src*="odoo"]') !== null;
        },

        /**
         * Get Odoo version
         */
        getVersion() {
            if (window.odoo?.info?.version) {
                return window.odoo.info.version;
            }
            // Try to detect from page
            const versionMeta = document.querySelector('meta[name="odoo-version"]');
            return versionMeta?.content || 'unknown';
        },

        /**
         * Get current page context
         */
        getContext() {
            const hash = window.location.hash;
            const params = new URLSearchParams(hash.replace('#', ''));
            
            return {
                model: params.get('model'),
                viewType: params.get('view_type'),
                id: params.get('id') ? parseInt(params.get('id')) : null,
                action: params.get('action') ? parseInt(params.get('action')) : null,
                menu: params.get('menu_id') ? parseInt(params.get('menu_id')) : null
            };
        },

        /**
         * Get session info
         */
        getSession() {
            if (window.odoo?.session_info) {
                return window.odoo.session_info;
            }
            return null;
        },

        /**
         * Get current database
         */
        getDatabase() {
            return this.config.database || 
                   window.odoo?.session_info?.db ||
                   this.getSession()?.db ||
                   '';
        },

        /**
         * Get current user info
         */
        getCurrentUser() {
            const session = this.getSession();
            if (session) {
                return {
                    id: session.uid,
                    name: session.name,
                    username: session.username,
                    partnerId: session.partner_id
                };
            }
            return null;
        },

        // ═══════════════════════════════════════════════════════════════
        // RPC API
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Get CSRF token
         */
        getCsrfToken() {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta?.content || '';
        },

        /**
         * Make JSON-RPC call to Odoo
         * @param {string} url - Endpoint (e.g., '/web/dataset/call_kw')
         * @param {Object} params - RPC parameters
         */
        async rpc(url, params = {}) {
            const baseUrl = this.config.baseUrl || window.location.origin;
            const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
            
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCsrfToken()
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params,
                    id: Math.floor(Math.random() * 1000000000)
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.error) {
                const error = new Error(data.error.data?.message || data.error.message || 'RPC Error');
                error.data = data.error;
                throw error;
            }
            
            return data.result;
        },

        /**
         * Call a model method
         * @param {string} model - Model name (e.g., 'res.partner')
         * @param {string} method - Method name
         * @param {Array} args - Positional arguments
         * @param {Object} kwargs - Keyword arguments
         */
        async call(model, method, args = [], kwargs = {}) {
            return this.rpc('/web/dataset/call_kw', {
                model,
                method,
                args,
                kwargs: {
                    context: this.getSession()?.user_context || {},
                    ...kwargs
                }
            });
        },

        /**
         * Search records
         * @param {string} model
         * @param {Array} domain - Search domain
         * @param {Object} options - { fields, limit, offset, order }
         */
        async search(model, domain = [], options = {}) {
            const { fields = [], limit = 80, offset = 0, order = '' } = options;
            
            return this.call(model, 'search_read', [domain], {
                fields,
                limit,
                offset,
                order
            });
        },

        /**
         * Read records by IDs
         * @param {string} model
         * @param {number[]} ids
         * @param {string[]} fields
         */
        async read(model, ids, fields = []) {
            return this.call(model, 'read', [ids], { fields });
        },

        /**
         * Create a record
         * @param {string} model
         * @param {Object} values
         */
        async create(model, values) {
            return this.call(model, 'create', [values]);
        },

        /**
         * Update records
         * @param {string} model
         * @param {number[]} ids
         * @param {Object} values
         */
        async write(model, ids, values) {
            return this.call(model, 'write', [ids, values]);
        },

        /**
         * Delete records
         * @param {string} model
         * @param {number[]} ids
         */
        async unlink(model, ids) {
            return this.call(model, 'unlink', [ids]);
        },

        // ═══════════════════════════════════════════════════════════════
        // TIMESHEET SPECIFIC HELPERS
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Search projects by name
         * @param {string} name
         */
        async searchProjects(name) {
            return this.search('project.project', [
                ['name', 'ilike', name],
                ['active', '=', true]
            ], {
                fields: ['id', 'name', 'partner_id'],
                limit: 20
            });
        },

        /**
         * Search tasks
         * @param {string} name
         * @param {number} projectId - Optional project filter
         */
        async searchTasks(name, projectId = null) {
            const domain = [
                ['name', 'ilike', name],
                ['active', '=', true]
            ];
            
            if (projectId) {
                domain.push(['project_id', '=', projectId]);
            }
            
            return this.search('project.task', domain, {
                fields: ['id', 'name', 'project_id'],
                limit: 20
            });
        },

        /**
         * Create timesheet entry
         * @param {Object} data - { projectId, taskId, description, hours, date }
         */
        async createTimesheet(data) {
            const { projectId, taskId, description, hours, date } = data;
            const user = this.getCurrentUser();
            
            const values = {
                project_id: parseInt(projectId),
                task_id: taskId ? parseInt(taskId) : false,
                name: description,
                unit_amount: parseFloat(hours),
                date: date || new Date().toISOString().split('T')[0],
                employee_id: user?.id || false
            };
            
            return this.create('account.analytic.line', values);
        },

        // ═══════════════════════════════════════════════════════════════
        // DOM HELPERS
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Common Odoo selectors (v16+)
         */
        selectors: {
            webClient: '.o_web_client',
            actionManager: '.o_action_manager',
            formView: '.o_form_view',
            listView: '.o_list_view',
            kanbanView: '.o_kanban_view',
            navbar: '.o_main_navbar',
            sidebar: '.o_cp_searchview',
            breadcrumb: '.o_breadcrumb',
            field: (name) => `div[name="${name}"]`,
            fieldInput: (name) => `div[name="${name}"] input`,
            button: (name) => `button[name="${name}"]`
        },

        /**
         * Wait for Odoo to be ready
         */
        async waitForReady(timeout = 10000) {
            return TM.waitForElement(this.selectors.webClient, timeout);
        },

        /**
         * Wait for form view to load
         */
        async waitForForm(timeout = 5000) {
            return TM.waitForElement(this.selectors.formView, timeout);
        },

        /**
         * Get field element
         * @param {string} fieldName
         */
        getField(fieldName) {
            return document.querySelector(this.selectors.field(fieldName));
        },

        /**
         * Get field input element
         * @param {string} fieldName
         */
        getFieldInput(fieldName) {
            return document.querySelector(this.selectors.fieldInput(fieldName));
        },

        /**
         * Set field value (triggers Odoo's change handlers)
         * @param {string} fieldName
         * @param {string} value
         */
        setFieldValue(fieldName, value) {
            const input = this.getFieldInput(fieldName);
            if (!input) return false;
            
            // Focus and set value
            input.focus();
            input.value = value;
            
            // Trigger events that Odoo listens to
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
            
            return true;
        },

        /**
         * Click field to open dropdown/autocomplete
         * @param {string} fieldName
         */
        clickField(fieldName) {
            const field = this.getField(fieldName);
            if (!field) return false;
            
            const clickable = field.querySelector('input, .o_input, .dropdown-toggle');
            if (clickable) {
                clickable.click();
                return true;
            }
            
            return false;
        },

        /**
         * Select dropdown option
         * @param {string} text - Option text to select
         */
        selectDropdownOption(text) {
            const options = document.querySelectorAll('.o_m2o_dropdown_option, .dropdown-item, .ui-menu-item');
            
            for (const option of options) {
                if (option.textContent.includes(text)) {
                    option.click();
                    return true;
                }
            }
            
            return false;
        },

        /**
         * Navigate to a menu item
         * @param {string} menuName
         */
        navigateToMenu(menuName) {
            const menuItems = document.querySelectorAll('.o_menu_entry_lvl_1, .dropdown-item');
            
            for (const item of menuItems) {
                if (item.textContent.trim().toLowerCase().includes(menuName.toLowerCase())) {
                    item.click();
                    return true;
                }
            }
            
            return false;
        },

        /**
         * Open URL in Odoo (handles hash-based routing)
         * @param {string} model
         * @param {number} id
         * @param {string} viewType
         */
        openRecord(model, id, viewType = 'form') {
            const url = `/web#model=${model}&id=${id}&view_type=${viewType}`;
            window.location.href = url;
        },

        /**
         * Open timesheet view
         */
        openTimesheets() {
            window.location.href = '/web#action=hr_timesheet.act_hr_timesheet_line';
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // AUTO-REGISTER PLUGIN
    // ═══════════════════════════════════════════════════════════════════
    
    if (typeof TM !== 'undefined') {
        TM.use('odoo', Odoo);
    } else {
        window.TMOdoo = Odoo;
    }

})();