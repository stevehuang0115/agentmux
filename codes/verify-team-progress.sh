#!/bin/bash

# Team Progress Verification Script
# Run this to check if team is actually fixing issues

echo "🔍 TEAM PROGRESS VERIFICATION"
echo "============================="
echo "Time: $(date)"
echo ""

cd /Users/yellowsunhy/Desktop/projects/justslash/agentmux/codes

# Check 1: Can the app build?
echo "🏗️  BUILD VERIFICATION:"
echo "Attempting build..."
if timeout 60s npm run build > build-test.log 2>&1; then
    echo "✅ BUILD: PASSED"
    echo "   App can compile successfully"
else
    echo "❌ BUILD: FAILED" 
    echo "   Error details:"
    tail -5 build-test.log | sed 's/^/   /'
    echo ""
    echo "🚨 TEAM HAS NOT FIXED BUILD ERRORS"
fi
echo ""

# Check 2: Recent git activity showing real work
echo "📊 GIT ACTIVITY CHECK:"
RECENT_COMMITS=$(git log --since="1 hour ago" --oneline | wc -l)
echo "Commits in last hour: $RECENT_COMMITS"

if [ "$RECENT_COMMITS" -gt 0 ]; then
    echo "Recent commits:"
    git log --since="1 hour ago" --oneline | sed 's/^/   /'
    echo ""
    
    # Check commit quality
    HONEST_COMMITS=$(git log --since="1 hour ago" --oneline | grep -i "fix\|error\|build\|typescript" | wc -l)
    if [ "$HONEST_COMMITS" -gt 0 ]; then
        echo "✅ COMMITS: Show actual fix work"
    else
        echo "⚠️  COMMITS: May not address real issues"
    fi
else
    echo "❌ COMMITS: No recent activity"
    echo "🚨 TEAM IS NOT WORKING ON FIXES"
fi
echo ""

# Check 3: TypeScript errors fixed?
echo "🔧 TYPESCRIPT ERROR CHECK:"
if grep -n "displayContent" src/components/TerminalViewer.tsx > /dev/null 2>&1; then
    echo "Checking TerminalViewer.tsx for build error..."
    
    # Look for the specific error pattern
    ERROR_LINE=$(grep -n "displayContent" src/components/TerminalViewer.tsx | head -1 | cut -d: -f1)
    if [ -n "$ERROR_LINE" ]; then
        echo "   Line $ERROR_LINE contains displayContent reference"
        
        # Check if it's properly declared before use
        DECLARATION_LINE=$(grep -n "const displayContent\|let displayContent\|var displayContent" src/components/TerminalViewer.tsx | head -1 | cut -d: -f1)
        if [ -n "$DECLARATION_LINE" ] && [ "$DECLARATION_LINE" -lt "$ERROR_LINE" ]; then
            echo "✅ TYPESCRIPT: displayContent properly declared"
        else
            echo "❌ TYPESCRIPT: displayContent still used before declaration"
            echo "🚨 PRIMARY BUILD ERROR NOT FIXED"
        fi
    fi
else
    echo "⚠️  Cannot verify - TerminalViewer.tsx not found or no displayContent references"
fi
echo ""

# Check 4: Spec compliance evidence
echo "📋 SPEC COMPLIANCE CHECK:"
echo "Checking for spec implementation evidence..."

# Check for FileStorage (should be added per specs)
FILESTORAGE_COUNT=$(find src/ -name "*.ts" -exec grep -l "FileStorage" {} \; 2>/dev/null | wc -l)
echo "FileStorage implementations found: $FILESTORAGE_COUNT"

# Check for Socket.IO (should be removed per specs)  
SOCKETIO_COUNT=$(find src/ -name "*.ts" -exec grep -l "socket\.io" {} \; 2>/dev/null | wc -l)
echo "Socket.IO references remaining: $SOCKETIO_COUNT"

# Check for JWT (should be removed per specs)
JWT_COUNT=$(find src/ -name "*.ts" -exec grep -l "jsonwebtoken\|jwt" {} \; 2>/dev/null | wc -l)
echo "JWT references remaining: $JWT_COUNT"

if [ "$FILESTORAGE_COUNT" -gt 0 ] && [ "$SOCKETIO_COUNT" -eq 0 ] && [ "$JWT_COUNT" -eq 0 ]; then
    echo "✅ SPECS: Good progress on lightweight architecture"
elif [ "$FILESTORAGE_COUNT" -gt 0 ]; then
    echo "⚠️  SPECS: Some progress, but complex architecture still present"
else
    echo "❌ SPECS: No evidence of lightweight architecture implementation"
    echo "🚨 TEAM HAS NOT STARTED SPEC REQUIREMENTS"
fi
echo ""

# Check 5: QA verification files
echo "🧪 QA VERIFICATION CHECK:"
if ls qa-verification-*.log > /dev/null 2>&1; then
    LATEST_QA=$(ls -t qa-verification-*.log | head -1)
    echo "Latest QA verification: $LATEST_QA"
    if grep -q "BUILD: PASS" "$LATEST_QA"; then
        echo "✅ QA: Reports build passing"
    else
        echo "❌ QA: Reports build issues"
    fi
else
    echo "❌ QA: No verification files found"
    echo "🚨 QA ENGINEER NOT RUNNING ACTUAL TESTS"
fi
echo ""

# Overall assessment
echo "🎯 OVERALL ASSESSMENT:"
echo "======================"

FIXES_NEEDED=0

if ! timeout 30s npm run build > /dev/null 2>&1; then
    echo "❌ CRITICAL: Build still broken"
    ((FIXES_NEEDED++))
fi

if [ "$RECENT_COMMITS" -eq 0 ]; then
    echo "❌ CRITICAL: No recent work activity"
    ((FIXES_NEEDED++))
fi

if [ "$FILESTORAGE_COUNT" -eq 0 ]; then
    echo "❌ CRITICAL: No spec compliance progress"
    ((FIXES_NEEDED++))
fi

if [ "$FIXES_NEEDED" -eq 0 ]; then
    echo "✅ GOOD PROGRESS: Team is addressing issues"
    echo "   Continue monitoring for completion"
elif [ "$FIXES_NEEDED" -le 2 ]; then
    echo "⚠️  SOME PROGRESS: Team working but issues remain"
    echo "   Fixes needed: $FIXES_NEEDED critical areas"
else
    echo "🚨 NO PROGRESS: Team has not addressed critical issues"
    echo "   Consider individual performance intervention"
fi

echo ""
echo "Next check recommended in 30 minutes"
echo "Script: ./verify-team-progress.sh"