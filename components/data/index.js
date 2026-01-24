/**
 * TM Framework - Data Components
 * Tag, Badge, List, Table
 */

(function() {
    'use strict';
    
    const { Component } = TM;
    const { html, classNames, uid } = TM;

    // ═══════════════════════════════════════════════════════════════
    // TAG / CHIP
    // ═══════════════════════════════════════════════════════════════
    
    class Tag extends Component {
        static defaultProps = {
            text: '',
            variant: 'default',  // default, primary, success, danger, warning, info
            color: null,         // Custom color (overrides variant)
            size: 'md',          // sm, md, lg
            rounded: false,      // Fully rounded (pill)
            outline: false,      // Outline style
            removable: false,
            clickable: false,
            icon: null,
            onClick: null,
            onRemove: null
        };

        render() {
            const { text, variant, color, size, rounded, outline, removable, clickable, icon } = this.props;
            
            const classes = classNames(
                'tm-tag', 'tm-component',
                `tm-tag--${variant}`,
                `tm-tag--${size}`,
                rounded && 'tm-tag--rounded',
                outline && 'tm-tag--outline',
                clickable && 'tm-tag--clickable'
            );
            
            let style = '';
            if (color) {
                style = outline
                    ? `border-color: ${color}; color: ${color};`
                    : `background-color: ${color}; color: white;`;
            }

            return html`
                <span class="${classes}" style="${style}" @click="handleClick">
                    ${icon ? `<span class="tm-tag__icon">${icon}</span>` : ''}
                    <span class="tm-tag__text">${text}</span>
                    ${removable ? `
                        <button class="tm-tag__remove" @click="handleRemove" aria-label="Eliminar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    ` : ''}
                </span>
            `;
        }

        handleClick(e) {
            if (e.target.closest('.tm-tag__remove')) return;
            if (!this.props.clickable) return;
            
            this.props.onClick?.(e);
            this.emit('click');
        }

        handleRemove(e) {
            e.stopPropagation();
            this.props.onRemove?.(e);
            this.emit('remove');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BADGE
    // ═══════════════════════════════════════════════════════════════
    
    class Badge extends Component {
        static defaultProps = {
            value: 0,
            max: 99,
            variant: 'danger',  // primary, success, danger, warning
            dot: false,         // Show dot instead of number
            show: true,
            offset: [0, 0]      // [x, y] offset
        };

        render() {
            const { value, max, variant, dot, show, offset } = this.props;
            
            if (!show || (!dot && value <= 0)) {
                return '<span class="tm-badge-wrapper tm-component"><slot></slot></span>';
            }
            
            const displayValue = value > max ? `${max}+` : value;
            const offsetStyle = `transform: translate(${offset[0]}px, ${offset[1]}px);`;

            return html`
                <span class="tm-badge-wrapper tm-component">
                    <slot></slot>
                    <span class="tm-badge tm-badge--${variant} ${dot ? 'tm-badge--dot' : ''}" style="${offsetStyle}">
                        ${dot ? '' : displayValue}
                    </span>
                </span>
            `;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // LIST
    // ═══════════════════════════════════════════════════════════════
    
    class List extends Component {
        static defaultProps = {
            items: [],          // [{ id, title, subtitle?, icon?, extra?, disabled?, data? }]
            selectable: false,
            selected: null,     // Selected item id(s)
            multiple: false,    // Allow multiple selection
            hoverable: true,
            divided: true,
            size: 'md',
            emptyText: 'Sin elementos',
            onSelect: null,
            onItemClick: null
        };

        initialState() {
            const { selected, multiple } = this.props;
            return {
                selected: multiple 
                    ? (Array.isArray(selected) ? selected : [])
                    : selected
            };
        }

        render() {
            const { items, selectable, multiple, hoverable, divided, size, emptyText } = this.props;
            
            if (!items.length) {
                return html`
                    <div class="tm-list tm-list--empty tm-component">
                        <span class="tm-list__empty">${emptyText}</span>
                    </div>
                `;
            }
            
            const classes = classNames(
                'tm-list', 'tm-component',
                `tm-list--${size}`,
                divided && 'tm-list--divided',
                hoverable && 'tm-list--hoverable',
                selectable && 'tm-list--selectable'
            );

            return html`
                <div class="${classes}" role="${selectable ? 'listbox' : 'list'}">
                    ${items.map(item => this.renderItem(item)).join('')}
                </div>
            `;
        }

        renderItem(item) {
            const { selectable, multiple } = this.props;
            const isSelected = this.isSelected(item.id);
            
            const classes = classNames(
                'tm-list__item',
                isSelected && 'tm-list__item--selected',
                item.disabled && 'tm-list__item--disabled'
            );

            return html`
                <div class="${classes}" 
                     data-id="${item.id}"
                     role="${selectable ? 'option' : 'listitem'}"
                     aria-selected="${isSelected}"
                     @click="handleItemClick">
                    ${item.icon ? `<span class="tm-list__icon">${item.icon}</span>` : ''}
                    ${selectable && multiple ? `
                        <span class="tm-list__checkbox">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} ${item.disabled ? 'disabled' : ''} />
                        </span>
                    ` : ''}
                    <div class="tm-list__content">
                        <div class="tm-list__title">${item.title}</div>
                        ${item.subtitle ? `<div class="tm-list__subtitle">${item.subtitle}</div>` : ''}
                    </div>
                    ${item.extra ? `<span class="tm-list__extra">${item.extra}</span>` : ''}
                </div>
            `;
        }

        isSelected(id) {
            const { multiple } = this.props;
            return multiple 
                ? this.state.selected.includes(id)
                : this.state.selected === id;
        }

        handleItemClick(e) {
            const id = e.currentTarget.dataset.id;
            const item = this.props.items.find(i => String(i.id) === id);
            
            if (!item || item.disabled) return;
            
            this.props.onItemClick?.(item, e);
            this.emit('item-click', { item });
            
            if (this.props.selectable) {
                this.selectItem(item);
            }
        }

        selectItem(item) {
            const { multiple } = this.props;
            
            if (multiple) {
                const idx = this.state.selected.indexOf(item.id);
                if (idx === -1) {
                    this.state.selected = [...this.state.selected, item.id];
                } else {
                    this.state.selected = this.state.selected.filter(id => id !== item.id);
                }
            } else {
                this.state.selected = this.state.selected === item.id ? null : item.id;
            }
            
            this.props.onSelect?.(this.state.selected, item);
            this.emit('select', { selected: this.state.selected, item });
        }

        getSelected() {
            return this.state.selected;
        }

        setSelected(selected) {
            this.state.selected = selected;
        }

        clearSelection() {
            this.state.selected = this.props.multiple ? [] : null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SIMPLE TABLE
    // ═══════════════════════════════════════════════════════════════
    
    class Table extends Component {
        static defaultProps = {
            columns: [],  // [{ key, title, width?, align?, render? }]
            data: [],     // [{ ...row data }]
            rowKey: 'id',
            striped: false,
            bordered: false,
            hoverable: true,
            compact: false,
            emptyText: 'Sin datos',
            onRowClick: null
        };

        render() {
            const { columns, data, striped, bordered, hoverable, compact, emptyText } = this.props;
            
            const classes = classNames(
                'tm-table-wrapper', 'tm-component',
                striped && 'tm-table--striped',
                bordered && 'tm-table--bordered',
                hoverable && 'tm-table--hoverable',
                compact && 'tm-table--compact'
            );

            return html`
                <div class="${classes}">
                    <table class="tm-table">
                        <thead>
                            <tr>
                                ${columns.map(col => `
                                    <th style="${col.width ? `width: ${col.width};` : ''} ${col.align ? `text-align: ${col.align};` : ''}">
                                        ${col.title}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.length ? data.map((row, idx) => this.renderRow(row, idx)).join('') : `
                                <tr class="tm-table__empty-row">
                                    <td colspan="${columns.length}">
                                        <span class="tm-table__empty">${emptyText}</span>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            `;
        }

        renderRow(row, index) {
            const { columns, rowKey } = this.props;
            const key = row[rowKey] ?? index;
            
            return html`
                <tr data-row-key="${key}" @click="handleRowClick">
                    ${columns.map(col => {
                        const value = row[col.key];
                        const content = col.render ? col.render(value, row, index) : (value ?? '');
                        const align = col.align ? `text-align: ${col.align};` : '';
                        return `<td style="${align}">${content}</td>`;
                    }).join('')}
                </tr>
            `;
        }

        handleRowClick(e) {
            const key = e.currentTarget.dataset.rowKey;
            const row = this.props.data.find((r, i) => String(r[this.props.rowKey] ?? i) === key);
            
            if (row) {
                this.props.onRowClick?.(row, e);
                this.emit('row-click', { row });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════
    
    TM.Tag = Tag;
    TM.Badge = Badge;
    TM.List = List;
    TM.Table = Table;

})();