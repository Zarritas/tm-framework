/*!
 * TM Framework - Plugin: gitlab
 * Version: 1.3.0
 * Built: 2026-09-11T08:04:59.315Z
 * Author: Jesús Lorenzo
 * License: MIT
 */
/**
 * TM Framework - GitLab Plugin
 * Helpers for interacting with GitLab pages and API
 *
 * Every DOM selector lives in plugins/gitlab-dom.js (TMGitLabDOM), which
 * resolves them against the page layout: GitLab 18.x renders issues with the
 * new "work item" view and merge requests with the legacy sidebar. Load
 * gitlab-dom.js before this file.
 */

(function() {
    'use strict';

    /**
     * The shared selector module. Never cached: on a SPA navigation the layout
     * can change between an issue and a merge request.
     */
    function dom() {
        const mod = globalThis.TMGitLabDOM;
        if (!mod) {
            throw new Error('[GitLab] TMGitLabDOM not loaded. @require plugins/gitlab-dom.js first.');
        }
        return mod;
    }

    const GitLab = {
        name: 'gitlab',
        
        // ═══════════════════════════════════════════════════════════════
        // INSTALLATION
        // ═══════════════════════════════════════════════════════════════
        
        install(TM) {
            TM.gitlab = this;
            TM.Logger.info('GitLab', 'Plugin installed');
        },

        // ═══════════════════════════════════════════════════════════════
        // URL & CONTEXT PARSING
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Check if current page is GitLab
         */
        isGitLab() {
            return dom().isGitLab();
        },

        /**
         * Get current page context
         * @returns {{ type, namespace, project, id, iid, fullPath }}
         */
        getContext() {
            const base = dom().getContext();
            const url = globalThis.location.pathname;
            const parts = url.split('/').filter(Boolean);

            // gitlab-dom only classifies issuables; add the page types that
            // only this plugin cares about.
            let type = base.type;
            let id = null;

            if (type === 'unknown') {
                if (url.includes('/-/pipelines/')) {
                    type = 'pipeline';
                    id = parts[parts.indexOf('pipelines') + 1];
                } else if (url.includes('/-/jobs/')) {
                    type = 'job';
                    id = parts[parts.indexOf('jobs') + 1];
                } else if (url.includes('/-/boards')) {
                    type = 'board';
                } else if (url.includes('/-/tree/') || url.includes('/-/blob/')) {
                    type = 'repository';
                }
            }

            return { ...base, type, id };
        },

        /**
         * Get project ID from page
         */
        getProjectId() {
            return dom().getProjectId();
        },

        /**
         * Get full project path, e.g. "odoo-16/fl-v16"
         */
        getProjectPath() {
            return dom().getProjectPath();
        },

        // ═══════════════════════════════════════════════════════════════
        // API HELPERS
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Get CSRF token for API requests
         */
        getCsrfToken() {
            return dom().getCsrfToken();
        },

        /**
         * Make authenticated API request
         * @param {string} endpoint - API endpoint (e.g., '/api/v4/projects/123')
         * @param {Object} options - Request options
         */
        async api(endpoint, options = {}) {
            const baseUrl = globalThis.location.origin;
            const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
            
            const defaultHeaders = {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.getCsrfToken()
            };
            
            const method = options.method || 'GET';
            const headers = {
                ...defaultHeaders,
                ...options.headers
            };
            
            // Use Tampermonkey API if available
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                return new Promise((resolve, reject) => {
                    const requestOptions = {
                        method,
                        url,
                        headers,
                        onload: function(response) {
                            try {
                                const data = JSON.parse(response.responseText);
                                if (response.status >= 200 && response.status < 300) {
                                    resolve(data);
                                } else {
                                    reject(new Error(`GitLab API error: ${response.status} ${response.statusText}`));
                                }
                            } catch (e) {
                                reject(new Error(`GitLab API parse error: ${e.message}`));
                            }
                        },
                        onerror: function(error) {
                            reject(new Error(`GitLab API network error: ${error?.message || 'Unknown error'}`));
                        }
                    };
                    
                    // Add body for non-GET requests
                    if (method !== 'GET' && options.body) {
                        requestOptions.data = typeof options.body === 'string' 
                            ? options.body 
                            : JSON.stringify(options.body);
                    }
                    
                    GM_xmlhttpRequest(requestOptions);
                });
            }
            
            // Fallback to fetch
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }
            
            return response.json();
        },

        /**
         * Get project labels
         * @param {string} projectId
         */
        async getLabels(projectId = null) {
            const pid = projectId || this.getProjectId();
            if (!pid) throw new Error('Project ID not found');
            
            const encodedPath = encodeURIComponent(pid);
            return this.api(`/api/v4/projects/${encodedPath}/labels?per_page=100`);
        },

        /**
         * Get issue/MR details
         * @param {string} type - 'issues' or 'merge_requests'
         * @param {string} iid - Internal ID
         */
        async getIssuable(type, iid, projectId = null) {
            const pid = projectId || this.getProjectId();
            const encodedPath = encodeURIComponent(pid);
            return this.api(`/api/v4/projects/${encodedPath}/${type}/${iid}`);
        },

        /**
         * Update issue/MR labels
         * @param {string} type - 'issues' or 'merge_requests'
         * @param {string} iid
         * @param {string[]} labels
         */
        async updateLabels(type, iid, labels, projectId = null) {
            const pid = projectId || this.getProjectId();
            const encodedPath = encodeURIComponent(pid);
            
            return this.api(`/api/v4/projects/${encodedPath}/${type}/${iid}`, {
                method: 'PUT',
                body: JSON.stringify({ labels: labels.join(',') })
            });
        },

        // ═══════════════════════════════════════════════════════════════
        // DOM HELPERS
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Common GitLab selectors, resolved for the current page layout.
         * Kept as a getter for backwards compatibility: the values change
         * between an issue (work item) and a merge request (classic).
         */
        get selectors() {
            const d = dom();
            return {
                sidebar: d.resolve('sidebar') || d.candidates('sidebar')[0],
                sidebarLabels: d.resolve('labelsBlock') || d.candidates('labelsBlock')[0],
                noteTextarea: d.resolve('commentEditor') || d.candidates('commentEditor')[0],
                submitButton: d.resolve('commentSubmit') || d.candidates('commentSubmit')[0],
                currentLabels: d.resolve('currentLabel') || d.candidates('currentLabel')[0],
                labelsEdit: d.resolve('labelsEditButton') || d.candidates('labelsEditButton')[0],
                title: d.resolve('title') || d.candidates('title')[0],
                notes: d.resolve('notes') || d.candidates('notes')[0]
            };
        },

        /**
         * Get sidebar element
         */
        getSidebar() {
            return dom().query('sidebar');
        },

        /**
         * Get current labels from sidebar
         */
        getCurrentLabels() {
            return dom().getCurrentLabels();
        },

        /**
         * Insert quick action into comment
         * @param {string} action - Quick action (e.g., '/label ~bug')
         */
        insertQuickAction(action) {
            const d = dom();

            // On the work item view (GitLab >= 18.x issues) the comment field
            // is a TipTap/ProseMirror contenteditable, not a <textarea>:
            // assigning .value is a silent no-op. Fail loudly instead, and use
            // updateLabels() / the REST API for label changes there.
            if (d.getLayout() === d.LAYOUT.WORK_ITEM) {
                TM.Logger.warn('GitLab', 'Quick actions are not supported on the work item view; use the API instead');
                return false;
            }

            const textarea = document.querySelector(this.selectors.noteTextarea);
            if (!textarea || typeof textarea.value !== 'string') return false;

            // Switch to plain text mode if in rich text
            const plainTextBtn = document.querySelector('[data-testid="plain-text-button"]');
            if (plainTextBtn && !plainTextBtn.classList.contains('active')) {
                plainTextBtn.click();
            }

            // Preserve existing content
            const existingContent = textarea.value.trim();
            const newContent = existingContent
                ? `${existingContent}\n\n${action}`
                : action;

            textarea.value = newContent;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            return true;
        },

        /**
         * Submit current comment form
         */
        submitComment() {
            const button = dom().query('commentSubmit');
            if (button && !button.disabled) {
                button.click();
                return true;
            }
            return false;
        },

        /**
         * Apply labels via quick actions
         * @param {string[]} addLabels - Labels to add
         * @param {string[]} removeLabels - Labels to remove
         */
        applyLabelsViaQuickAction(addLabels = [], removeLabels = []) {
            const actions = [];
            
            if (addLabels.length) {
                const labelStr = addLabels.map(l => `~"${l}"`).join(' ');
                actions.push(`/label ${labelStr}`);
            }
            
            if (removeLabels.length) {
                const labelStr = removeLabels.map(l => `~"${l}"`).join(' ');
                actions.push(`/unlabel ${labelStr}`);
            }
            
            if (actions.length) {
                return this.insertQuickAction(actions.join('\n'));
            }
            
            return false;
        },

        // ═══════════════════════════════════════════════════════════════
        // UI INJECTION HELPERS
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Wait for sidebar to be ready
         */
        async waitForSidebar(timeout = 10000) {
            return dom().waitFor('sidebar', timeout);
        },

        /**
         * Add button to the page action bar.
         *
         * The old implementation anchored on [data-testid="sidebar-todo"],
         * which no longer exists on issues and moved out of
         * .issuable-sidebar-header on merge requests. gitlab-dom resolves the
         * right anchor per layout.
         *
         * @param {Object} options - { id, text, icon, onClick }
         */
        addSidebarButton(options = {}) {
            const { id, text = '', icon = '', onClick } = options;
            const label = [icon, text].filter(Boolean).join(' ');

            const btn = dom().injectButton({ id, text: label, title: text, onClick });
            if (!btn) {
                TM.Logger.warn('GitLab', 'No action bar found to inject button into');
            }
            return btn;
        },

        /**
         * Add button next to the labels edit button
         */
        addLabelsButton(options = {}) {
            const d = dom();
            const editBtn = d.query('labelsEditButton');

            if (editBtn) {
                const btn = new TM.Button({
                    icon: options.icon || '\u{1F3F7}\uFE0F',
                    variant: 'ghost',
                    size: 'sm',
                    onClick: options.onClick
                });
                btn.insertAfter(editBtn);
                return btn;
            }

            const labelsBlock = d.query('labelsBlock');
            if (!labelsBlock) {
                TM.Logger.warn('GitLab', 'Labels block not found');
                return null;
            }

            const btn = new TM.Button({
                icon: options.icon || '\u{1F3F7}\uFE0F',
                variant: 'ghost',
                size: 'sm',
                onClick: options.onClick
            });
            btn.mount(labelsBlock);
            return btn;
        },

        /**
         * Run a callback on load and on every SPA navigation / re-render.
         * See TMGitLabDOM.onPage.
         */
        onPage(callback, options = {}) {
            return dom().onPage(callback, options);
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // AUTO-REGISTER PLUGIN
    // ═══════════════════════════════════════════════════════════════════
    
    if (typeof TM !== 'undefined') {
        TM.use('gitlab', GitLab);
    } else {
        globalThis.TMGitLab = GitLab;
    }

})();