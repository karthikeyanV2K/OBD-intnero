#!/bin/bash
# mcp-setup.sh - Quick MCP setup for OverdriveDB Agent
# Run: bash mcp-setup.sh

set -e

echo "🚀 OverdriveDB MCP Setup"
echo "========================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi

echo "✅ npm: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Dependencies installed"
echo ""

# Setup .env
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your API keys:"
    echo "   - ANTHROPIC_API_KEY=sk-ant-..."
    echo "   - OPENAI_API_KEY=sk-..."
    echo ""
else
    echo "✅ .env already exists"
fi

# Check OverdriveDB files
echo ""
echo "📊 Checking database files..."
if ls agent-*.odb 1> /dev/null 2>&1; then
    echo "✅ Database files found (will reuse existing data)"
else
    echo "ℹ️  No database files yet (will be created on first run)"
fi

# Test import
echo ""
echo "🧪 Testing imports..."
node -e "
const mcp = require('@modelcontextprotocol/sdk/server/index.js');
const overdrive = require('overdrive-db');
console.log('✅ MCP SDK: OK');
console.log('✅ OverdriveDB: OK');
" 2>/dev/null || {
    echo "❌ Import failed. Run: npm install"
    exit 1
}

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your API keys"
echo "2. Run: npm run mcp"
echo "3. In another terminal, run: npm run server"
echo "4. Test: curl http://localhost:3001/task -X POST -H 'Content-Type: application/json' -d '{\"task\":\"hello world\"}'"
echo ""
echo "Then connect Claude, VS Code, or Kiro by following SETUP-MCP.md"
