/**
 * TM Framework - Form Components
 * Button, Input, Textarea, Select, Checkbox, Switch
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames } = TM;

    // ═══════════════════════════════════════════════════════════════
    // BUTTON
    // ═══════════════════════════════════════════════════════════════
    
    class Button extends Component {
        static defaultProps = {
            text: '',
            variant: 'primary',  // primary, secondary, success, danger, warning, ghost
            size: 'md',          // sm, md, lg
            icon: null,
            iconPosition: 'left',
            disabled: false,
            loading: false,
            block: false,
            type: 'button',
            onClick: null
        };

        render() {
            const { text, variant, size, icon, iconPosition, disabled, loading, block, type } = this.props;
            
            const classes = classNames(
                'tm-btn', 'tm-component',
                `tm-btn--${variant}`,
                size !== 'md' && `tm-btn--${size}`,
                block && 'tm-btn--block',
                !text && icon && 'tm-btn--icon'
            );

            const iconHtml = icon ? `<span class="tm-btn__icon">${icon}</span>` : '';
            const spinner = '<span class="tm-spinner tm-spinner--sm"></span>';
            
            return html`
                <button 
                    class="${classes}" 
                    type="${type}" 
                    ${disabled || loading ? 'disabled' : ''} 
                    @click="handleClick"
                >
                    ${loading ? spinner : (iconPosition === 'left' ? iconHtml : '')}
                    ${text ? `<span class="tm-btn__text">${text}</span>` : ''}
                    ${!loading && iconPosition === 'right' ? iconHtml : ''}
                </button>
            `;
        }

        handleClick(e) {
            if (this.props.loading || this.props.disabled) return;
            this.props.onClick?.(e);
            this.emit('click', { originalEvent: e });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INPUT
    // ═══════════════════════════════════════════════════════════════
    
    class Input extends Component {
        static defaultProps = {
            type: 'text',
            value: '',
            placeholder: '',
            label: null,
            helper: null,
            error: null,
            disabled: false,
            readonly: false,
            required: false,
            size: 'md',
            prefix: null,
            suffix: null,
            onInput: null,
            onChange: null,
            onFocus: null,
            onBlur: null
        };

        initialState() {
            return { 
                value: this.props.value,
                focused: false
            };
        }

        render() {
            const { type, placeholder, label, helper, error, disabled, readonly, required, size, prefix, suffix } = this.props;
            const { focused } = this.state;
            
            const wrapperClasses = classNames(
                'tm-input-wrapper',
                focused && 'tm-input-wrapper--focused',
                error && 'tm-input-wrapper--error',
                disabled && 'tm-input-wrapper--disabled'
            );
            
            const inputClasses = classNames(
                'tm-input',
                size !== 'md' && `tm-input--${size}`,
                error && 'tm-input--error'
            );

            return html`
                <div class="tm-form-group tm-component">
                    ${label ? `<label class="tm-label">${label}${required ? ' <span class="tm-required">*</span>' : ''}</label>` : ''}
                    <div class="${wrapperClasses}">
                        ${prefix ? `<span class="tm-input__prefix">${prefix}</span>` : ''}
                        <input 
                            ref="input"
                            class="${inputClasses}"
                            type="${type}"
                            value="${this.state.value}"
                            placeholder="${placeholder}"
                            ${disabled ? 'disabled' : ''}
                            ${readonly ? 'readonly' : ''}
                            ${required ? 'required' : ''}
                            @input="handleInput"
                            @change="handleChange"
                            @focus="handleFocus"
                            @blur="handleBlur"
                        />
                        ${suffix ? `<span class="tm-input__suffix">${suffix}</span>` : ''}
                    </div>
                    ${error ? `<span class="tm-error">${error}</span>` : ''}
                    ${helper && !error ? `<span class="tm-helper">${helper}</span>` : ''}
                </div>
            `;
        }

        handleInput(e) {
            this.state.value = e.target.value;
            this.props.onInput?.(e.target.value, e);
            this.emit('input', { value: e.target.value });
        }

        handleChange(e) {
            this.props.onChange?.(e.target.value, e);
            this.emit('change', { value: e.target.value });
        }

        handleFocus(e) {
            this.state.focused = true;
            this.props.onFocus?.(e);
        }

        handleBlur(e) {
            this.state.focused = false;
            this.props.onBlur?.(e);
        }

        // Public API
        getValue() { return this.state.value; }
        setValue(val) { this.state.value = val; }
        focus() { this.refs.input?.focus(); }
        blur() { this.refs.input?.blur(); }
        clear() { this.state.value = ''; }
    }

    // ═══════════════════════════════════════════════════════════════
    // TEXTAREA
    // ═══════════════════════════════════════════════════════════════
    
    class Textarea extends Component {
        static defaultProps = {
            value: '',
            placeholder: '',
            label: null,
            helper: null,
            error: null,
            disabled: false,
            rows: 4,
            maxLength: null,
            autoResize: false,
            onInput: null
        };

        initialState() {
            return { value: this.props.value };
        }

        render() {
            const { placeholder, label, helper, error, disabled, rows, maxLength, autoResize } = this.props;
            const charCount = maxLength ? `${this.state.value.length}/${maxLength}` : '';
            
            return html`
                <div class="tm-form-group tm-component">
                    ${label ? `<label class="tm-label">${label}</label>` : ''}
                    <textarea 
                        ref="textarea"
                        class="tm-input tm-textarea ${error ? 'tm-input--error' : ''}"
                        placeholder="${placeholder}"
                        rows="${rows}"
                        ${disabled ? 'disabled' : ''}
                        ${maxLength ? `maxlength="${maxLength}"` : ''}
                        @input="handleInput"
                    >${this.state.value}</textarea>
                    <div class="tm-textarea__footer">
                        ${error ? `<span class="tm-error">${error}</span>` : ''}
                        ${helper && !error ? `<span class="tm-helper">${helper}</span>` : ''}
                        ${maxLength ? `<span class="tm-helper tm-textarea__count">${charCount}</span>` : ''}
                    </div>
                </div>
            `;
        }

        handleInput(e) {
            this.state.value = e.target.value;
            
            if (this.props.autoResize) {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
            }
            
            this.props.onInput?.(e.target.value, e);
            this.emit('input', { value: e.target.value });
        }

        getValue() { return this.state.value; }
        setValue(val) { this.state.value = val; }
        focus() { this.refs.textarea?.focus(); }
    }

    // ═══════════════════════════════════════════════════════════════
    // SELECT
    // ═══════════════════════════════════════════════════════════════
    
    class Select extends Component {
        static defaultProps = {
            value: '',
            options: [],  // [{ value, label, disabled }] or ['string']
            label: null,
            placeholder: 'Seleccionar...',
            helper: null,
            error: null,
            disabled: false,
            required: false,
            searchable: false,
            onChange: null
        };

        initialState() {
            return { 
                value: this.props.value,
                open: false,
                search: ''
            };
        }

        render() {
            const { options, label, placeholder, helper, error, disabled, required } = this.props;
            
            const normalizedOptions = options.map(opt => 
                typeof opt === 'object' ? opt : { value: opt, label: opt }
            );
            
            const optionsHtml = normalizedOptions.map(opt => {
                const selected = opt.value === this.state.value ? 'selected' : '';
                const optDisabled = opt.disabled ? 'disabled' : '';
                return `<option value="${opt.value}" ${selected} ${optDisabled}>${opt.label}</option>`;
            }).join('');

            return html`
                <div class="tm-form-group tm-component">
                    ${label ? `<label class="tm-label">${label}${required ? ' <span class="tm-required">*</span>' : ''}</label>` : ''}
                    <select 
                        ref="select"
                        class="tm-input tm-select ${error ? 'tm-input--error' : ''}"
                        ${disabled ? 'disabled' : ''}
                        ${required ? 'required' : ''}
                        @change="handleChange"
                    >
                        <option value="" disabled ${!this.state.value ? 'selected' : ''}>${placeholder}</option>
                        ${optionsHtml}
                    </select>
                    ${error ? `<span class="tm-error">${error}</span>` : ''}
                    ${helper && !error ? `<span class="tm-helper">${helper}</span>` : ''}
                </div>
            `;
        }

        handleChange(e) {
            this.state.value = e.target.value;
            this.props.onChange?.(e.target.value, e);
            this.emit('change', { value: e.target.value });
        }

        getValue() { return this.state.value; }
        setValue(val) { this.state.value = val; }
    }

    // ═══════════════════════════════════════════════════════════════
    // CHECKBOX
    // ═══════════════════════════════════════════════════════════════
    
    class Checkbox extends Component {
        static defaultProps = {
            checked: false,
            label: '',
            disabled: false,
            indeterminate: false,
            onChange: null
        };

        initialState() {
            return { checked: this.props.checked };
        }

        render() {
            const { label, disabled, indeterminate } = this.props;
            
            return html`
                <label class="tm-checkbox tm-component ${disabled ? 'tm-checkbox--disabled' : ''}">
                    <input 
                        ref="checkbox"
                        type="checkbox"
                        class="tm-checkbox__input"
                        ${this.state.checked ? 'checked' : ''}
                        ${disabled ? 'disabled' : ''}
                        @change="handleChange"
                    />
                    <span class="tm-checkbox__box ${indeterminate ? 'tm-checkbox__box--indeterminate' : ''}"></span>
                    ${label ? `<span class="tm-checkbox__label">${label}</span>` : ''}
                </label>
            `;
        }

        handleChange(e) {
            this.state.checked = e.target.checked;
            this.props.onChange?.(e.target.checked, e);
            this.emit('change', { checked: e.target.checked });
        }

        isChecked() { return this.state.checked; }
        setChecked(val) { this.state.checked = val; }
        toggle() { this.state.checked = !this.state.checked; }
    }

    // ═══════════════════════════════════════════════════════════════
    // SWITCH (Toggle)
    // ═══════════════════════════════════════════════════════════════
    
    class Switch extends Component {
        static defaultProps = {
            checked: false,
            label: '',
            labelPosition: 'right',  // left, right
            disabled: false,
            size: 'md',
            onChange: null
        };

        initialState() {
            return { checked: this.props.checked };
        }

        render() {
            const { label, labelPosition, disabled, size } = this.props;
            
            const labelHtml = label ? `<span class="tm-switch__label">${label}</span>` : '';
            
            return html`
                <label class="tm-switch tm-component tm-switch--${size} ${disabled ? 'tm-switch--disabled' : ''}">
                    ${labelPosition === 'left' ? labelHtml : ''}
                    <input 
                        ref="switch"
                        type="checkbox"
                        class="tm-switch__input"
                        ${this.state.checked ? 'checked' : ''}
                        ${disabled ? 'disabled' : ''}
                        @change="handleChange"
                    />
                    <span class="tm-switch__track">
                        <span class="tm-switch__thumb"></span>
                    </span>
                    ${labelPosition === 'right' ? labelHtml : ''}
                </label>
            `;
        }

        handleChange(e) {
            this.state.checked = e.target.checked;
            this.props.onChange?.(e.target.checked, e);
            this.emit('change', { checked: e.target.checked });
        }

        isChecked() { return this.state.checked; }
        setChecked(val) { this.state.checked = val; }
        toggle() { this.state.checked = !this.state.checked; }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Button = Button;
    TM.Input = Input;
    TM.Textarea = Textarea;
    TM.Select = Select;
    TM.Checkbox = Checkbox;
    TM.Switch = Switch;

})();