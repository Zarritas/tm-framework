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
        },
        // The fixed breadcrumb bar at the very top of the page. Identical in
        // both layouts, and the only container that stays in the viewport
        // while scrolling: the work item header scrolls away, taking GitLab's
        // own Edit button with it.
        topBar: [
            '[data-testid="top-bar"] .top-bar-container',
            '.top-bar-fixed .top-bar-container',
            '[data-testid="top-bar"]'
        ],
        // Condensed header GitLab mounts under the top bar once the real
        // header scrolls away. It is created and destroyed on scroll, so
        // anything injected into it has to be re-injected when it comes back.
        stickyHeader: [
            '[data-testid="work-item-sticky-header"]',
            '.issue-sticky-header',
            '.merge-request-sticky-header'
        ],
        // The Edit button, in the real header and in the sticky one.
        editButton: {
            'work-item': ['[data-testid="work-item-edit-form-button"]'],
            classic: ['.js-issuable-edit', '[data-testid="edit-title-button"]']
        },
        editButtonSticky: [
            '[data-testid="work-item-edit-button-sticky"]',
            '[data-testid="work-item-sticky-header"] .shortcut-edit-wi-description'
        ]
    };

    /**
     * Per-page selector overrides added at runtime by a userscript, so a
     * GitLab upgrade can be patched without waiting for a framework release.
     * See GitLabDOM.override().
     */
    const OVERRIDES = {};

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
         * GitLab version as numbers, e.g. { major: 18, minor: 2, patch: 8 }.
         * All zeros when the page does not report a version.
         */
        getVersionParts() {
            const raw = this.getVersion() || '';
            const [major = 0, minor = 0, patch = 0] = raw.split('.').map(n => parseInt(n, 10) || 0);
            return { major, minor, patch };
        },

        /**
         * Is the running GitLab at least this version?
         *
         * Use it only for behaviour that genuinely depends on the release
         * (an API field, a removed endpoint). Do NOT use it to pick DOM
         * selectors: GitLab ships layouts behind feature flags and staged
         * rollouts, and on 18.2.8 a single instance already serves the work
         * item layout for issues and the classic one for merge requests.
         * getLayout() reads the DOM for exactly that reason.
         */
        atLeast(major, minor = 0, patch = 0) {
            const v = this.getVersionParts();
            if (v.major !== major) return v.major > major;
            if (v.minor !== minor) return v.minor > minor;
            return v.patch >= patch;
        },

        /**
         * Add selector candidates for a key at runtime, tried before the
         * built-in ones. Lets a userscript patch a GitLab upgrade on its own:
         *
         *   TMGitLabDOM.override('labelsBlock', '[data-testid="nuevo-id"]');
         *
         * @param {string} key
         * @param {string|string[]} selectors
         */
        override(key, selectors) {
            if (!SELECTORS[key]) throw new Error(`[GitLabDOM] Unknown selector key: ${key}`);
            const list = Array.isArray(selectors) ? selectors : [selectors];
            OVERRIDES[key] = [...(OVERRIDES[key] || []), ...list];
            return this;
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

            const overrides = OVERRIDES[key] || [];
            if (typeof entry === 'string') return [...overrides, entry];
            if (Array.isArray(entry)) return [...overrides, ...entry];

            const layout = this.getLayout();
            const preferred = entry[layout] || [];
            const rest = Object.keys(entry)
                .filter(k => k !== layout)
                .flatMap(k => entry[k]);

            return [...overrides, ...preferred, ...rest];
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
            this._warnUnresolved(key);
            return null;
        },

        /**
         * Warn once per key when no candidate matched. This is the early
         * signal that a GitLab upgrade moved something: it names the version,
         * the layout and the key, so the fix is one override() away.
         */
        _warnUnresolved(key) {
            if (this._warned.has(key)) return;
            this._warned.add(key);
            console.warn(
                `[GitLabDOM] No selector matched "${key}" on GitLab ${this.getVersion() || '?'} ` +
                `(layout: ${this.getLayout()}). Tried: ${this.candidates(key).join(', ')}`
            );
        },

        _warned: new Set(),

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
         * Every place a button should be mounted, for the current page.
         *
         * There is more than one, and that is the point: GitLab's header
         * scrolls away and is replaced by a condensed sticky header with its
         * own Edit button. To stay reachable the button has to live in both,
         * so each anchor gets its own copy, keyed to derive a unique id.
         *
         * 'header' (default): next to Edit, plus the sticky header while it
         *   exists.
         * 'topbar': the fixed breadcrumb bar. One anchor, always visible, but
         *   away from GitLab's own controls.
         *
         * @param {'header'|'topbar'} placement
         * @returns {{ key, anchor, mode, size }[]}
         */
        getActionBarAnchors(placement = 'header') {
            if (placement === 'topbar') {
                const bar = this.query('topBar');
                return bar ? [{ key: 'main', anchor: bar, mode: 'append', size: 'sm' }] : [];
            }

            const anchors = [];
            const layout = this.getLayout();

            if (layout === LAYOUT.WORK_ITEM) {
                const edit = this.query('editButton');
                if (edit) {
                    anchors.push({ key: 'main', anchor: edit, mode: 'before', size: 'md' });
                } else {
                    const actions = document.querySelector('[data-testid="work-item-actions-dropdown"]');
                    if (actions?.parentElement) {
                        anchors.push({ key: 'main', anchor: actions.parentElement, mode: 'before', size: 'md' });
                    }
                }
            } else {
                // Classic: the to-do button's container. Its parent is
                // .merge-request-tabs-actions on MRs, NOT .issuable-sidebar-header,
                // which is why the old compound selector never matched.
                const todo = document.querySelector('[data-testid="sidebar-todo"]');
                if (todo?.parentElement) {
                    anchors.push({ key: 'main', anchor: todo, mode: 'after', size: 'md' });
                } else {
                    const header = document.querySelector('.detail-page-header-actions, .issuable-sidebar-header');
                    if (header) anchors.push({ key: 'main', anchor: header, mode: 'append', size: 'md' });
                }
            }

            // Only present once the page has been scrolled.
            const stickyEdit = this.query('editButtonSticky');
            if (stickyEdit) {
                anchors.push({ key: 'sticky', anchor: stickyEdit, mode: 'before', size: 'md' });
            } else {
                const sticky = this.query('stickyHeader');
                const inner = sticky?.querySelector('.work-item-sticky-header-text') || sticky;
                if (inner) anchors.push({ key: 'sticky', anchor: inner, mode: 'append', size: 'md' });
            }

            // Nowhere to put it (an unknown page): fall back to the top bar
            // rather than dropping the button silently.
            if (!anchors.length) {
                const bar = this.query('topBar');
                if (bar) anchors.push({ key: 'main', anchor: bar, mode: 'append', size: 'sm' });
            }

            return anchors;
        },

        /**
         * Back-compat: the first anchor for a placement.
         * @deprecated use getActionBarAnchors()
         */
        getActionBarAnchor(placement = 'header') {
            return this.getActionBarAnchors(placement)[0] || null;
        },

        /**
         * The element id a button gets at a given anchor. The main anchor
         * keeps the caller's id so existing lookups keep working.
         */
        buttonIdFor(id, key) {
            return key === 'main' ? id : `${id}--${key}`;
        },

        /**
         * Is the button mounted at every anchor the page currently offers?
         * False when the sticky header has just appeared with no copy in it.
         */
        isButtonMounted(id, placement = 'header') {
            const anchors = this.getActionBarAnchors(placement);
            if (!anchors.length) return false;
            return anchors.every(a => document.getElementById(this.buttonIdFor(id, a.key)) !== null);
        },

        /**
         * Create a button styled like GitLab's own.
         *
         * Keep `icon` (an emoji) or `iconUrl` (an image) separate from `text`:
         * that is what lets the label be hidden while the button stays
         * recognisable. See setButtonLabels().
         *
         * @param {{ id, text, title, onClick, size, icon, iconUrl }} options
         */
        createButton({ id, text = '', title = '', onClick, size = 'md', icon = '', iconUrl = '' }) {
            const btn = document.createElement('button');
            btn.type = 'button';
            if (id) btn.id = id;
            btn.title = title || text;
            btn.className = `btn gl-button btn-default btn-${size} btn-default-secondary gl-shrink-0 tm-injected-btn`;

            if (iconUrl) {
                const img = document.createElement('img');
                img.src = iconUrl;
                img.alt = '';
                // The top bar is only 48px tall, so the icon has to follow the size.
                img.height = size === 'sm' ? 16 : 25;
                btn.appendChild(img);
            } else if (icon) {
                const span = document.createElement('span');
                span.className = 'tm-btn-icon';
                span.setAttribute('aria-hidden', 'true');
                span.innerText = icon;
                btn.appendChild(span);
            }

            const label = document.createElement('span');
            label.className = 'gl-button-text';
            label.innerText = text;
            btn.appendChild(label);

            if (onClick) btn.addEventListener('click', onClick);

            this._applyLabelVisibility(btn);
            return btn;
        },

        // ═══════════════════════════════════════════════════════════════
        // BUTTON LABELS
        // ═══════════════════════════════════════════════════════════════

        _labelsVisible: true,

        /**
         * Show or hide the text of every injected button, keeping the icon.
         * Buttons injected later inherit the setting, so a userscript only
         * has to call this once (and again from its menu command).
         *
         * A button with no icon keeps its label regardless: hiding it would
         * leave an empty button.
         *
         * @param {boolean} visible
         * @returns {boolean} the setting actually applied
         */
        setButtonLabels(visible) {
            this._labelsVisible = visible !== false;
            document.querySelectorAll('.tm-injected-btn')
                .forEach(btn => this._applyLabelVisibility(btn));
            return this._labelsVisible;
        },

        /**
         * Flip the label setting.
         * @returns {boolean} the new setting
         */
        toggleButtonLabels() {
            return this.setButtonLabels(!this._labelsVisible);
        },

        /**
         * @returns {boolean} whether button labels are currently shown
         */
        areButtonLabelsVisible() {
            return this._labelsVisible;
        },

        _applyLabelVisibility(btn) {
            const label = btn.querySelector('.gl-button-text');
            if (!label) return;

            const hasIcon = btn.querySelector('img, .tm-btn-icon') !== null;
            const hide = !this._labelsVisible && hasIcon;

            label.hidden = hide;
            // GitLab's button CSS sets display on the label, which would win
            // over [hidden]; the inline style keeps this working anyway.
            label.style.display = hide ? 'none' : '';
        },

        /**
         * Mount a button at every anchor the page offers, skipping the ones
         * where it already is. Idempotent, so it is safe to call on every
         * DOM mutation.
         *
         * By default that means next to Edit and, once the page is scrolled,
         * in the sticky header too. Pass placement: 'topbar' for a single
         * copy in the fixed breadcrumb bar.
         *
         * @param {{ id, text, title, onClick, icon, iconUrl, placement }} options
         * @returns {Element|null} the button at the main anchor, or null if
         *   there was nowhere to put it
         */
        injectButton(options = {}) {
            const { id, placement = 'header' } = options;
            const anchors = this.getActionBarAnchors(placement);
            if (!anchors.length) return null;

            let main = null;

            for (const { key, anchor, mode, size } of anchors) {
                const buttonId = this.buttonIdFor(id, key);
                let btn = id ? document.getElementById(buttonId) : null;

                if (!btn) {
                    btn = this.createButton({ size, ...options, id: buttonId });
                    if (mode === 'before') anchor.before(btn);
                    else if (mode === 'after') anchor.after(btn);
                    else anchor.appendChild(btn);
                }

                if (key === 'main') main = btn;
            }

            return main || document.getElementById(this.buttonIdFor(id, anchors[0].key));
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
         * @param {{ match?: Function, guard?: string|Function, placement?: string, debounce?: number }} options
         *   match:  () => boolean, whether callback should run on this page
         *   guard:  id of an injected button — the callback runs again while
         *           it is missing from any anchor; or a function returning
         *           true when there is nothing left to do
         *   placement: which anchors the guard checks (default 'header')
         *   debounce: ms to coalesce DOM mutations (default 150)
         * @returns {Function} unsubscribe
         */
        onPage(callback, options = {}) {
            const { match, guard, placement = 'header', debounce = 150 } = options;
            const self = this;
            let timer = null;
            let lastUrl = globalThis.location.href;

            const shouldRun = () => {
                // A string guard is the id of an injected button: it counts as
                // mounted only when it is at every anchor, so the callback runs
                // again when the sticky header appears mid-scroll.
                if (typeof guard === 'function') {
                    if (guard(self.getContext())) return false;
                } else if (guard && self.isButtonMounted(guard, placement)) {
                    return false;
                }

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
