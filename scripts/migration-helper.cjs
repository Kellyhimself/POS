#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to scan for old sync hooks
const OLD_HOOKS = [
  'useGlobalProductSync',
  'useGlobalSaleSync', 
  'useGlobalPurchaseSync',
  'useGlobalSupplierSync',
  'useGlobalEtimsSync',
  'useGlobalProductCache'
];

// Directories to scan
const SCAN_DIRECTORIES = [
  'src/app/**/*.tsx',
  'src/components/**/*.tsx',
  'src/lib/hooks/**/*.ts',
  'src/lib/hooks/**/*.tsx'
];

function findFilesWithOldHooks() {
  const filesWithOldHooks = [];
  
  SCAN_DIRECTORIES.forEach(pattern => {
    const files = glob.sync(pattern);
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const foundHooks = OLD_HOOKS.filter(hook => 
        content.includes(hook)
      );
      
      if (foundHooks.length > 0) {
        filesWithOldHooks.push({
          file,
          hooks: foundHooks,
          lines: content.split('\n').map((line, index) => ({
            number: index + 1,
            content: line,
            hasHook: foundHooks.some(hook => line.includes(hook))
          })).filter(line => line.hasHook)
        });
      }
    });
  });
  
  return filesWithOldHooks;
}

function generateMigrationReport(filesWithOldHooks) {
  console.log('🔄 Dual Mode Migration Helper\n');
  console.log('Files that need migration from old sync hooks to unified services:\n');
  
  if (filesWithOldHooks.length === 0) {
    console.log('✅ No files found with old sync hooks! Migration complete.');
    return;
  }
  
  filesWithOldHooks.forEach(({ file, hooks, lines }) => {
    console.log(`📁 ${file}`);
    console.log(`   Hooks found: ${hooks.join(', ')}`);
    console.log(`   Lines to update:`);
    
    lines.forEach(line => {
      console.log(`   ${line.number}: ${line.content.trim()}`);
    });
    
    console.log('');
  });
  
  console.log('📋 Migration Summary:');
  console.log(`   Total files to migrate: ${filesWithOldHooks.length}`);
  console.log(`   Total hook usages: ${filesWithOldHooks.reduce((sum, f) => sum + f.hooks.length, 0)}`);
  
  console.log('\n🔧 Next Steps:');
  console.log('   1. Replace old hook imports with useUnifiedService');
  console.log('   2. Update hook usage to use unified service methods');
  console.log('   3. Add mode-aware UI components');
  console.log('   4. Test in both online and offline modes');
  
  console.log('\n📖 See docs/migration-guide.md for detailed instructions');
}

function generateMigrationCommands(filesWithOldHooks) {
  console.log('\n🚀 Quick Migration Commands:\n');
  
  filesWithOldHooks.forEach(({ file, hooks }) => {
    console.log(`# Migrate ${path.basename(file)}`);
    console.log(`# Replace these hooks: ${hooks.join(', ')}`);
    console.log(`# With: useUnifiedService`);
    console.log(`code ${file}\n`);
  });
}

// Main execution
if (require.main === module) {
  try {
    const filesWithOldHooks = findFilesWithOldHooks();
    generateMigrationReport(filesWithOldHooks);
    
    if (process.argv.includes('--commands')) {
      generateMigrationCommands(filesWithOldHooks);
    }
    
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(filesWithOldHooks, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error running migration helper:', error.message);
    process.exit(1);
  }
}

module.exports = {
  findFilesWithOldHooks,
  generateMigrationReport
}; 