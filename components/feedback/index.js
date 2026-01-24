/**
 * TM Framework - Feedback Components
 * Toast, Alert, Spinner, Progress, Skeleton
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // TOAST NOTIFICATION SYSTEM
    // ═══════════════════════════════════════════════════════════════
    
    const Toast = {
        container: null,
        queue: [],
        maxVisible: 5,
        
        init() {
            if (this.container) return;
            
            this.container = document.createElement('div');
            this.container.className = 'tm-toast-container';
            this.container.setAttribute('role', 'alert');
            this.container.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.container);
        },
        
        /**
         * Show toast notification
         * @param {string|Object} options - Message string or options object
         * @param {string} type - 'success' | 'error' | 'warning' | 'info'
         * @param {number} duration - Auto-dismiss time in ms (0 = manual)
         * @returns {HTMLElement}
         */
        show(options, type = 'info', duration = 3000) {
            this.init();
            
            // Normalize options
            const config = typeof options === 'string' 
                ? { message: options, type, duration }
                : { type, duration, ...options };
            
            const toast = document.createElement('div');
            toast.className = `tm-toast tm-toast--${config.type}`;
            toast.id = uid('toast');
            
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            
            toast.innerHTML = `
                <span class="tm-toast__icon">${icons[config.type] || icons.info}</span>
                <div class="tm-toast__content">
                    ${config.title ? `<div class="tm-toast__title">${config.title}</div>` : ''}
                    <div class="tm-toast__message">${config.message}</div>
                </div>
                <button class="tm-toast__close" aria-label="Cerrar">✕</button>
                ${config.duration > 0 ? `<div class="tm-toast__progress" style="animation-duration: ${config.duration}ms"></div>` : ''}
            `;
            
            // Close button
            toast.querySelector('.tm-toast__close').addEventListener('click', () => {
                this.dismiss(toast);
            });
            
            // Add to container
            this.container.appendChild(toast);
            
            // Manage max visible
            const toasts = this.container.querySelectorAll('.tm-toast');
            if (toasts.length > this.maxVisible) {
                this.dismiss(toasts[0]);
            }
            
            // Auto dismiss
            if (config.duration > 0) {
                setTimeout(() => this.dismiss(toast), config.duration);
            }
            
            return toast;
        },
        
        dismiss(toast) {
            if (!toast || !toast.parentNode) return;
            
            toast.classList.add('tm-toast--exit');
            setTimeout(() => toast.remove(), 300);
        },
        
        dismissAll() {
            this.container?.querySelectorAll('.tm-toast').forEach(t => this.dismiss(t));
        },
        
        // Shortcuts
        success(message, duration) { 
            return this.show(message, 'success', duration); 
        },
        error(message, duration) { 
            return this.show(message, 'error', duration ?? 5000); 
        },
        warning(message, duration) { 
            return this.show(message, 'warning', duration ?? 4000); 
        },
        info(message, duration) { 
            return this.show(message, 'info', duration); 
        },
        
        // Promise helper
        async promise(promise, messages = {}) {
            const { loading = 'Procesando...', success = '¡Completado!', error = 'Error' } = messages;
            
            const toast = this.show({ message: loading, type: 'info' }, 'info', 0);
            toast.classList.add('tm-toast--loading');
            
            try {
                const result = await promise;
                this.dismiss(toast);
                this.success(typeof success === 'function' ? success(result) : success);
                return result;
            } catch (e) {
                this.dismiss(toast);
                this.error(typeof error === 'function' ? error(e) : error);
                throw e;
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // ALERT (Inline message)
    // ═══════════════════════════════════════════════════════════════
    
    class Alert extends Component {
        static defaultProps = {
            type: 'info',      // success, error, warning, info
            title: '',
            message: '',
            closable: false,
            icon: true,
            onClose: null
        };

        initialState() {
            return { visible: true };
        }

        render() {
            if (!this.state.visible) return '';
            
            const { type, title, message, closable, icon } = this.props;
            
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };

            return html`
                <div class="tm-alert tm-alert--${type} tm-component" role="alert">
                    ${icon ? `<span class="tm-alert__icon">${icons[type]}</span>` : ''}
                    <div class="tm-alert__content">
                        ${title ? `<div class="tm-alert__title">${title}</div>` : ''}
                        <div class="tm-alert__message">${message}</div>
                    </div>
                    ${closable ? `<button class="tm-alert__close" @click="handleClose">✕</button>` : ''}
                </div>
            `;
        }

        handleClose() {
            this.state.visible = false;
            this.props.onClose?.();
            this.emit('close');
        }

        show() { this.state.visible = true; }
        hide() { this.state.visible = false; }
    }

    // ═══════════════════════════════════════════════════════════════
    // SPINNER
    // ═══════════════════════════════════════════════════════════════
    
    class Spinner extends Component {
        static defaultProps = {
            size: 'md',      // sm, md, lg, xl
            color: null,     // Custom color
            text: '',
            overlay: false,  // Full screen overlay
            inline: false
        };

        render() {
            const { size, color, text, overlay, inline } = this.props;
            
            const style = color ? `border-top-color: ${color}; border-right-color: ${color};` : '';
            
            const spinner = html`
                <div class="tm-spinner-wrapper ${inline ? 'tm-spinner-wrapper--inline' : ''} tm-component">
                    <div class="tm-spinner tm-spinner--${size}" style="${style}"></div>
                    ${text ? `<span class="tm-spinner__text">${text}</span>` : ''}
                </div>
            `;
            
            if (overlay) {
                return html`
                    <div class="tm-spinner-overlay tm-component">
                        ${spinner}
                    </div>
                `;
            }
            
            return spinner;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PROGRESS BAR
    // ═══════════════════════════════════════════════════════════════
    
    class Progress extends Component {
        static defaultProps = {
            value: 0,          // 0-100
            max: 100,
            size: 'md',        // sm, md, lg
            color: null,
            showLabel: true,
            striped: false,
            animated: false,
            indeterminate: false
        };

        render() {
            const { value, max, size, color, showLabel, striped, animated, indeterminate } = this.props;
            
            const percentage = Math.min(100, Math.max(0, (value / max) * 100));
            
            const barClasses = classNames(
                'tm-progress__bar',
                striped && 'tm-progress__bar--striped',
                animated && 'tm-progress__bar--animated',
                indeterminate && 'tm-progress__bar--indeterminate'
            );
            
            const style = `width: ${indeterminate ? '100%' : percentage + '%'}; ${color ? `background-color: ${color};` : ''}`;

            return html`
                <div class="tm-progress tm-progress--${size} tm-component" role="progressbar" 
                     aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${max}">
                    <div class="tm-progress__track">
                        <div class="${barClasses}" style="${style}">
                            ${showLabel && !indeterminate ? `<span class="tm-progress__label">${Math.round(percentage)}%</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        setValue(val) {
            this.setProps({ value: val });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SKELETON LOADER
    // ═══════════════════════════════════════════════════════════════
    
    class Skeleton extends Component {
        static defaultProps = {
            variant: 'text',    // text, circle, rect, card
            width: '100%',
            height: null,
            lines: 1,          // For text variant
            animated: true
        };

        render() {
            const { variant, width, height, lines, animated } = this.props;
            
            const baseClass = classNames(
                'tm-skeleton',
                `tm-skeleton--${variant}`,
                animated && 'tm-skeleton--animated'
            );
            
            if (variant === 'text' && lines > 1) {
                return html`
                    <div class="tm-skeleton-group tm-component">
                        ${Array(lines).fill(0).map((_, i) => `
                            <div class="${baseClass}" style="width: ${i === lines - 1 ? '70%' : width}; height: ${height || '1em'};"></div>
                        `).join('')}
                    </div>
                `;
            }
            
            if (variant === 'card') {
                return html`
                    <div class="tm-skeleton-card tm-component">
                        <div class="tm-skeleton tm-skeleton--rect tm-skeleton--animated" style="height: 200px;"></div>
                        <div class="tm-skeleton-card__body">
                            <div class="tm-skeleton tm-skeleton--text tm-skeleton--animated" style="width: 60%;"></div>
                            <div class="tm-skeleton tm-skeleton--text tm-skeleton--animated"></div>
                            <div class="tm-skeleton tm-skeleton--text tm-skeleton--animated" style="width: 80%;"></div>
                        </div>
                    </div>
                `;
            }
            
            const style = `width: ${width}; height: ${height || (variant === 'circle' ? width : '1em')};`;
            
            return html`
                <div class="${baseClass} tm-component" style="${style}"></div>
            `;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EMPTY STATE
    // ═══════════════════════════════════════════════════════════════
    
    class Empty extends Component {
        static defaultProps = {
            icon: '📭',
            title: 'Sin datos',
            description: '',
            action: null,      // { text, onClick }
        };

        render() {
            const { icon, title, description, action } = this.props;
            
            return html`
                <div class="tm-empty tm-component">
                    <div class="tm-empty__icon">${icon}</div>
                    <div class="tm-empty__title">${title}</div>
                    ${description ? `<div class="tm-empty__description">${description}</div>` : ''}
                    ${action ? `
                        <button class="tm-btn tm-btn--primary tm-btn--sm" @click="handleAction">
                            ${action.text}
                        </button>
                    ` : ''}
                </div>
            `;
        }

        handleAction() {
            this.props.action?.onClick?.();
            this.emit('action');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Toast = Toast;
    TM.Alert = Alert;
    TM.Spinner = Spinner;
    TM.Progress = Progress;
    TM.Skeleton = Skeleton;
    TM.Empty = Empty;

})();