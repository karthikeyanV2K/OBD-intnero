@echo off
REM mcp-setup.bat - Quick MCP setup for OverdriveDB Agent (Windows)
REM Run: mcp-setup.bat

setlocal enabledelayedexpansion

echo.
echo 🚀 OverdriveDB MCP Setup (Windows)
echo ==================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js: !NODE_VERSION!

REM Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm: !NPM_VERSION!
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    pause
    exit /b 1
)

echo ✅ Dependencies installed
echo.

REM Setup .env
if not exist ".env" (
    echo 📝 Creating .env file...
    copy .env.example .env
    echo ✅ .env created
    echo.
    echo ⚠️  IMPORTANT: Edit .env and add your API keys:
    echo    - ANTHROPIC_API_KEY=sk-ant-...
    echo    - OPENAI_API_KEY=sk-...
    echo.
) else (
    echo ✅ .env already exists
)

REM Check OverdriveDB files
echo.
echo 📊 Checking database files...
if exist "agent-graph.odb" (
    echo ✅ Database files found (will reuse existing data)
) else (
    echo ℹ️  No database files yet (will be created on first run)
)

REM Test import
echo.
echo 🧪 Testing imports...
node -e "const mcp = require('@modelcontextprotocol/sdk/server/index.js'); const overdrive = require('overdrive-db'); console.log('✅ MCP SDK: OK'); console.log('✅ OverdriveDB: OK');"
if %errorlevel% neq 0 (
    echo ❌ Import failed. Run: npm install
    pause
    exit /b 1
)

echo.
echo 🎉 Setup complete!
echo.
echo Next steps:
echo 1. Edit .env and add your API keys
echo 2. Run: npm run mcp
echo 3. In another terminal, run: npm run server
echo 4. Test: 
echo    curl -X POST http://localhost:3001/task ^
echo    -H "Content-Type: application/json" ^
echo    -d "{\"task\":\"hello world\"}"
echo.
echo Then connect Claude, VS Code, or Kiro by following SETUP-MCP.md
echo.
pause
