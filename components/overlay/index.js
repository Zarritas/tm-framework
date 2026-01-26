/**
 * TM Framework - Overlay Components
 * Modal, Drawer, Tooltip, ContextMenu
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // MODAL
    // ═══════════════════════════════════════════════════════════════
    
    class Modal extends Component {
        static defaultProps = {
            title: '',
            width: '500px',
            maxHeight: '90vh',
            closable: true,
            closeOnOverlay: true,
            closeOnEsc: true,
            footer: true,
            confirmText: 'Aceptar',
            cancelText: 'Cancelar',
            confirmVariant: 'primary',
            showCancel: true,
            loading: false,
            onConfirm: null,
            onCancel: null,
            onClose: null,
            onOpen: null
        };

        initialState() {
            return { 
                visible: false,
                confirmLoading: false
            };
        }

        onMount() {
            // Handle ESC key
            this._escHandler = (e) => {
                if (e.key === 'Escape' && this.state.visible && this.props.closeOnEsc) {
                    this.close();
                }
            };
            document.addEventListener('keydown', this._escHandler);
        }

        onDestroy() {
            document.removeEventListener('keydown', this._escHandler);
            document.body.style.overflow = '';
        }

        render() {
            if (!this.state.visible) {
                return '<div class="tm-modal-anchor" style="display:none"></div>';
            }
            
            const { title, width, maxHeight, closable, footer, confirmText, cancelText, confirmVariant, showCancel, loading } = this.props;
            const { confirmLoading } = this.state;

            return html`
                <div class="tm-overlay tm-component" @click="handleOverlayClick">
                    <div class="tm-modal" style="width: ${width}; max-height: ${maxHeight};" @click="stopPropagation">
                        <div class="tm-modal__header">
                            <h3 class="tm-modal__title">${title}</h3>
                            ${closable ? `
                                <button class="tm-btn tm-btn--ghost tm-btn--icon tm-modal__close" @click="handleClose">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        <div class="tm-modal__body" ref="body">
                            <!-- Content -->
                        </div>
                        ${footer ? html`
                            <div class="tm-modal__footer">
                                ${showCancel ? `
                                    <button class="tm-btn tm-btn--secondary" @click="handleCancel" ${loading ? 'disabled' : ''}>
                                        ${cancelText}
                                    </button>
                                ` : ''}
                                <button class="tm-btn tm-btn--${confirmVariant}" @click="handleConfirm" ${confirmLoading ? 'disabled' : ''}>
                                    ${confirmLoading ? '<span class="tm-spinner tm-spinner--sm"></span>' : ''}
                                    ${confirmText}
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        /**
         * Opens the modal
         * @fires open
         */
        open() {
            this.state.visible = true;
            document.body.style.overflow = 'hidden';
            this.props.onOpen?.();
            this.emit('open');
        }

        /**
         * Closes the modal
         * @fires close
         */
        close() {
            this.state.visible = false;
            this.state.confirmLoading = false;
            document.body.style.overflow = '';
            this.props.onClose?.();
            this.emit('close');
        }

        /**
         * Updates the modal body content
         * @param {string|Component|HTMLElement} content - New content to display
         */
        setContent(content) {
            requestAnimationFrame(() => {
                if (!this.refs.body) return;

                if (typeof content === 'string') {
                    this.refs.body.innerHTML = content;
                } else if (content instanceof Component) {
                    this.refs.body.innerHTML = '';
                    content.mount(this.refs.body);
                    this.addChild('content', content);
                } else if (content instanceof HTMLElement) {
                    this.refs.body.innerHTML = '';
                    this.refs.body.appendChild(content);
                }
            });
        }

        /**
         * Sets the confirm button loading state
         * @param {boolean} loading - Loading state
         */
        setConfirmLoading(loading) {
            this.state.confirmLoading = loading;
        }

        handleOverlayClick(e) {
            if (this.props.closeOnOverlay && e.target.classList.contains('tm-overlay')) {
                this.close();
            }
        }

        stopPropagation(e) {
            e.stopPropagation();
        }

        handleClose() {
            this.close();
        }

        async handleConfirm() {
            const result = this.props.onConfirm?.();
            
            // If onConfirm returns a promise, show loading
            if (result instanceof Promise) {
                this.state.confirmLoading = true;
                try {
                    await result;
                    this.close();
                } catch (e) {
                    console.error('[TM Modal] Confirm error:', e);
                } finally {
                    this.state.confirmLoading = false;
                }
            } else {
                this.emit('confirm');
            }
        }

        handleCancel() {
            this.props.onCancel?.();
            this.emit('cancel');
            this.close();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DRAWER (Side Panel)
    // ═══════════════════════════════════════════════════════════════
    
    class Drawer extends Component {
        static defaultProps = {
            title: '',
            position: 'right',  // left, right, top, bottom
            size: '400px',
            closable: true,
            closeOnOverlay: true,
            closeOnEsc: true,
            footer: false,
            onClose: null
        };

        initialState() {
            return { visible: false };
        }

        onMount() {
            this._escHandler = (e) => {
                if (e.key === 'Escape' && this.state.visible && this.props.closeOnEsc) {
                    this.close();
                }
            };
            document.addEventListener('keydown', this._escHandler);
        }

        onDestroy() {
            document.removeEventListener('keydown', this._escHandler);
            document.body.style.overflow = '';
        }

        render() {
            if (!this.state.visible) {
                return '<div class="tm-drawer-anchor" style="display:none"></div>';
            }
            
            const { title, position, size, closable, footer } = this.props;
            
            const isHorizontal = position === 'left' || position === 'right';
            const sizeStyle = isHorizontal ? `width: ${size}` : `height: ${size}`;

            return html`
                <div class="tm-overlay tm-component" @click="handleOverlayClick">
                    <div class="tm-drawer tm-drawer--${position}" style="${sizeStyle}">
                        <div class="tm-drawer__header">
                            <h3 class="tm-drawer__title">${title}</h3>
                            ${closable ? `
                                <button class="tm-btn tm-btn--ghost tm-btn--icon" @click="handleClose">✕</button>
                            ` : ''}
                        </div>
                        <div class="tm-drawer__body" ref="body">
                            <!-- Content -->
                        </div>
                        ${footer ? '<div class="tm-drawer__footer" ref="footer"></div>' : ''}
                    </div>
                </div>
            `;
        }

        open() {
            this.state.visible = true;
            document.body.style.overflow = 'hidden';
            this.emit('open');
        }

        close() {
            this.state.visible = false;
            document.body.style.overflow = '';
            this.props.onClose?.();
            this.emit('close');
        }

        setContent(content) {
            requestAnimationFrame(() => {
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
            });
        }

        handleOverlayClick(e) {
            if (this.props.closeOnOverlay && e.target.classList.contains('tm-overlay')) {
                this.close();
            }
        }

        handleClose() {
            this.close();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP
    // ═══════════════════════════════════════════════════════════════
    
    class Tooltip extends Component {
        static defaultProps = {
            text: '',
            position: 'top',  // top, bottom, left, right
            trigger: 'hover', // hover, click, manual
            delay: 200
        };

        initialState() {
            return { visible: false };
        }

        render() {
            const { text, position } = this.props;
            
            return html`
                <div class="tm-tooltip-wrapper tm-component" ref="wrapper">
                    <div class="tm-tooltip-trigger" ref="trigger">
                        <slot></slot>
                    </div>
                    ${this.state.visible ? `
                        <div class="tm-tooltip tm-tooltip--${position}" ref="tooltip">
                            <div class="tm-tooltip__content">${text}</div>
                            <div class="tm-tooltip__arrow"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        onMount() {
            const { trigger, delay } = this.props;
            
            if (trigger === 'hover') {
                this.refs.wrapper?.addEventListener('mouseenter', () => {
                    this._timeout = setTimeout(() => this.show(), delay);
                });
                this.refs.wrapper?.addEventListener('mouseleave', () => {
                    clearTimeout(this._timeout);
                    this.hide();
                });
            } else if (trigger === 'click') {
                this.refs.wrapper?.addEventListener('click', () => this.toggle());
            }
        }

        show() { this.state.visible = true; }
        hide() { this.state.visible = false; }
        toggle() { this.state.visible = !this.state.visible; }
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTEXT MENU
    // ═══════════════════════════════════════════════════════════════
    
    class ContextMenu extends Component {
        static defaultProps = {
            items: [],  // [{ label, icon?, action?, divider?, disabled?, children? }]
            onSelect: null
        };

        initialState() {
            return { 
                visible: false,
                x: 0,
                y: 0
            };
        }

        render() {
            if (!this.state.visible) {
                return '<div class="tm-context-anchor" style="display:none"></div>';
            }
            
            const { items } = this.props;
            const { x, y } = this.state;

            return html`
                <div class="tm-context-overlay" @click="close" @contextmenu="preventContext">
                    <div class="tm-context-menu tm-component" style="left: ${x}px; top: ${y}px;">
                        ${items.map((item, i) => this.renderItem(item, i)).join('')}
                    </div>
                </div>
            `;
        }

        renderItem(item, index) {
            if (item.divider) {
                return '<div class="tm-context-menu__divider"></div>';
            }
            
            const disabled = item.disabled ? 'tm-context-menu__item--disabled' : '';
            
            return html`
                <div class="tm-context-menu__item ${disabled}" data-index="${index}" @click="handleItemClick">
                    ${item.icon ? `<span class="tm-context-menu__icon">${item.icon}</span>` : ''}
                    <span class="tm-context-menu__label">${item.label}</span>
                    ${item.shortcut ? `<span class="tm-context-menu__shortcut">${item.shortcut}</span>` : ''}
                </div>
            `;
        }

        show(x, y) {
            // Adjust position to stay within viewport
            const padding = 10;
            const menuWidth = 200;  // Approximate
            const menuHeight = this.props.items.length * 36;
            
            if (x + menuWidth > globalThis.innerWidth - padding) {
                x = globalThis.innerWidth - menuWidth - padding;
            }
            if (y + menuHeight > globalThis.innerHeight - padding) {
                y = globalThis.innerHeight - menuHeight - padding;
            }
            
            this.state.x = Math.max(padding, x);
            this.state.y = Math.max(padding, y);
            this.state.visible = true;
        }

        close() {
            this.state.visible = false;
        }

        handleItemClick(e) {
            const index = parseInt(e.currentTarget.dataset.index);
            const item = this.props.items[index];
            
            if (item?.disabled) return;
            
            item?.action?.();
            this.props.onSelect?.(item, index);
            this.emit('select', { item, index });
            this.close();
        }

        preventContext(e) {
            e.preventDefault();
        }
    }

    /**
     * Attach context menu to element
     * @param {HTMLElement} element
     * @param {Array} items
     * @returns {ContextMenu}
     */
    ContextMenu.attach = function(element, items, onSelect) {
        const menu = new ContextMenu({ items, onSelect });
        menu.mount(document.body);
        
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            menu.show(e.clientX, e.clientY);
        });
        
        return menu;
    };

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Modal = Modal;
    TM.Drawer = Drawer;
    TM.Tooltip = Tooltip;
    TM.ContextMenu = ContextMenu;

})();