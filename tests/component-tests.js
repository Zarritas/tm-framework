/**
 * TM Framework Test Suite
 * Unit tests for component updates, logging, and performance optimizations
 */

class TMTestSuite {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
        
        // Test environment setup
        this.testContainer = null;
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };
        this.capturedLogs = [];
    }
    
    /**
     * Add a test to the suite
     */
    test(name, testFn, options = {}) {
        this.tests.push({
            name,
            fn: testFn,
            timeout: options.timeout || 5000,
            category: options.category || 'general'
        });
    }
    
    /**
     * Run all tests
     */
    async runAll() {
        console.log('🧪 Starting TM Framework Test Suite...');
        console.log('='.repeat(50));
        
        // Setup test environment
        this.setupTestEnvironment();
        
        // Run tests by category
        const categories = {
            'component': 'Component Lifecycle Tests',
            'performance': 'Performance Tests',
            'logging': 'Logging Tests',
            'state': 'State Management Tests',
            'dom': 'DOM Manipulation Tests'
        };
        
        for (const [category, title] of Object.entries(categories)) {
            const categoryTests = this.tests.filter(t => t.category === category);
            if (categoryTests.length > 0) {
                console.log(`\n📋 ${title}`);
                console.log('-'.repeat(title.length));
                
                for (const test of categoryTests) {
                    await this.runSingleTest(test);
                }
            }
        }
        
        // Run remaining tests
        const remainingTests = this.tests.filter(t => !t.category);
        if (remainingTests.length > 0) {
            console.log(`\n📋 General Tests`);
            console.log('-'.repeat('General Tests'.length));
            
            for (const test of remainingTests) {
                await this.runSingleTest(test);
            }
        }
        
        this.teardownTestEnvironment();
        this.printResults();
        
        return this.results;
    }
    
    /**
     * Run a single test
     */
    async runSingleTest(test) {
        this.results.total++;
        this.capturedLogs = [];
        
        console.log(`\n🔍 ${test.name}`);
        
        try {
            const startTime = performance.now();
            
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Test timeout')), test.timeout);
            });
            
            // Run test with timeout
            await Promise.race([
                Promise.resolve(test.fn(this)),
                timeoutPromise
            ]);
            
            const duration = performance.now() - startTime;
            
            console.log(`   ✅ PASSED (${duration.toFixed(2)}ms)`);
            this.results.passed++;
            this.results.details.push({
                name: test.name,
                status: 'passed',
                duration,
                logs: [...this.capturedLogs]
            });
            
        } catch (error) {
            console.log(`   ❌ FAILED: ${error.message}`);
            console.log(`   Stack: ${error.stack}`);
            this.results.failed++;
            this.results.details.push({
                name: test.name,
                status: 'failed',
                error: error.message,
                logs: [...this.capturedLogs]
            });
        }
    }
    
    /**
     * Setup test environment
     */
    setupTestEnvironment() {
        // Create test container
        this.testContainer = document.createElement('div');
        this.testContainer.id = 'tm-test-container';
        this.testContainer.style.cssText = `
            position: absolute;
            top: -10000px;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(this.testContainer);
        
        // Enable debug mode for testing
        window.TM_DEBUG = true;
        
        // Capture console logs
        console.log = (...args) => {
            this.capturedLogs.push({ level: 'log', args });
            this.originalConsole.log(...args);
        };
        
        console.error = (...args) => {
            this.capturedLogs.push({ level: 'error', args });
            this.originalConsole.error(...args);
        };
        
        console.warn = (...args) => {
            this.capturedLogs.push({ level: 'warn', args });
            this.originalConsole.warn(...args);
        };
        
        console.info = (...args) => {
            this.capturedLogs.push({ level: 'info', args });
            this.originalConsole.info(...args);
        };
    }
    
    /**
     * Teardown test environment
     */
    teardownTestEnvironment() {
        // Restore console
        Object.assign(console, this.originalConsole);
        
        // Remove test container
        if (this.testContainer) {
            this.testContainer.remove();
            this.testContainer = null;
        }
        
        // Clean up any remaining components
        Object.keys(window).forEach(key => {
            if (key.startsWith('TestComponent_') && window[key].destroy) {
                window[key].destroy();
            }
        });
    }
    
    /**
     * Print final results
     */
    printResults() {
        console.log('\n' + '='.repeat(50));
        console.log('🏁 TEST RESULTS');
        console.log('='.repeat(50));
        console.log(`Total: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed} ✅`);
        console.log(`Failed: ${this.results.failed} ❌`);
        console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.details
                .filter(d => d.status === 'failed')
                .forEach(d => {
                    console.log(`   - ${d.name}: ${d.error}`);
                });
        }
        
        console.log('\n📊 Performance Summary:');
        const avgDuration = this.results.details
            .reduce((sum, d) => sum + (d.duration || 0), 0) / this.results.total;
        console.log(`   Average test duration: ${avgDuration.toFixed(2)}ms`);
    }
    
    // Test utility methods
    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }
    
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    }
    
    assertNotEqual(actual, expected, message) {
        if (actual === expected) {
            throw new Error(message || `Expected not ${expected}, got ${actual}`);
        }
    }
    
    assertThrows(fn, message) {
        try {
            fn();
            throw new Error(message || 'Expected function to throw');
        } catch (error) {
            // Expected behavior
        }
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    clearTestContainer() {
        this.testContainer.innerHTML = '';
    }
}

// Test cases
const testSuite = new TMTestSuite();

// Component Lifecycle Tests
testSuite.test('Component creation and destruction', (test) => {
    class TestComponent extends TM.Component {
        static defaultProps = { test: 'value' };
        
        initialState() {
            return { count: 0 };
        }
        
        render() {
            return `<div>Test component: ${this.state.count}</div>`;
        }
    }
    
    test.assert(TestComponent, 'Component class should be defined');
    
    const component = new TestComponent();
    test.assert(component, 'Component instance should be created');
    test.assertEqual(component.props.test, 'value', 'Default props should be set');
    test.assertEqual(component.state.count, 0, 'Initial state should be set');
    
    component.mount(test.testContainer);
    test.assert(component._mounted, 'Component should be mounted');
    test.assert(component.el, 'Component should have element');
    
    component.destroy();
    test.assert(!component._mounted, 'Component should be unmounted');
    test.assert(!component.el, 'Component element should be removed');
}, { category: 'component' });

// State Management Tests
testSuite.test('State changes trigger updates', async (test) => {
    let updateCount = 0;
    
    class TestComponent extends TM.Component {
        initialState() {
            return { value: 'initial' };
        }
        
        render() {
            return `<div>${this.state.value}</div>`;
        }
        
        onUpdate() {
            updateCount++;
        }
    }
    
    const component = new TestComponent();
    component.mount(test.testContainer);
    
    const initialUpdateCount = updateCount;
    
    // Change state
    component.state.value = 'changed';
    await test.delay(100); // Wait for debounced update
    
    test.assert(updateCount > initialUpdateCount, 'State change should trigger update');
    test.assertEqual(component.el.textContent, 'changed', 'DOM should reflect state change');
}, { category: 'state' });

// Performance Tests
testSuite.test('Debounced updates prevent excessive renders', async (test) => {
    let renderCount = 0;
    
    class TestComponent extends TM.Component {
        initialState() {
            return { value: 0 };
        }
        
        render() {
            renderCount++;
            return `<div>${this.state.value}</div>`;
        }
    }
    
    const component = new TestComponent();
    component.mount(test.testContainer);
    
    const initialRenderCount = renderCount;
    
    // Rapid state changes
    for (let i = 0; i < 10; i++) {
        component.state.value = i;
    }
    
    await test.delay(200); // Wait for debouncing
    
    // Should have minimal additional renders due to debouncing
    const totalRenders = renderCount - initialRenderCount;
    test.assert(totalRenders <= 3, `Should have minimal renders due to debouncing, got ${totalRenders}`);
}, { category: 'performance' });

// Logging Tests
testSuite.test('Component logging captures updates', async (test) => {
    class TestComponent extends TM.Component {
        initialState() {
            return { value: 'test' };
        }
        
        render() {
            return `<div>${this.state.value}</div>`;
        }
    }
    
    const component = new TestComponent();
    component.mount(test.testContainer);
    
    // Enable debug mode
    component._debugMode = true;
    
    // Trigger state change
    component.state.value = 'changed';
    await test.delay(100);
    
    const debugInfo = component.getDebugInfo();
    test.assert(debugInfo.componentId, 'Component should have debug info');
    test.assert(debugInfo.stateChangeHistory.length > 0, 'Should log state changes');
    test.assert(debugInfo.updateHistory.length > 0, 'Should log updates');
}, { category: 'logging' });

// DOM Manipulation Tests
testSuite.test('DOM diffing prevents unnecessary updates', async (test) => {
    let replacementCount = 0;
    
    class TestComponent extends TM.Component {
        initialState() {
            return { value: 'static' };
        }
        
        render() {
            return `<div class="test-div">${this.state.value}</div>`;
        }
        
        _update(...args) {
            // Override to track replacements
            const oldEl = this._el;
            super._update(...args);
            if (oldEl && this._el && oldEl !== this._el) {
                replacementCount++;
            }
        }
    }
    
    const component = new TestComponent();
    component.mount(test.testContainer);
    
    // State change that doesn't affect render
    component.state.value = 'static'; // Same value
    await test.delay(100);
    
    test.assertEqual(replacementCount, 0, 'Should not replace DOM for identical renders');
    
    // Actual change
    component.state.value = 'different';
    await test.delay(100);
    
    test.assertEqual(replacementCount, 1, 'Should replace DOM for different renders');
}, { category: 'dom' });

// Error Handling Tests
testSuite.test('Component handles render errors gracefully', (test) => {
    class TestComponent extends TM.Component {
        render() {
            throw new Error('Test render error');
        }
    }
    
    const component = new TestComponent();
    
    test.assertThrows(() => {
        component.mount(test.testContainer);
    }, 'Should throw render error');
    
    test.assert(!component._mounted, 'Component should not be mounted after error');
}, { category: 'component' });

// Event Handling Tests
testSuite.test('Event handlers work correctly', (test) => {
    let clicked = false;
    
    class TestComponent extends TM.Component {
        render() {
            return `<button @click="handleClick">Click me</button>`;
        }
        
        handleClick() {
            clicked = true;
        }
    }
    
    const component = new TestComponent();
    component.mount(test.testContainer);
    
    const button = component.el.querySelector('button');
    test.assert(button, 'Button should be in DOM');
    
    button.click();
    test.assert(clicked, 'Click handler should be called');
}, { category: 'component' });

// Memory Leak Tests
testSuite.test('Component cleanup prevents memory leaks', (test) => {
    class TestComponent extends TM.Component {
        render() {
            return `<div>Test</div>`;
        }
    }
    
    const componentId = 'TestComponent_' + Date.now();
    
    // Create component
    const component = new TestComponent();
    component.mount(test.testContainer);
    
    test.assert(window[componentId], 'Component should be registered globally');
    
    // Destroy component
    component.destroy();
    
    test.assert(!window[componentId], 'Component should be removed from global registry');
    test.assert(!component._mounted, 'Component should be unmounted');
    test.assert(!component._el, 'Component element should be cleaned up');
}, { category: 'component' });

// Run tests when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => testSuite.runAll());
} else {
    testSuite.runAll();
}

// Export for manual testing
window.TMTestSuite = TMTestSuite;

// Initialize suite only when TM is available
function initializeComponentTestSuite() {
    if (typeof TM !== 'undefined' && TM.Component && !window.testSuite) {
        window.testSuite = new TMTestSuite();
        console.log('✅ Core Test Suite initialized with', window.testSuite.tests.length, 'tests');
    }
}

// Initialize immediately if available, otherwise wait
initializeComponentTestSuite();
if (typeof window !== 'undefined') {
    setTimeout(initializeComponentTestSuite, 100);
}