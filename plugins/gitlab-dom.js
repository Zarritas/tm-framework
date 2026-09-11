/**
 * TM Framework - GitLab DOM Plugin
 *
 * Single source of truth for every GitLab DOM selector used by the userscripts.
 *
 * Why this exists: since GitLab 18.x, issues are rendered by the new "work item"
 * Vue view while merge requests still use the legacy `.issuable-sidebar` layout.
 * A single selector map is no longer possible, so every lookup resolves against
 * the detected layout first and falls back to the other one. When GitLab
 * eventually migrates merge requests too, the fallback already covers it.
 *
 * Verified against GitLab 18.2.8 (rev 01bcae1d66b).
 */

(function() {
    'use strict';

    const LAYOUT = {
        WORK_ITEM: 'work-item',   // issues on GitLab >= 18.x
        CLASSIC: 'classic',       // merge requests, and issues on GitLab < 18.x
        UNKNOWN: 'unknown'
    };

    // ═══════════════════════════════════════════════════════════════════
    // SELECTOR MAP
    // ═══════════════════════════════════════════════════════════════════
    // Each key lists candidates per layout, most specific first. resolve()
    // tries the active layout, then the other one, then the shared list.

    const SELECTORS = {
        sidebar: {
            'work-item': ['[data-testid="work-item-overview-right-sidebar"]', '.work-item-attributes-wrapper'],
            classic: ['.issuable-sidebar', '.issuable-sidebar-header']
        },
        labelsBlock: {
            'work-item': ['[data-testid="work-item-labels"]', 'section.js-labels'],
            classic: ['[data-testid="sidebar-labels"]', '.js-labels-block', '.block.labels']
        },
        labelsEditButton: {
            'work-item': ['[data-testid="work-item-labels"] [data-testid="edit-button"]'],
            classic: ['.js-sidebar-dropdown-toggle', '.edit-link']
        },
        currentLabel: {
            'work-item': ['[data-testid="selected-label-content"] .gl-label'],
            classic: ['[data-testid="sidebar-labels"] .gl-label', '.issuable-show-labels .gl-label']
        },
        title: {
            'work-item': ['h1[data-testid="work-item-title"]'],
            classic: ['h1[data-testid="title-content"]', 'h1[data-testid="issue-title-text"]', '.issue-title-text', 'h1.title']
        },
        // Container the scripts append their own buttons to.
        actionBar: {
            'work-item': ['[data-testid="work-item-edit-form-button"]'],
            classic: ['[data-testid="sidebar-todo"]', '.detail-page-header-actions']
        },
        notes: {
            'work-item': ['.main-notes-list', '.work-item-notes'],
            classic: ['#notes-list', '.main-notes-list', '.notes']
        },
        // The comment editor. On work items this is a TipTap/ProseMirror
        // contenteditable: there is NO <textarea>, so `.value = ...` is a no-op.
        commentEditor: {
            'work-item': ['div.tiptap.ProseMirror'],
            classic: ['.js-note-text', '.note-textarea', 'div.tiptap.ProseMirror']
        },
        commentSubmit: {
            'work-item': ['[data-testid="confirm-button"]'],
            classic: ['.js-comment-button', '[data-testid="confirm-button"]']
        }
    };

    const GitLabDOM = {
        name: 'gitlab-dom',
        LAYOUT,
        SELECTORS,

        install(TM) {
            TM.gitlabDom = this;
            if (TM.Logger) TM.Logger.info('GitLabDOM', `Installed (layout: ${this.getLayout()})`);
        },

        // ═══════════════════════════════════════════════════════════════
        // DETECTION
        // ═══════════════════════════════════════════════════════════════

        /**
         * Is this a GitLab page at all?
         */
        isGitLab() {
            return document.querySelector('meta[content="GitLab"]') !== null ||
                document.body?.dataset?.page !== undefined ||
                document.querySelector('[data-testid="super-sidebar"]') !== null ||
                typeof globalThis.gon !== 'undefined';
        },

        /**
         * GitLab version reported by the page, e.g. "18.2.8". Null if unknown.
         */
        getVersion() {
            return globalThis.gon?.version || globalThis.gon?.gitlab_version || null;
        },

        /**
         * Rails page identifier, e.g. "projects:issues:show".
         */
        getPage() {
            return document.body?.dataset?.page || null;
        },

        /**
         * Which DOM layout is this page using?
         * Detected from the DOM rather than the version, so a feature flag
         * flip or a version bump does not silently break every lookup.
         */
        getLayout() {
            if (document.querySelector('[data-testid="work-item-overview-right-sidebar"]') ||
                document.querySelector('h1[data-testid="work-item-title"]')) {
                return LAYOUT.WORK_ITEM;
            }
            if (document.querySelector('.issuable-sidebar') ||
                document.querySelector('[data-testid="sidebar-labels"]')) {
                return LAYOUT.CLASSIC;
            }
            return LAYOUT.UNKNOWN;
        },

        // ═══════════════════════════════════════════════════════════════
        // SELECTOR RESOLUTION
        // ═══════════════════════════════════════════════════════════════

        /**
         * All candidate selectors for a key, active layout first.
         * @param {string} key
         * @returns {string[]}
         */
        candidates(key) {
            const entry = SELECTORS[key];
            if (!entry) throw new Error(`[GitLabDOM] Unknown selector key: ${key}`);
            if (typeof entry === 'string') return [entry];
            if (Array.isArray(entry)) return entry;

            const layout = this.getLayout();
            const preferred = entry[layout] || [];
            const rest = Object.keys(entry)
                .filter(k => k !== layout)
                .flatMap(k => entry[k]);

            return [...preferred, ...rest];
        },

        /**
         * First candidate selector that actually matches something.
         * @returns {string|null}
         */
        resolve(key, root = document) {
            for (const selector of this.candidates(key)) {
                try {
                    if (root.querySelector(selector)) return selector;
                } catch (e) { /* malformed selector, try the next one */ }
            }
            return null;
        },

        /**
         * @returns {Element|null}
         */
        query(key, root = document) {
            for (const selector of this.candidates(key)) {
                try {
                    const el = root.querySelector(selector);
                    if (el) return el;
                } catch (e) { /* ignore */ }
            }
            return null;
        },

        /**
         * Matches of the first candidate that matches anything.
         * @returns {Element[]}
         */
        queryAll(key, root = document) {
            for (const selector of this.candidates(key)) {
                try {
                    const els = root.querySelectorAll(selector);
                    if (els.length) return Array.from(els);
                } catch (e) { /* ignore */ }
            }
            return [];
        },

        /**
         * Resolve a key (or a raw CSS selector) once it appears in the DOM.
         * @param {string} keyOrSelector
         * @param {number} timeout - ms
         * @returns {Promise<Element>}
         */
        waitFor(keyOrSelector, timeout = 10000) {
            const isKey = Object.prototype.hasOwnProperty.call(SELECTORS, keyOrSelector);
            const find = () => isKey
                ? this.query(keyOrSelector)
                : document.querySelector(keyOrSelector);

            return new Promise((resolve, reject) => {
                const existing = find();
                if (existing) return resolve(existing);

                const observer = new MutationObserver(() => {
                    const el = find();
                    if (el) {
                        observer.disconnect();
                        clearTimeout(timer);
                        resolve(el);
                    }
                });

                const timer = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`[GitLabDOM] Timeout waiting for "${keyOrSelector}"`));
                }, timeout);

                observer.observe(document.body, { childList: true, subtree: true });
            });
        },

        // ═══════════════════════════════════════════════════════════════
        // PAGE DATA
        // ═══════════════════════════════════════════════════════════════

        /**
         * Issue / MR context from the URL.
         * @returns {{ type, iid, fullPath, namespace, project, url }}
         */
        getContext() {
            const path = globalThis.location.pathname;
            const parts = path.split('/').filter(Boolean);

            let type = 'unknown';
            let iid = null;

            // Only a numeric iid counts: /-/issues (the list) and /-/issues/new
            // must not be mistaken for a single issue, or callers relying on
            // ctx.type would inject their UI into the list page too.
            const issuableAt = (segment, issuableType) => {
                const index = parts.indexOf(segment);
                if (index === -1) return false;

                const candidate = parts[index + 1];
                if (!candidate || !/^\d+$/.test(candidate)) return false;

                type = issuableType;
                iid = candidate;
                return true;
            };

            issuableAt('issues', 'issue') ||
                issuableAt('work_items', 'issue') ||
                issuableAt('merge_requests', 'merge_request');

            const fullPath = this.getProjectPath();
            const pathParts = fullPath ? fullPath.split('/') : [];

            return {
                type,
                iid,
                fullPath,
                namespace: pathParts.slice(0, -1).join('/'),
                project: pathParts[pathParts.length - 1] || null,
                url: globalThis.location.href
            };
        },

        /**
         * Numeric project id. body[data-project-id] is the only reliable source
         * on 18.x: meta[name="project-id"] was removed.
         */
        getProjectId() {
            return document.body?.dataset?.projectId ||
                globalThis.gon?.project_id ||
                document.querySelector('meta[name="project-id"]')?.content ||
                null;
        },

        /**
         * Full project path, e.g. "odoo-16/fl-v16".
         */
        getProjectPath() {
            const fromBody = document.body?.dataset?.fullPath;
            if (fromBody) return fromBody;

            const match = globalThis.location.pathname.match(/^\/(.+?)\/-\//);
            return match ? match[1] : null;
        },

        /**
         * Absolute project URL, e.g. "https://git.example.com/odoo-16/fl-v16".
         */
        getProjectUrl() {
            const path = this.getProjectPath();
            return path ? `${globalThis.location.origin}/${path}` : null;
        },

        /**
         * Issue / MR title text.
         */
        getTitle() {
            const el = this.query('title');
            if (el) return el.textContent.trim();

            const ctx = this.getContext();
            return ctx.iid ? `#${ctx.iid}` : '';
        },

        /**
         * Logged-in user. Read from gon: the old `#disclosure-6` lookup relied
         * on an auto-generated GlDisclosureDropdown id that changes on any
         * layout change.
         * @returns {{ username, id, name }}
         */
        getCurrentUser() {
            const gon = globalThis.gon || {};
            return {
                username: gon.current_username || null,
                id: gon.current_user_id || null,
                name: gon.current_user_fullname || gon.current_username || null
            };
        },

        /**
         * Plain text of the discussion thread, for summarising.
         */
        getNotesText() {
            const notes = this.query('notes');
            return notes ? notes.textContent.trim() : '';
        },

        /**
         * Labels currently applied.
         * @returns {{ name, color }[]}
         */
        getCurrentLabels() {
            return this.queryAll('currentLabel').map(el => ({
                name: el.querySelector('.gl-label-text')?.textContent?.trim() ||
                    el.textContent.trim(),
                color: el.style.backgroundColor || el.dataset.color || null
            })).filter(l => l.name);
        },

        /**
         * CSRF token, for authenticated same-origin API calls.
         */
        getCsrfToken() {
            return document.querySelector('meta[name="csrf-token"]')?.content || '';
        },

        // ═══════════════════════════════════════════════════════════════
        // BUTTON INJECTION
        // ═══════════════════════════════════════════════════════════════

        /**
         * The element new buttons are placed next to, plus how to place them.
         * @returns {{ anchor: Element, mode: 'before'|'after'|'append' }|null}
         */
        getActionBarAnchor() {
            const layout = this.getLayout();

            if (layout === LAYOUT.WORK_ITEM) {
                // Header row: [Edit] [icon] [More actions]. Sit left of Edit.
                const edit = document.querySelector('[data-testid="work-item-edit-form-button"]');
                if (edit) return { anchor: edit, mode: 'before' };

                const actions = document.querySelector('[data-testid="work-item-actions-dropdown"]');
                if (actions?.parentElement?.parentElement) {
                    return { anchor: actions.parentElement, mode: 'before' };
                }
            }

            // Classic: the to-do button's container. Note its parent is
            // .merge-request-tabs-actions on MRs, NOT .issuable-sidebar-header,
            // which is why the old compound selector never matched.
            const todo = document.querySelector('[data-testid="sidebar-todo"]');
            if (todo?.parentElement) return { anchor: todo, mode: 'after' };

            const header = document.querySelector('.detail-page-header-actions, .issuable-sidebar-header');
            if (header) return { anchor: header, mode: 'append' };

            return null;
        },

        /**
         * Create a button styled like GitLab's own.
         * @param {{ id, text, title, onClick }} options
         */
        createButton({ id, text = '', title = '', onClick }) {
            const btn = document.createElement('button');
            btn.type = 'button';
            if (id) btn.id = id;
            if (title) btn.title = title;
            btn.className = 'btn gl-button btn-default btn-md btn-default-secondary';

            const label = document.createElement('span');
            label.className = 'gl-button-text';
            label.innerText = text;
            btn.appendChild(label);

            if (onClick) btn.addEventListener('click', onClick);
            return btn;
        },

        /**
         * Inject a button into the page action bar. Idempotent: if a button
         * with the same id is already mounted, nothing happens.
         * @returns {Element|null} the button, or null if there was nowhere to put it
         */
        injectButton(options = {}) {
            const { id } = options;
            if (id && document.getElementById(id)) {
                return document.getElementById(id);
            }

            const target = this.getActionBarAnchor();
            if (!target) return null;

            const btn = this.createButton(options);
            const { anchor, mode } = target;

            if (mode === 'before') anchor.before(btn);
            else if (mode === 'after') anchor.after(btn);
            else anchor.appendChild(btn);

            return btn;
        },

        // ═══════════════════════════════════════════════════════════════
        // SPA LIFECYCLE
        // ═══════════════════════════════════════════════════════════════

        /**
         * Run `callback` on first load and again on every SPA navigation or
         * re-render that removes what it mounted.
         *
         * GitLab 18.x renders issues as a Vue app with no full page load
         * between issues, so `window.addEventListener('load', ...)` only ever
         * fires once. It also re-renders the header on its own, which silently
         * drops injected nodes.
         *
         * @param {Function} callback - called with the current context
         * @param {{ match?: Function, guard?: string, debounce?: number }} options
         *   match:  () => boolean, whether callback should run on this page
         *   guard:  element id whose absence means callback must run again
         *   debounce: ms to coalesce DOM mutations (default 150)
         * @returns {Function} unsubscribe
         */
        onPage(callback, options = {}) {
            const { match, guard, debounce = 150 } = options;
            const self = this;
            let timer = null;
            let lastUrl = globalThis.location.href;

            const shouldRun = () => {
                if (guard && document.getElementById(guard)) return false;
                if (match && !match(self.getContext())) return false;
                return true;
            };

            const run = () => {
                if (!shouldRun()) return;
                try {
                    callback(self.getContext());
                } catch (e) {
                    console.error('[GitLabDOM] onPage callback failed:', e);
                }
            };

            const schedule = () => {
                clearTimeout(timer);
                timer = setTimeout(run, debounce);
            };

            // 1. DOM mutations: covers the Vue re-render dropping our nodes.
            const observer = new MutationObserver(() => {
                if (globalThis.location.href !== lastUrl) {
                    lastUrl = globalThis.location.href;
                }
                schedule();
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // 2. History API: covers navigating between issues without a reload.
            const patched = [];
            ['pushState', 'replaceState'].forEach(method => {
                const original = history[method];
                history[method] = function(...args) {
                    const result = original.apply(this, args);
                    schedule();
                    return result;
                };
                patched.push({ method, original });
            });

            globalThis.addEventListener('popstate', schedule);

            // 3. First run.
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', schedule, { once: true });
            } else {
                schedule();
            }

            return function unsubscribe() {
                clearTimeout(timer);
                observer.disconnect();
                globalThis.removeEventListener('popstate', schedule);
                patched.forEach(({ method, original }) => { history[method] = original; });
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // AUTO-REGISTER
    // ═══════════════════════════════════════════════════════════════════

    if (typeof TM !== 'undefined' && typeof TM.use === 'function') {
        TM.use('gitlab-dom', GitLabDOM);
    }

    // Always exposed globally: the userscripts @require this file standalone.
    globalThis.TMGitLabDOM = GitLabDOM;

})();
