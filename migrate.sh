#!/bin/bash

# Migration script to move to TypeScript-first architecture

echo "🚀 Migrating to TypeScript-first architecture..."

# Create backup directory
mkdir -p legacy

# Backup existing JavaScript files
echo "📦 Backing up legacy JavaScript files..."
cp index.js legacy/ 2>/dev/null && echo "✅ Backed up index.js"
cp test.js legacy/ 2>/dev/null && echo "✅ Backed up test.js"
cp exemple.js legacy/ 2>/dev/null && echo "✅ Backed up exemple.js"
cp test-*.js legacy/ 2>/dev/null && echo "✅ Backed up test files"
cp *.js legacy/ 2>/dev/null || true

echo "📝 Legacy files backed up to legacy/ directory"

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build-ts

if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
    
    # Create symbolic links for backward compatibility
    echo "🔗 Creating compatibility links..."
    
    # Link main module
    ln -sf dist/src/main.js index.js 2>/dev/null || cp dist/src/main.js index.js
    
    echo "✅ Migration complete!"
    echo ""
    echo "📋 What changed:"
    echo "  • JavaScript files moved to legacy/ directory"
    echo "  • Main entry point now compiled from TypeScript"
    echo "  • Backward compatibility maintained"
    echo "  • Single source of truth: TypeScript files in src/"
    echo ""
    echo "🧪 Test the migration:"
    echo "  npm test"
    echo "  node validate-all-features.js"
    
else
    echo "❌ TypeScript compilation failed"
    echo "Please fix TypeScript errors before migrating"
    exit 1
fi
