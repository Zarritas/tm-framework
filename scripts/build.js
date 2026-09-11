#!/usr/bin/env node

/**
 * TM Framework - Build Script
 * Concatenates and optionally minifies framework files
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
    rootDir: path.resolve(__dirname, '..'),
    distDir: path.resolve(__dirname, '..', 'dist'),
    
    // Core files in order (dependencies first)
    core: [
        'core/logger.js',
        'core/reactive.js',
        'core/component.js',
        'core/utils.js',
        'core/theme.js',
        'core/selector.js',
        'core/tm.js'
    ],
    
    // Component files
    components: [
        'components/forms/index.js',
        'components/overlay/index.js',
        'components/feedback/index.js',
        'components/data/index.js',
        'components/layout/index.js'
    ],
    
    // Style files in order
    styles: [
        'styles/variables.css',
        'styles/base.css',
        'styles/animations.css',
        'styles/components/button.css',
        'styles/components/input.css',
        'styles/components/modal.css',
        'styles/components/toast.css',
        'styles/components/tag.css',
        'styles/components/card.css',
        'styles/components/tabs.css',
        'styles/components/list.css',
        'styles/components/misc.css'
    ],
    
    // Plugin files
    plugins: [
        'plugins/gitlab-dom.js',
        'plugins/gitlab.js',
        'plugins/odoo.js'
    ]
};

// ═══════════════════════════════════════════════════════════════════════════
// BUILD FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read and concatenate files
 */
function concatFiles(files, header = '') {
    let content = header;
    
    for (const file of files) {
        const filePath = path.join(CONFIG.rootDir, file);
        
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  File not found: ${file}`);
            continue;
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        content += `\n/* ═══ ${file} ═══ */\n`;
        content += fileContent;
        content += '\n';
    }
    
    return content;
}

/**
 * Simple minification (removes comments and extra whitespace)
 */
function minifyJS(code) {
    return code
        // Remove single-line comments (but not URLs)
        .replace(/(?<!:)\/\/.*$/gm, '')
        // Remove multi-line comments (but keep /*! ... */)
        .replace(/\/\*(?!\!)[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Clean up around brackets
        .replace(/\s*([{}()[\];,:])\s*/g, '$1')
        // Restore some necessary spaces
        .replace(/\b(return|const|let|var|if|else|for|while|function|class|extends|new|typeof|instanceof)\b/g, ' $1 ')
        .trim();
}

function minifyCSS(code) {
    return code
        // Remove comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove whitespace
        .replace(/\s+/g, ' ')
        // Clean up around brackets and colons
        .replace(/\s*([{}:;,])\s*/g, '$1')
        // Remove last semicolon before }
        .replace(/;}/g, '}')
        .trim();
}

/**
 * Generate file header
 */
function getHeader(name, version) {
    return `/*!
 * TM Framework - ${name}
 * Version: ${version}
 * Built: ${new Date().toISOString()}
 * Author: Jesús Lorenzo
 * License: MIT
 */\n`;
}

/**
 * Ensure dist directory exists
 */
function ensureDistDir() {
    if (!fs.existsSync(CONFIG.distDir)) {
        fs.mkdirSync(CONFIG.distDir, { recursive: true });
    }
}

/**
 * Write file and log
 */
function writeFile(filename, content) {
    const filePath = path.join(CONFIG.distDir, filename);
    fs.writeFileSync(filePath, content);
    const size = (Buffer.byteLength(content) / 1024).toFixed(2);
    console.log(`✅ ${filename} (${size} KB)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN BUILD
// ═══════════════════════════════════════════════════════════════════════════

function build() {
    console.log('\n🔨 Building TM Framework...\n');
    
    // Get version from package.json
    const pkg = require(path.join(CONFIG.rootDir, 'package.json'));
    const version = pkg.version || '1.0.0';
    
    ensureDistDir();
    
    // ─────────────────────────────────────────────────────────────────────
    // Build Core Only
    // ─────────────────────────────────────────────────────────────────────
    console.log('📦 Building core...');
    
    const coreContent = concatFiles(CONFIG.core, getHeader('Core', version));
    writeFile('tm-core.js', coreContent);
    writeFile('tm-core.min.js', getHeader('Core (minified)', version) + minifyJS(coreContent));
    
    // ─────────────────────────────────────────────────────────────────────
    // Build Full Framework (Core + Components)
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n📦 Building full framework...');
    
    const fullContent = concatFiles(
        [...CONFIG.core, ...CONFIG.components],
        getHeader('Full Framework', version)
    );
    writeFile('tm-framework.js', fullContent);
    writeFile('tm-framework.min.js', getHeader('Full Framework (minified)', version) + minifyJS(fullContent));
    
    // ─────────────────────────────────────────────────────────────────────
    // Build Styles
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n🎨 Building styles...');
    
    const stylesContent = concatFiles(CONFIG.styles, getHeader('Styles', version));
    writeFile('tm-styles.css', stylesContent);
    writeFile('tm-styles.min.css', getHeader('Styles (minified)', version) + minifyCSS(stylesContent));
    
    // ─────────────────────────────────────────────────────────────────────
    // Build Plugins (individually)
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n🔌 Building plugins...');
    
    for (const plugin of CONFIG.plugins) {
        const pluginName = path.basename(plugin, '.js');
        const filePath = path.join(CONFIG.rootDir, plugin);
        
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const header = getHeader(`Plugin: ${pluginName}`, version);
            writeFile(`tm-${pluginName}.js`, header + content);
        }
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Generate index.js for easy importing
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n📄 Generating index...');
    
    const indexContent = `// TM Framework - Index
// Use this file for reference, not for direct import in Tampermonkey

module.exports = {
    version: '${version}',
    files: {
        core: 'tm-core.js',
        framework: 'tm-framework.js',
        styles: 'tm-styles.css',
        plugins: {
            gitlabDom: 'tm-gitlab-dom.js',
            gitlab: 'tm-gitlab.js',
            odoo: 'tm-odoo.js'
        }
    }
};
`;
    writeFile('index.js', indexContent);
    
    console.log('\n✨ Build complete!\n');
    
    // Print usage instructions
    console.log('📝 Usage in Tampermonkey:');
    console.log('─────────────────────────────────────────');
    console.log('// @require  https://raw.githubusercontent.com/Zarritas/tm-framework/main/dist/tm-framework.js');
    console.log('// @resource TM_CSS https://raw.githubusercontent.com/Zarritas/tm-framework/main/dist/tm-styles.css');
    console.log('─────────────────────────────────────────\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// WATCH MODE
// ═══════════════════════════════════════════════════════════════════════════

function watch() {
    console.log('👀 Watching for changes...\n');
    
    const watchDirs = ['core', 'components', 'styles', 'plugins'];
    
    for (const dir of watchDirs) {
        const dirPath = path.join(CONFIG.rootDir, dir);
        
        if (fs.existsSync(dirPath)) {
            fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
                if (filename && !filename.startsWith('.')) {
                    console.log(`\n📝 Changed: ${dir}/${filename}`);
                    build();
                }
            });
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args.includes('--watch') || args.includes('-w')) {
    build();
    watch();
} else {
    build();
}