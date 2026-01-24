/**
 * TM Framework Label Editor Integration Tests
 * Specific tests for label editor issue where groups disappear during updates
 */

class LabelEditorTestSuite {
    constructor() {
        this.tests = [];
        this.results = { passed: 0, failed: 0, total: 0 };
    }
    
    test(name, testFn) {
        if (typeof testFn !== 'function') {
            console.error('Test function is not a function for:', name);
            return;
        }
        this.tests.push({ name, fn: testFn });
    }
    
    async runAll() {
        console.log('🏷️ Running Label Editor Integration Tests...');
        
        for (const test of this.tests) {
            try {
                // Create test context with assertion methods
                const testContext = {
                    assert: (condition, message) => {
                        if (!condition) {
                            throw new Error(message || 'Assertion failed');
                        }
                    },
                    assertEqual: (actual, expected, message) => {
                        if (actual !== expected) {
                            throw new Error(message || `Expected ${expected}, got ${actual}`);
                        }
                    },
                    assertNotEqual: (actual, expected, message) => {
                        if (actual === expected) {
                            throw new Error(message || `Expected not ${expected}, got ${actual}`);
                        }
                    },
                    async delay: (ms) => {
                        return new Promise(resolve => setTimeout(resolve, ms));
                    }
                };
                
                await test.fn(testContext);
                console.log(`   ✅ ${test.name}`);
                this.results.passed++;
            } catch (error) {
                console.log(`   ❌ ${test.name}: ${error.message}`);
                this.results.failed++;
            }
            this.results.total++;
        }
        
        return this.results;
    }
    
    // Mock implementations for testing
    createMockConfigPopup() {
        class MockConfigPopup extends TM.Component {
            static defaultProps = {
                groups: {},
                onSave: null,
                onCancel: null
            };

            initialState() {
                return {
                    groups: TM.deepClone(this.props.groups),
                    activeTab: 'visual',
                    projectLabels: [],
                    loadingLabels: true,
                    selectedGroup: null,
                    jsonError: null
                };
            }

            render() {
                const { activeTab, loadingLabels, jsonError } = this.state;
                
                return TM.html`
                    <div class="config-popup">
                        <div class="config-popup__header">
                            <h3>⚙️ Configuración de Grupos</h3>
                        </div>
                        
                        <div class="config-popup__tabs">
                            <button class="config-tab ${activeTab === 'visual' ? 'config-tab--active' : ''}" 
                                    data-tab="visual" @click="switchTab">🎨 Visual</button>
                            <button class="config-tab ${activeTab === 'json' ? 'config-tab--active' : ''}" 
                                    data-tab="json" @click="switchTab">📄 JSON</button>
                        </div>
                        
                        <div class="config-popup__body">
                            <div class="config-tab-content ${activeTab !== 'visual' ? 'hidden' : ''}" ref="visualTab">
                                <div class="config-groups-list" ref="groupsList">
                                    <!-- Groups rendered here -->
                                </div>
                                <button class="tm-btn tm-btn--secondary" @click="addGroup">
                                    ➕ Añadir grupo
                                </button>
                            </div>
                            
                            <div class="config-tab-content ${activeTab !== 'json' ? 'hidden' : ''}" ref="jsonTab">
                                <textarea class="config-json-editor" ref="jsonEditor" 
                                          @input="handleJsonInput">${JSON.stringify(this.state.groups, null, 2)}</textarea>
                                ${jsonError ? `<div class="config-json-error">${jsonError}</div>` : ''}
                            </div>
                        </div>
                        
                        <div class="config-popup__footer">
                            <button class="tm-btn tm-btn--primary" @click="save">💾 Guardar</button>
                            <button class="tm-btn tm-btn--secondary" @click="cancel">❌ Cancelar</button>
                        </div>
                    </div>
                `;
            }

            switchTab(e) {
                const tab = e.target.dataset.tab;
                if (tab === this.state.activeTab) return;
                
                // Sync data between tabs when switching
                if (this.state.activeTab === 'visual' && tab === 'json') {
                    // Sync visual -> JSON
                    this.collectVisualData();
                } else if (this.state.activeTab === 'json' && tab === 'visual') {
                    // Sync JSON -> visual
                    const jsonText = this.refs.jsonEditor?.value;
                    try {
                        const parsed = JSON.parse(jsonText);
                        this.state.groups = parsed;
                        this.state.jsonError = null;
                        this.renderVisualGroups();
                    } catch (e) {
                        this.state.jsonError = `JSON inválido: ${e.message}`;
                        return;
                    }
                }
                
                this.state.activeTab = tab;
            }

            addGroup() {
                const newName = `Grupo ${Object.keys(this.state.groups).length + 1}`;
                this.state.groups[newName] = {
                    color: '#6366f1',
                    exclusive: true,
                    labels: []
                };
                this.renderVisualGroups();
            }

            renderVisualGroups() {
                const container = this.refs.groupsList;
                if (!container) return;
                
                container.innerHTML = '';
                
                Object.entries(this.state.groups).forEach(([groupName, group]) => {
                    const groupEl = document.createElement('div');
                    groupEl.className = 'config-group-item';
                    groupEl.dataset.groupName = groupName;
                    
                    groupEl.innerHTML = `
                        <div class="config-group-header">
                            <input class="config-group-name" value="${groupName}" />
                            <input class="config-group-color" type="color" value="${group.color}" />
                            <label class="config-group-exclusive">
                                <input type="checkbox" ${group.exclusive ? 'checked' : ''} />
                                Exclusivo
                            </label>
                            <button class="config-group-delete">🗑️</button>
                        </div>
                        <div class="config-group-labels">
                            ${group.labels.map(label => `
                                <span class="config-label-chip" data-label="${label}">
                                    ${label} <button class="config-label-remove">×</button>
                                </span>
                            `).join('')}
                        </div>
                    `;
                    
                    container.appendChild(groupEl);
                });
            }

            collectVisualData() {
                const container = this.refs.groupsList;
                if (!container) {
                    console.warn('collectVisualData: container not available');
                    return;
                }
                
                // Don't collect if container is not visible (during tab switching)
                if (container.offsetParent === null) {
                    console.warn('collectVisualData: container not visible, skipping');
                    return;
                }
                
                const newGroups = {};
                let hasValidGroups = false;
                
                container.querySelectorAll('.config-group-item').forEach(groupEl => {
                    const originalName = groupEl.dataset.groupName;
                    const newName = groupEl.querySelector('.config-group-name')?.value.trim() || originalName;
                    const color = groupEl.querySelector('.config-group-color')?.value;
                    const exclusive = groupEl.querySelector('.config-group-exclusive input')?.checked;
                    const labels = Array.from(groupEl.querySelectorAll('.config-label-chip'))
                        .map(chip => chip.dataset.label);
                    
                    if (newName && color) {
                        newGroups[newName] = { color, exclusive, labels };
                        hasValidGroups = true;
                    }
                });
                
                // Only update state if groups actually changed and are valid
                if (hasValidGroups && JSON.stringify(this.state.groups) !== JSON.stringify(newGroups)) {
                    console.log('collectVisualData: updating groups', { old: this.state.groups, new: newGroups });
                    this.state.groups = newGroups;
                } else if (!hasValidGroups) {
                    console.warn('collectVisualData: no valid groups found, skipping update');
                }
            }

            handleJsonInput() {
                const jsonText = this.refs.jsonEditor?.value;
                try {
                    const parsed = JSON.parse(jsonText);
                    this.state.jsonError = null;
                    // Don't update state on every keystroke, just validate
                } catch (e) {
                    this.state.jsonError = `JSON inválido: ${e.message}`;
                }
            }

            save() {
                if (this.state.activeTab === 'visual') {
                    this.collectVisualData();
                }
                this.props.onSave?.(this.state.groups);
            }

            cancel() {
                this.props.onCancel?.();
            }
        }
        
        return MockConfigPopup;
    }
    
    createMockLabelGroup() {
        class MockLabelGroup extends TM.Component {
            static defaultProps = {
                name: 'Test Group',
                labels: [],
                currentLabels: [],
                onChange: null
            };

            initialState() {
                return {
                    labelStates: this.initLabelStates()
                };
            }

            initLabelStates() {
                const states = {};
                const allLabels = [...this.props.labels, ...this.props.currentLabels];
                
                allLabels.forEach(label => {
                    if (!states[label]) {
                        states[label] = { 
                            selected: this.props.currentLabels.includes(label), 
                            toRemove: false 
                        };
                    }
                });
                
                return states;
            }

            render() {
                const { name } = this.props;
                
                return TM.html`
                    <div class="label-group">
                        <h4 class="label-group__name">${name}</h4>
                        <div class="label-group__chips">
                            ${this.props.labels.map(label => `
                                <label-chip 
                                    name="${label}"
                                    selected="${this.state.labelStates[label]?.selected || false}"
                                    to-remove="${this.state.labelStates[label]?.toRemove || false}"
                                    @change="handleLabelChange"
                                ></label-chip>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            handleLabelChange(labelName, newState) {
                // Handle exclusivity logic would go here
                const { exclusive } = this.props; // Assuming this prop exists
                
                if (exclusive && newState.selected) {
                    // Deselect other labels in this group
                    Object.keys(this.state.labelStates).forEach(label => {
                        if (label !== labelName && this.state.labelStates[label].selected) {
                            this.state.labelStates[label] = { selected: false, toRemove: false };
                        }
                    });
                }
                
                this.state.labelStates[labelName] = newState;
                this.notifyChange();
            }

            notifyChange() {
                // Debounce change notifications to prevent excessive updates
                if (this._changeTimeout) {
                    clearTimeout(this._changeTimeout);
                }
                
                this._changeTimeout = setTimeout(() => {
                    const changes = this.getChanges();
                    this.props.onChange?.(this.props.name, changes);
                    this._changeTimeout = null;
                }, 50);
            }

            getChanges() {
                const { currentLabels } = this.props;
                const { labelStates } = this.state;
                
                const toAdd = [];
                const toRemove = [];
                
                Object.entries(labelStates).forEach(([label, state]) => {
                    const wasActive = currentLabels.includes(label);
                    
                    if (state.selected && !wasActive) {
                        toAdd.push(label);
                    } else if (state.toRemove && wasActive) {
                        toRemove.push(label);
                    } else if (!state.selected && !state.toRemove && wasActive) {
                        toRemove.push(label);
                    }
                });
                
                return { toAdd, toRemove };
            }

            onDestroy() {
                if (this._changeTimeout) {
                    clearTimeout(this._changeTimeout);
                    this._changeTimeout = null;
                }
            }
        }
        
        return MockLabelGroup;
    }
}

// Test cases for specific label disappearing issue
const labelTestSuite = new LabelEditorTestSuite();

// Test 1: Config rapid tab switching doesn't lose groups
labelTestSuite.test('Config rapid tab switching preserves groups', async (test) => {
    const MockConfigPopup = test.createMockConfigPopup();
    
    const initialGroups = {
        'Área': { color: '#6366f1', exclusive: true, labels: ['backend', 'frontend'] },
        'Prioridad': { color: '#ef4444', exclusive: true, labels: ['high', 'low'] }
    };
    
    const config = new MockConfigPopup({
        groups: initialGroups,
        onSave: (groups) => {
            console.log('Groups saved:', groups);
        }
    });
    
    config.mount(document.body);
    
    // Simulate rapid tab switching
    const visualTab = config.el.querySelector('[data-tab="visual"]');
    const jsonTab = config.el.querySelector('[data-tab="json"]');
    
    test.assert(visualTab && jsonTab, 'Tab buttons should be available');
    
    // Log initial state
    console.log('📋 Initial groups:', Object.keys(config.state.groups));
    const initialGroupCount = Object.keys(config.state.groups).length;
    
    // Track update count
    let updateCount = 0;
    const originalUpdate = config._update.bind(config);
    config._update = function(...args) {
        updateCount++;
        return originalUpdate(...args);
    };
    
    // Switch tabs rapidly
    for (let i = 0; i < 5; i++) {
        console.log(`🔄 Tab switch ${i + 1}`);
        visualTab.click();
        await test.delay(10);
        jsonTab.click();
        await test.delay(10);
    }
    
    // Wait for debouncing
    await test.delay(200);
    
    console.log(`📊 Total updates during rapid switching: ${updateCount}`);
    console.log('📋 Final groups:', Object.keys(config.state.groups));
    
    // Check that groups are still present
    const finalGroups = config.state.groups;
    const finalGroupCount = Object.keys(finalGroups).length;
    
    test.assertEqual(finalGroupCount, initialGroupCount, `Should still have ${initialGroupCount} groups`);
    test.assert(finalGroups['Área'], 'Área group should exist');
    test.assert(finalGroups['Prioridad'], 'Prioridad group should exist');
    
    // Log result
    console.log(`✅ Test result: ${finalGroupCount}/${initialGroupCount} groups preserved`);
    console.log('🔍 Groups content:', finalGroups);
    
    config.destroy();
});

// Test 2: Visual editing has controlled re-renders
labelTestSuite.test('Visual editing has controlled re-renders', async (test) => {
    const MockConfigPopup = test.createMockConfigPopup();
    
    const initialGroups = {
        'Test': { color: '#6366f1', exclusive: true, labels: ['label1', 'label2'] }
    };
    
    let updateCount = 0;
    
    const config = new MockConfigPopup({
        groups: initialGroups
    });
    
    // Override update method to count updates
    const originalUpdate = config._update.bind(config);
    config._update = function(...args) {
        updateCount++;
        return originalUpdate(...args);
    };
    
    config.mount(document.body);
    config.renderVisualGroups();
    
    const initialUpdateCount = updateCount;
    
    // Simulate rapid visual edits
    const container = config.refs.groupsList;
    test.assert(container, 'Groups container should be available');
    
    const nameInput = container.querySelector('.config-group-name');
    test.assert(nameInput, 'Name input should be available');
    
    console.log('📝 Starting rapid visual edits...');
    
    // Type rapidly
    for (let i = 0; i < 10; i++) {
        nameInput.value = 'Test ' + i;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        await test.delay(5);
    }
    
    // Wait for debouncing
    await test.delay(300);
    
    const totalUpdates = updateCount - initialUpdateCount;
    console.log(`📊 Total updates during rapid editing: ${totalUpdates}`);
    
    // Should have minimal updates due to debouncing
    test.assert(totalUpdates <= 5, `Should have minimal updates due to debouncing, got ${totalUpdates}`);
    
    config.destroy();
});

// Test 3: State changes are logged for debugging
labelTestSuite.test('State changes are logged for debugging', async (test) => {
    const MockConfigPopup = test.createMockConfigPopup();
    
    const initialGroups = {
        'Test': { color: '#6366f1', exclusive: true, labels: [] }
    };
    
    const config = new MockConfigPopup({
        groups: initialGroups
    });
    
    // Enable debug mode
    config._debugMode = true;
    
    config.mount(document.body);
    
    // Trigger state changes
    config.state.activeTab = 'json';
    config.state.groups['New Group'] = { color: '#ff0000', exclusive: false, labels: [] };
    
    // Wait for processing
    await test.delay(100);
    
    const debugInfo = config.getDebugInfo();
    
    test.assert(debugInfo.componentId, 'Should have debug info');
    test.assert(debugInfo.stateChangeHistory.length > 0, 'Should log state changes');
    test.assert(debugInfo.updateHistory.length > 0, 'Should log updates');
    
    // Check for specific state changes
    const activeTabChange = debugInfo.stateChangeHistory.find(c => c.property === 'activeTab');
    test.assert(activeTabChange, 'Should log activeTab change');
    test.assertEqual(activeTabChange.newValue, 'json', 'Should log correct new value');
    
    config.destroy();
});

// Test 4: Label group changes are properly debounced
labelTestSuite.test('Label group changes are properly debounced', async (test) => {
    const MockLabelGroup = test.createMockLabelGroup();
    
    let changeCount = 0;
    const lastChanges = [];
    
    const labelGroup = new MockLabelGroup({
        name: 'Test Group',
        labels: ['label1', 'label2', 'label3'],
        currentLabels: [],
        onChange: (groupName, changes) => {
            changeCount++;
            lastChanges.push(changes);
        }
    });
    
    labelGroup.mount(document.body);
    
    // Trigger rapid label changes
    for (let i = 0; i < 10; i++) {
        labelGroup.handleLabelChange('label1', { selected: i % 2 === 0, toRemove: false });
        await test.delay(10);
    }
    
    // Wait for debouncing
    await test.delay(200);
    
    console.log(`Change notifications sent: ${changeCount}`);
    
    // Should have reduced number of change notifications due to debouncing
    test.assert(changeCount <= 3, `Should have debounced change notifications, got ${changeCount}`);
    
    labelGroup.destroy();
});

// Export for running
window.LabelEditorTestSuite = LabelEditorTestSuite;

// Initialize suite only when TM is available
function initializeLabelTestSuite() {
    if (typeof TM !== 'undefined' && TM.Component && !window.labelTestSuite) {
        window.labelTestSuite = labelTestSuite;
        console.log('✅ Label Editor Test Suite initialized with', labelTestSuite.tests.length, 'tests');
    }
}

// Initialize immediately if available, otherwise wait
initializeLabelTestSuite();
if (typeof window !== 'undefined') {
    setTimeout(initializeLabelTestSuite, 100);
}

// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.location.pathname.includes('label-editor-tests')) {
    setTimeout(() => {
        if (window.labelTestSuite) {
            window.labelTestSuite.runAll();
        }
    }, 1000);
}