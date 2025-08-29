#!/bin/bash

# Team Accountability Check Script
# Verifies actual progress vs. claims

CODES_DIR="/Users/yellowsunhy/Desktop/projects/justslash/agentmux/codes"
cd "$CODES_DIR" || exit 1

echo "🔍 ORCHESTRATOR ACCOUNTABILITY CHECK"
echo "====================================="
echo "Time: $(date)"
echo ""

# Check git activity
echo "📊 GIT ACTIVITY CHECK:"
echo "Last 5 commits:"
git log --oneline -5 || echo "❌ No git commits found"
echo ""

echo "📁 Files changed in last hour:"
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -newermt "1 hour ago" | head -10
echo ""

# Check if tests can run
echo "🧪 TEST ENVIRONMENT CHECK:"
echo "Attempting to run tests..."
timeout 30s npm test > test-check.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Tests can execute"
    grep -i "passing\|failing" test-check.log | head -5
else
    echo "❌ Tests failed to run"
    echo "Error details:"
    tail -5 test-check.log
fi
echo ""

# Check for architectural compliance
echo "🏗️  ARCHITECTURE MIGRATION CHECK:"
echo "Checking for old vs new architecture:"

echo "Socket.IO references (should be removing these):"
grep -r "socket\.io" src/ 2>/dev/null | wc -l || echo "0"

echo "JWT references (should be removing these):"  
grep -r "jsonwebtoken\|jwt" src/ 2>/dev/null | wc -l || echo "0"

echo "FileStorage references (should be adding these):"
grep -r "FileStorage" src/ 2>/dev/null | wc -l || echo "0"

echo "JSON file operations (should be adding these):"
grep -r "\.json" src/ 2>/dev/null | grep -v node_modules | wc -l || echo "0"

echo ""

# Check team assignments
echo "📋 MILESTONE PROGRESS CHECK:"
if [ -f "MILESTONE-PLAN.md" ]; then
    echo "Phase 1 tasks marked complete:"
    grep -c "✅\|\[x\]" MILESTONE-PLAN.md || echo "0"
    echo "Phase 1 tasks remaining:"
    grep -c "\[ \]" MILESTONE-PLAN.md || echo "0"
else
    echo "❌ MILESTONE-PLAN.md not found"
fi
echo ""

# Verification summary
echo "🎯 VERIFICATION SUMMARY:"
echo "=============================="

# Git activity score
RECENT_COMMITS=$(git log --since="1 hour ago" --oneline | wc -l)
if [ "$RECENT_COMMITS" -gt 0 ]; then
    echo "✅ Git activity: $RECENT_COMMITS commits in last hour"
else
    echo "❌ Git activity: No commits in last hour"
fi

# Test capability score
if timeout 10s npm test --silent > /dev/null 2>&1; then
    echo "✅ Test environment: Working"
else
    echo "❌ Test environment: Broken"
fi

# Architecture migration score
WEBSOCKET_REFS=$(grep -r "useWebSocket\|socket\.io" src/ 2>/dev/null | wc -l || echo "0")
FILESTORAGE_REFS=$(grep -r "FileStorage" src/ 2>/dev/null | wc -l || echo "0")

if [ "$WEBSOCKET_REFS" -gt 10 ] && [ "$FILESTORAGE_REFS" -eq 0 ]; then
    echo "❌ Architecture: Still using old complex architecture"
elif [ "$FILESTORAGE_REFS" -gt 0 ]; then
    echo "✅ Architecture: Migration in progress"
else
    echo "⚠️  Architecture: Status unclear"
fi

echo ""
echo "Next check in 15 minutes..."
echo "Team must show measurable progress or face reassignment."