/**
 * TM Framework Comprehensive Test Runner
 * Runs all test suites and generates detailed reports
 */

class ComprehensiveTestRunner {
    constructor() {
        this.suites = [];
        this.results = {
            totalTests: 0,
            totalPassed: 0,
            totalFailed: 0,
            suites: [],
            performance: {},
            startTime: null,
            endTime: null
        };
    }
    
    addSuite(name, suite) {
        this.suites.push({ name, suite });
    }
    
    async runAll() {
        console.log('🚀 Starting Comprehensive TM Framework Test Suite');
        console.log('='.repeat(60));
        
        this.results.startTime = performance.now();
        
        // Run each test suite
        for (const { name, suite } of this.suites) {
            console.log(`\n📋 Running ${name}...`);
            console.log('-'.repeat(name.length + 10));
            
            const suiteStartTime = performance.now();
            const suiteResults = await suite.runAll();
            const suiteEndTime = performance.now();
            
            const suiteSummary = {
                name,
                total: suiteResults.total || suiteResults.details?.length || 0,
                passed: suiteResults.passed || 0,
                failed: suiteResults.failed || 0,
                duration: suiteEndTime - suiteStartTime,
                details: suiteResults.details || []
            };
            
            this.results.suites.push(suiteSummary);
            this.results.totalTests += suiteSummary.total;
            this.results.totalPassed += suiteSummary.passed;
            this.results.totalFailed += suiteSummary.failed;
            
            console.log(`✨ ${name} completed: ${suiteSummary.passed}/${suiteSummary.total} passed (${suiteSummary.duration.toFixed(2)}ms)`);
        }
        
        this.results.endTime = performance.now();
        this.generateReport();
        this.saveReport();
        
        return this.results;
    }
    
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPREHENSIVE TEST REPORT');
        console.log('='.repeat(60));
        
        const totalDuration = this.results.endTime - this.results.startTime;
        const successRate = ((this.results.totalPassed / this.results.totalTests) * 100).toFixed(1);
        
        console.log(`\n📈 Overall Results:`);
        console.log(`   Total Tests: ${this.results.totalTests}`);
        console.log(`   Passed: ${this.results.totalPassed} ✅`);
        console.log(`   Failed: ${this.results.totalFailed} ❌`);
        console.log(`   Success Rate: ${successRate}%`);
        console.log(`   Total Duration: ${totalDuration.toFixed(2)}ms`);
        
        // Suite breakdown
        console.log(`\n📋 Suite Breakdown:`);
        this.results.suites.forEach(suite => {
            const suiteSuccessRate = ((suite.passed / suite.total) * 100).toFixed(1);
            const status = suite.failed === 0 ? '✅' : '❌';
            console.log(`   ${status} ${suite.name}: ${suite.passed}/${suite.total} (${suiteSuccessRate}%) - ${suite.duration.toFixed(2)}ms`);
        });
        
        // Failed tests details
        if (this.results.totalFailed > 0) {
            console.log(`\n❌ Failed Tests Details:`);
            this.results.suites.forEach(suite => {
                const failedTests = suite.details.filter(t => t.status === 'failed');
                if (failedTests.length > 0) {
                    console.log(`   ${suite.name}:`);
                    failedTests.forEach(test => {
                        console.log(`     - ${test.name}: ${test.error}`);
                    });
                }
            });
        }
        
        // Performance analysis
        this.analyzePerformance();
        
        // Framework health score
        this.calculateHealthScore();
    }
    
    analyzePerformance() {
        console.log(`\n⚡ Performance Analysis:`);
        
        const avgTestDuration = this.results.suites.reduce((sum, suite) => sum + suite.duration, 0) / this.results.suites.length;
        console.log(`   Average Suite Duration: ${avgTestDuration.toFixed(2)}ms`);
        
        // Slow tests (>500ms)
        const slowSuites = this.results.suites.filter(suite => suite.duration > 500);
        if (slowSuites.length > 0) {
            console.log(`   ⚠️  Slow Suites (>500ms):`);
            slowSuites.forEach(suite => {
                console.log(`     - ${suite.name}: ${suite.duration.toFixed(2)}ms`);
            });
        } else {
            console.log(`   ✅ All suites completed in good time (<500ms)`);
        }
        
        // Slow individual tests
        const slowTests = [];
        this.results.suites.forEach(suite => {
            suite.details.forEach(test => {
                if (test.duration > 200) {
                    slowTests.push({ ...test, suite: suite.name });
                }
            });
        });
        
        if (slowTests.length > 0) {
            console.log(`   ⚠️  Slow Individual Tests (>200ms):`);
            slowTests.forEach(test => {
                console.log(`     - ${test.suite}: ${test.name} (${test.duration.toFixed(2)}ms)`);
            });
        }
    }
    
    calculateHealthScore() {
        const successRate = (this.results.totalPassed / this.results.totalTests) * 100;
        const avgSuiteDuration = this.results.suites.reduce((sum, suite) => sum + suite.duration, 0) / this.results.suites.length;
        
        let healthScore = successRate; // Base score on success rate
        
        // Penalty for slow performance
        if (avgSuiteDuration > 1000) healthScore -= 20;
        else if (avgSuiteDuration > 500) healthScore -= 10;
        else if (avgSuiteDuration > 200) healthScore -= 5;
        
        // Bonus for no failures
        if (this.results.totalFailed === 0) healthScore += 5;
        
        // Bonus for fast execution
        if (avgSuiteDuration < 100) healthScore += 5;
        else if (avgSuiteDuration < 50) healthScore += 10;
        
        healthScore = Math.max(0, Math.min(100, healthScore));
        
        console.log(`\n💚 Framework Health Score: ${healthScore.toFixed(1)}/100`);
        
        let rating = 'Poor';
        if (healthScore >= 90) rating = 'Excellent';
        else if (healthScore >= 80) rating = 'Good';
        else if (healthScore >= 70) rating = 'Fair';
        else if (healthScore >= 60) rating = 'Below Average';
        
        console.log(`   Rating: ${rating}`);
        
        if (healthScore >= 80) {
            console.log(`   ✅ Framework is performing well!`);
        } else {
            console.log(`   ⚠️  Framework needs attention - see failed tests and performance issues`);
        }
    }
    
    saveReport() {
        const report = {
            timestamp: new Date().toISOString(),
            framework: 'TM Framework v1.0.0',
            environment: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                tmVersion: window.TM?.version || 'Unknown'
            },
            results: this.results,
            recommendations: this.generateRecommendations()
        };
        
        // Save to localStorage
        localStorage.setItem('tm-test-report', JSON.stringify(report));
        
        // Create downloadable JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tm-framework-test-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`\n💾 Report saved to localStorage and downloaded as JSON file`);
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        if (this.results.totalFailed > 0) {
            recommendations.push({
                type: 'critical',
                title: 'Fix Failed Tests',
                description: `There are ${this.results.totalFailed} failing tests that need attention`
            });
        }
        
        const slowSuites = this.results.suites.filter(suite => suite.duration > 500);
        if (slowSuites.length > 0) {
            recommendations.push({
                type: 'performance',
                title: 'Optimize Slow Test Suites',
                description: `${slowSuites.length} test suites are taking more than 500ms`
            });
        }
        
        const successRate = (this.results.totalPassed / this.results.totalTests) * 100;
        if (successRate < 95) {
            recommendations.push({
                type: 'quality',
                title: 'Improve Test Coverage',
                description: `Success rate is ${successRate.toFixed(1)}%, aim for >95%`
            });
        }
        
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                title: 'Excellent Health',
                description: 'All tests passed and performance is good!'
            });
        }
        
        return recommendations;
    }
}

// Initialize comprehensive test runner
async function runComprehensiveTests() {
    const runner = new ComprehensiveTestRunner();
    
    // Add test suites
    if (typeof TMTestSuite !== 'undefined') {
        const coreTests = new TMTestSuite();
        runner.addSuite('Core Framework Tests', coreTests);
    }
    
    if (typeof LabelEditorTestSuite !== 'undefined') {
        const labelTests = new LabelEditorTestSuite();
        runner.addSuite('Label Editor Tests', labelTests);
    }
    
    // Run all tests
    const results = await runner.runAll();
    
    // Return results for further processing
    return results;
}

// Export for use
window.ComprehensiveTestRunner = ComprehensiveTestRunner;
window.runComprehensiveTests = runComprehensiveTests;

// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.location.pathname.includes('comprehensive-tests')) {
    runComprehensiveTests();
}