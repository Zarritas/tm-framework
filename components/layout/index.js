/**
 * TM Framework - Layout Components
 * Card, Tabs, Accordion, FloatingButton
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // CARD
    // ═══════════════════════════════════════════════════════════════
    
    class Card extends Component {
        static defaultProps = {
            title: '',
            subtitle: '',
            icon: null,
            footer: null,
            hoverable: false,
            bordered: true,
            shadow: 'sm',       // none, sm, md, lg
            padding: 'md',      // none, sm, md, lg
            headerAction: null  // { icon, onClick }
        };

        render() {
            const { title, subtitle, icon, footer, hoverable, bordered, shadow, padding, headerAction } = this.props;
            
            const classes = classNames(
                'tm-card', 'tm-component',
                bordered && 'tm-card--bordered',
                hoverable && 'tm-card--hoverable',
                shadow !== 'none' && `tm-card--shadow-${shadow}`,
                `tm-card--padding-${padding}`
            );
            
            const hasHeader = title || subtitle || icon || headerAction;

            return html`
                <div class="${classes}">
                    ${hasHeader ? `
                        <div class="tm-card__header">
                            ${icon ? `<span class="tm-card__icon">${icon}</span>` : ''}
                            <div class="tm-card__header-content">
                                ${title ? `<h3 class="tm-card__title">${title}</h3>` : ''}
                                ${subtitle ? `<p class="tm-card__subtitle">${subtitle}</p>` : ''}
                            </div>
                            ${headerAction ? `
                                <button class="tm-btn tm-btn--ghost tm-btn--icon tm-btn--sm" @click="handleHeaderAction">
                                    ${headerAction.icon || '⋮'}
                                </button>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="tm-card__body" ref="body">
                        <!-- Content -->
                    </div>
                    ${footer ? `<div class="tm-card__footer">${footer}</div>` : ''}
                </div>
            `;
        }

        setContent(content) {
            if (!this.refs.body) return;
            
            if (typeof content === 'string') {
                this.refs.body.innerHTML = content;
            } else if (content instanceof Component) {
                this.refs.body.innerHTML = '';
                content.mount(this.refs.body);
            } else if (content instanceof HTMLElement) {
                this.refs.body.innerHTML = '';
                this.refs.body.appendChild(content);
            }
        }

        handleHeaderAction(e) {
            this.props.headerAction?.onClick?.(e);
            this.emit('headerAction');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TABS
    // ═══════════════════════════════════════════════════════════════
    
    class Tabs extends Component {
        static defaultProps = {
            tabs: [],           // [{ key, label, icon?, disabled?, content? }]
            activeKey: null,
            variant: 'line',    // line, card, pills
            size: 'md',         // sm, md, lg
            centered: false,
            onChange: null
        };

        initialState() {
            return {
                activeKey: this.props.activeKey || this.props.tabs[0]?.key
            };
        }

        render() {
            const { tabs, variant, size, centered } = this.props;
            const { activeKey } = this.state;
            
            const navClasses = classNames(
                'tm-tabs__nav',
                `tm-tabs__nav--${variant}`,
                `tm-tabs__nav--${size}`,
                centered && 'tm-tabs__nav--centered'
            );
            
            const activeTab = tabs.find(t => t.key === activeKey);

            return html`
                <div class="tm-tabs tm-component">
                    <div class="${navClasses}" role="tablist">
                        ${tabs.map(tab => `
                            <button 
                                class="tm-tabs__tab ${tab.key === activeKey ? 'tm-tabs__tab--active' : ''} ${tab.disabled ? 'tm-tabs__tab--disabled' : ''}"
                                role="tab"
                                data-key="${tab.key}"
                                aria-selected="${tab.key === activeKey}"
                                ${tab.disabled ? 'disabled' : ''}
                                @click="handleTabClick"
                            >
                                ${tab.icon ? `<span class="tm-tabs__icon">${tab.icon}</span>` : ''}
                                <span class="tm-tabs__label">${tab.label}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div class="tm-tabs__content" ref="content" role="tabpanel">
                        ${activeTab?.content || ''}
                    </div>
                </div>
            `;
        }

        handleTabClick(e) {
            const key = e.currentTarget.dataset.key;
            const tab = this.props.tabs.find(t => t.key === key);
            
            if (!tab || tab.disabled || key === this.state.activeKey) return;
            
            this.state.activeKey = key;
            this.props.onChange?.(key, tab);
            this.emit('change', { key, tab });
        }

        setActiveTab(key) {
            this.state.activeKey = key;
        }

        setTabContent(key, content) {
            const tab = this.props.tabs.find(t => t.key === key);
            if (tab) {
                tab.content = content;
                if (this.state.activeKey === key) {
                    this.forceUpdate();
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ACCORDION
    // ═══════════════════════════════════════════════════════════════
    
    class Accordion extends Component {
        static defaultProps = {
            items: [],          // [{ key, title, content, icon?, disabled? }]
            activeKeys: [],     // Array of expanded keys
            multiple: true,     // Allow multiple open
            bordered: true,
            onChange: null
        };

        initialState() {
            return {
                activeKeys: this.props.activeKeys
            };
        }

        render() {
            const { items, bordered } = this.props;
            
            const classes = classNames(
                'tm-accordion', 'tm-component',
                bordered && 'tm-accordion--bordered'
            );

            return html`
                <div class="${classes}">
                    ${items.map(item => this.renderItem(item)).join('')}
                </div>
            `;
        }

        renderItem(item) {
            const isActive = this.state.activeKeys.includes(item.key);
            
            const itemClasses = classNames(
                'tm-accordion__item',
                isActive && 'tm-accordion__item--active',
                item.disabled && 'tm-accordion__item--disabled'
            );

            return html`
                <div class="${itemClasses}" data-key="${item.key}">
                    <button class="tm-accordion__header" @click="handleHeaderClick" ${item.disabled ? 'disabled' : ''}>
                        ${item.icon ? `<span class="tm-accordion__icon">${item.icon}</span>` : ''}
                        <span class="tm-accordion__title">${item.title}</span>
                        <span class="tm-accordion__arrow">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </span>
                    </button>
                    <div class="tm-accordion__content" style="${isActive ? '' : 'display: none;'}">
                        <div class="tm-accordion__body">${item.content}</div>
                    </div>
                </div>
            `;
        }

        handleHeaderClick(e) {
            const itemEl = e.currentTarget.closest('.tm-accordion__item');
            const key = itemEl.dataset.key;
            const item = this.props.items.find(i => i.key === key);
            
            if (!item || item.disabled) return;
            
            this.toggleItem(key);
        }

        toggleItem(key) {
            const { multiple } = this.props;
            const idx = this.state.activeKeys.indexOf(key);
            
            if (idx === -1) {
                // Open
                this.state.activeKeys = multiple 
                    ? [...this.state.activeKeys, key]
                    : [key];
            } else {
                // Close
                this.state.activeKeys = this.state.activeKeys.filter(k => k !== key);
            }
            
            this.props.onChange?.(this.state.activeKeys);
            this.emit('change', { activeKeys: this.state.activeKeys });
        }

        /**
         * Expands all accordion panels (except disabled ones)
         */
        expandAll() {
            this.state.activeKeys = this.props.items
                .filter(i => !i.disabled)
                .map(i => i.key);
        }

        /**
         * Collapses all accordion panels
         */
        collapseAll() {
            this.state.activeKeys = [];
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FLOATING ACTION BUTTON (FAB)
    // ═══════════════════════════════════════════════════════════════
    
    class FloatingButton extends Component {
        static defaultProps = {
            icon: '+',
            text: '',
            variant: 'primary',
            size: 'md',          // sm, md, lg
            position: 'bottom-right',  // bottom-right, bottom-left, bottom-center, top-right, top-left
            offset: { x: 20, y: 20 },
            tooltip: '',
            extended: false,     // Show text beside icon
            actions: [],         // [{ icon, label, onClick }] - Speed dial
            onClick: null
        };

        initialState() {
            return { 
                expanded: false 
            };
        }

        render() {
            const { icon, text, variant, size, position, offset, tooltip, extended, actions } = this.props;
            const { expanded } = this.state;
            
            const positionStyles = this.getPositionStyles(position, offset);
            
            const classes = classNames(
                'tm-fab', 'tm-component',
                `tm-fab--${variant}`,
                `tm-fab--${size}`,
                extended && text && 'tm-fab--extended',
                expanded && 'tm-fab--open'
            );

            return html`
                <div class="tm-fab-wrapper" style="${positionStyles}">
                    ${actions.length ? `
                        <div class="tm-fab__actions ${expanded ? 'tm-fab__actions--visible' : ''}">
                            ${actions.map((action, i) => `
                                <button 
                                    class="tm-fab tm-fab--${variant} tm-fab--sm tm-fab__action"
                                    data-index="${i}"
                                    title="${action.label || ''}"
                                    @click="handleActionClick"
                                    style="transition-delay: ${(actions.length - i) * 50}ms;"
                                >
                                    ${action.icon}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                    <button class="${classes}" title="${tooltip}" @click="handleClick">
                        <span class="tm-fab__icon ${expanded ? 'tm-fab__icon--rotate' : ''}">${icon}</span>
                        ${extended && text ? `<span class="tm-fab__text">${text}</span>` : ''}
                    </button>
                </div>
            `;
        }

        getPositionStyles(position, offset) {
            const styles = {
                'bottom-right': `bottom: ${offset.y}px; right: ${offset.x}px;`,
                'bottom-left': `bottom: ${offset.y}px; left: ${offset.x}px;`,
                'bottom-center': `bottom: ${offset.y}px; left: 50%; transform: translateX(-50%);`,
                'top-right': `top: ${offset.y}px; right: ${offset.x}px;`,
                'top-left': `top: ${offset.y}px; left: ${offset.x}px;`
            };
            return `position: fixed; z-index: 9999; ${styles[position] || styles['bottom-right']}`;
        }

        handleClick(e) {
            if (this.props.actions.length) {
                this.state.expanded = !this.state.expanded;
            } else {
                this.props.onClick?.(e);
                this.emit('click');
            }
        }

        handleActionClick(e) {
            const index = parseInt(e.currentTarget.dataset.index);
            const action = this.props.actions[index];
            
            action?.onClick?.(e);
            this.emit('action', { action, index });
            this.state.expanded = false;
        }

        open() {
            this.state.expanded = true;
        }

        close() {
            this.state.expanded = false;
        }

        toggle() {
            this.state.expanded = !this.state.expanded;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DIVIDER
    // ═══════════════════════════════════════════════════════════════
    
    class Divider extends Component {
        static defaultProps = {
            text: '',
            orientation: 'horizontal',  // horizontal, vertical
            textPosition: 'center',     // left, center, right
            dashed: false
        };

        render() {
            const { text, orientation, textPosition, dashed } = this.props;
            
            const classes = classNames(
                'tm-divider', 'tm-component',
                `tm-divider--${orientation}`,
                text && `tm-divider--text-${textPosition}`,
                dashed && 'tm-divider--dashed'
            );

            if (orientation === 'vertical') {
                return `<span class="${classes}"></span>`;
            }

            return html`
                <div class="${classes}">
                    ${text ? `<span class="tm-divider__text">${text}</span>` : ''}
                </div>
            `;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Card = Card;
    TM.Tabs = Tabs;
    TM.Accordion = Accordion;
    TM.FloatingButton = FloatingButton;
    TM.Divider = Divider;

})();