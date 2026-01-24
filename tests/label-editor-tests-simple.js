/**
 * TM Framework Label Editor Integration Tests - Simplified Version
 * Tests specific to label editor issue where groups disappear during updates
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
}

// Test 1: Verify TM Framework is loaded
LabelEditorTestSuite.prototype.testFrameworkLoaded = async function(test) {
    test.assert(typeof TM !== 'undefined', 'TM Framework should be loaded');
    test.assert(TM.version, 'TM version should be available');
    test.assert(TM.Component, 'TM.Component should be available');
    test.assert(TM.reactive, 'TM.reactive should be available');
    test.assert(TM.debug, 'TM.debug should be available');
    console.log('🔍 Framework version:', TM.version);
};

// Test 2: Test component creation and basic lifecycle
LabelEditorTestSuite.prototype.testComponentCreation = async function(test) {
    class SimpleComponent extends TM.Component {
        static defaultProps = { name: 'test' };
        
        initialState() {
            return { count: 0 };
        }
        
        render() {
            return `<div>Count: ${this.state.count}</div>`;
        }
        
        handleClick() {
            this.state.count++;
        }
        
        onUpdate() {
            console.log('Component updated');
        }
    }
    
    const component = new SimpleComponent({ name: 'TestComponent' });
    
    test.assert(component.props.name === 'test', 'Default props should be set');
    test.assert(component.state.count === 0, 'Initial state should be set');
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    component.mount(container);
    
    test.assert(component._mounted, 'Component should be mounted');
    test.assert(component.el, 'Component should have element');
    
    // Test state change
    const initialText = component.el.textContent;
    component.state.count = 5;
    
    await test.delay(200);
    
    test.assertNotEqual(component.el.textContent, initialText, 'State change should trigger re-render');
    
    component.destroy();
    
    test.assert(!component._mounted, 'Component should be unmounted');
    
    container.remove();
};

// Test 3: Test rapid state changes and debouncing
LabelEditorTestSuite.prototype.testStateDebouncing = async function(test) {
    let updateCount = 0;
    
    class TestComponent extends TM.Component {
        static defaultProps = { name: 'DebounceTest' };
        
        initialState() {
            return { value: 0 };
        }
        
        render() {
            return `<div>Value: ${this.state.value}</div>`;
        }
        
        onUpdate() {
            console.log('Component updated');
        }
    }
    
    const component = new TestComponent();
    
    // Override update method to track calls
    const originalUpdate = component._update.bind(component);
    component._update = function(...args) {
        updateCount++;
        return originalUpdate(...args);
    };
    
    component.mount(document.body);
    
    const initialCount = updateCount;
    
    // Make rapid state changes
    for (let i = 0; i < 10; i++) {
        component.state.value = i;
    }
    
    await test.delay(300); // Wait for debouncing
    
    const totalUpdates = updateCount - initialCount;
    console.log(`Total updates during rapid changes: ${totalUpdates}`);
    
    // Should have minimal updates due to debouncing
    test.assert(totalUpdates <= 3, `Should have debounced updates, got ${totalUpdates}`);
    
    component.destroy();
};

// Test 4: Test logging system functionality
LabelEditorTestSuite.prototype.testLoggingSystem = async function(test) {
    test.assert(typeof TM.debug !== 'undefined', 'Debug system should be available');
    
    // Enable debug mode
    TM.debug.enable();
    test.assert(TM.debug.enabled, 'Debug mode should be enabled');
    
    class TestComponent extends TM.Component {
        initialState() {
            return { value: 'test' };
        }
        
        render() {
            return `<div>Test Component</div>`;
        }
    }
    
    const component = new TestComponent();
    component._debugMode = true;
    component.mount(document.body);
    
    // Trigger some state changes to generate logs
    component.state.value = 'changed';
    
    await test.delay(100);
    
    const debugInfo = component.getDebugInfo();
    
    test.assert(debugInfo.componentId, 'Component should have debug info');
    test.assert(debugInfo.updateHistory, 'Should have update history');
    test.assert(debugInfo.componentLogs, 'Should have component logs');
    
    TM.debug.disable();
    test.assert(!TM.debug.enabled, 'Debug mode should be disabled');
    
    component.destroy();
};

// Test 5: Test specific label editor scenarios
LabelEditorTestSuite.prototype.testLabelEditorScenarios = async function(test) {
    // Simulate the collectVisualData issue
    test.assert(TM.reactive, 'Reactive system should be available');
    
    // Create a mock state object to simulate the issue
    const mockState = TM.reactive({
        groups: {
            'Test Group': { color: '#ff0000', exclusive: true, labels: ['label1', 'label2'] },
            'Another Group': { color: '#00ff00', exclusive: false, labels: [] }
        },
        activeTab: 'visual'
    });
    
    let stateChangeCount = 0;
    
    // Subscribe to state changes
    const unsubscribe = mockState.__subscribe(() => {
        stateChangeCount++;
    });
    
    // Simulate rapid tab switching
    console.log('🔄 Simulating rapid tab switching...');
    
    // This simulates the problematic behavior where state changes rapidly
    for (let i = 0; i < 5; i++) {
        mockState.activeTab = i % 2 === 0 ? 'visual' : 'json';
        await test.delay(10);
    }
    
    await test.delay(200); // Wait for debouncing
    
    console.log(`State change count: ${stateChangeCount}`);
    test.assert(stateChangeCount >= 5, 'Should have detected state changes');
    
    // Check that groups are preserved
    test.assert(mockState.groups['Test Group'], 'Test Group should still exist');
    test.assert(mockState.groups['Another Group'], 'Another Group should still exist');
    
    unsubscribe();
};

// Test 6: Test DOM manipulation performance
LabelEditorTestSuite.prototype.testDOMPerformance = async function(test) {
    class TestComponent extends TM.Component {
        initialState() {
            return { items: [] };
        }
        
        render() {
            return TM.html`
                <div class="test-container">
                    ${this.state.items.map(item => `<div class="test-item">${item}</div>`).join('')}
                </div>
            `;
        }
    }
    
    const component = new TestComponent();
    
    let renderCount = 0;
    
    // Override render to track calls
    const originalRender = component.render.bind(component);
    component.render = function() {
        renderCount++;
        return originalRender();
    };
    
    component.mount(document.body);
    
    const initialRenderCount = renderCount;
    
    // Add many items rapidly to test debouncing
    for (let i = 0; i < 10; i++) {
        component.state.items.push(`item${i}`);
    }
    
    await test.delay(300); // Wait for debouncing
    
    const totalRenders = renderCount - initialRenderCount;
    console.log(`Total renders during rapid updates: ${totalRenders}`);
    
    // Should have minimal renders due to debouncing
    test.assert(totalRenders <= 3, `Should have debounced renders, got ${totalRenders}`);
    
    component.destroy();
};

// Create test suite and add tests
const labelTestSuite = new LabelEditorTestSuite();

// Add all tests
labelTestSuite.test('TM Framework Loaded', labelTestSuite.testFrameworkLoaded);
labelTestSuite.test('Component Creation', labelTestSuite.testComponentCreation);
labelTestSuite.test('State Debouncing', labelTestSuite.testStateDebouncing);
labelTestSuite.test('Logging System', labelTestSuite.testLoggingSystem);
labelTestSuite.test('Label Editor Scenarios', labelTestSuite.testLabelEditorScenarios);
labelTestSuite.test('DOM Performance', labelTestSuite.testDOMPerformance);

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