/*!
 * TM Framework - Plugin: gitlab
 * Version: 1.0.0
 * Built: 2026-01-25T00:26:34.316Z
 * Author: Jesús Lorenzo
 * License: MIT
 */
/**
 * TM Framework - GitLab Plugin
 * Helpers for interacting with GitLab pages and API
 */

(function() {
    'use strict';

    const GitLab = {
        name: 'gitlab',
        
        // ═══════════════════════════════════════════════════════════════
        // INSTALLATION
        // ═══════════════════════════════════════════════════════════════
        
        install(TM) {
            TM.gitlab = this;
            console.log('[TM GitLab] Plugin installed');
        },

        // ═══════════════════════════════════════════════════════════════
        // URL & CONTEXT PARSING
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Check if current page is GitLab
         */
        isGitLab() {
            return document.querySelector('meta[content="GitLab"]') !== null ||
                   window.location.hostname.includes('gitlab');
        },

        /**
         * Get current page context
         * @returns {{ type, namespace, project, id, iid, fullPath }}
         */
        getContext() {
            const url = window.location.pathname;
            const parts = url.split('/').filter(Boolean);
            
            // Detect page type
            let type = 'unknown';
            let id = null;
            let iid = null;
            
            if (url.includes('/-/issues/')) {
                type = 'issue';
                iid = parts[parts.indexOf('issues') + 1];
            } else if (url.includes('/-/merge_requests/')) {
                type = 'merge_request';
                iid = parts[parts.indexOf('merge_requests') + 1];
            } else if (url.includes('/-/pipelines/')) {
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
            
            // Extract project path
            const projectMatch = url.match(/^\/(.+?)\/-\//);
            const fullPath = projectMatch ? projectMatch[1] : null;
            const pathParts = fullPath ? fullPath.split('/') : [];
            
            return {
                type,
                namespace: pathParts.slice(0, -1).join('/'),
                project: pathParts[pathParts.length - 1],
                fullPath,
                id,
                iid,
                url: window.location.href
            };
        },

        /**
         * Get project ID from page
         */
        getProjectId() {
            // Try meta tag first
            const meta = document.querySelector('meta[name="project-id"]');
            if (meta) return meta.content;
            
            // Try body data attribute
            const body = document.body;
            if (body.dataset.projectId) return body.dataset.projectId;
            
            // Try from page data
            const pageData = document.querySelector('[data-page]');
            if (pageData?.dataset.projectId) return pageData.dataset.projectId;
            
            return null;
        },

        // ═══════════════════════════════════════════════════════════════
        // API HELPERS
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Get CSRF token for API requests
         */
        getCsrfToken() {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta?.content || '';
        },

        /**
         * Make authenticated API request
         * @param {string} endpoint - API endpoint (e.g., '/api/v4/projects/123')
         * @param {Object} options - Request options
         */
        async api(endpoint, options = {}) {
            const baseUrl = window.location.origin;
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
         * Common GitLab selectors
         */
        selectors: {
            sidebar: '.issuable-sidebar',
            sidebarLabels: '[data-testid="sidebar-labels"]',
            sidebarTodo: '[data-testid="sidebar-todo"]',
            noteForm: '.js-main-target-form',
            noteTextarea: '.js-note-text',
            markdownEditor: '.md-area',
            submitButton: '.js-comment-button',
            labelsDropdown: '.js-labels-block .dropdown',
            currentLabels: '.issuable-show-labels .gl-label'
        },

        /**
         * Get sidebar element
         */
        getSidebar() {
            return document.querySelector(this.selectors.sidebar);
        },

        /**
         * Get current labels from sidebar
         */
        getCurrentLabels() {
            const labels = document.querySelectorAll(this.selectors.currentLabels);
            return Array.from(labels).map(el => ({
                name: el.querySelector('.gl-label-text')?.textContent?.trim(),
                color: el.style.backgroundColor || el.dataset.color
            })).filter(l => l.name);
        },

        /**
         * Insert quick action into comment
         * @param {string} action - Quick action (e.g., '/label ~bug')
         */
        insertQuickAction(action) {
            const textarea = document.querySelector(this.selectors.noteTextarea);
            if (!textarea) return false;
            
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
            const button = document.querySelector(this.selectors.submitButton);
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
        async waitForSidebar(timeout = 5000) {
            return TM.waitForElement(this.selectors.sidebar, timeout);
        },

        /**
         * Add button to sidebar
         * @param {Object} options - { text, icon, onClick, position }
         */
        addSidebarButton(options = {}) {
            const { text = '', icon = '', onClick, position = 'todo' } = options;
            
            const positionSelectors = {
                todo: this.selectors.sidebarTodo,
                labels: this.selectors.sidebarLabels
            };
            
            const targetSelector = positionSelectors[position] || position;
            const target = document.querySelector(targetSelector);
            
            if (!target) {
                console.warn('[TM GitLab] Target element not found:', targetSelector);
                return null;
            }
            
            const btn = new TM.Button({
                text,
                icon,
                variant: 'secondary',
                size: 'sm',
                onClick
            });
            
            btn.insertAfter(target);
            return btn;
        },

        /**
         * Add button next to labels edit button
         */
        addLabelsButton(options = {}) {
            const labelsBlock = document.querySelector('.js-labels-block, [data-testid="sidebar-labels"]');
            if (!labelsBlock) return null;
            
            const editBtn = labelsBlock.querySelector('.js-sidebar-dropdown-toggle, .edit-link');
            if (!editBtn) return null;
            
            const btn = new TM.Button({
                icon: options.icon || '🏷️',
                variant: 'ghost',
                size: 'sm',
                onClick: options.onClick
            });
            
            btn.insertAfter(editBtn);
            return btn;
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // AUTO-REGISTER PLUGIN
    // ═══════════════════════════════════════════════════════════════════
    
    if (typeof TM !== 'undefined') {
        TM.use('gitlab', GitLab);
    } else {
        window.TMGitLab = GitLab;
    }

})();