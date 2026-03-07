#!/usr/bin/env bash
# =============================================================================
# App Discovery — Layer 1
# Lists running GUI apps with bundle IDs and detects available control methods.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

# -----------------------------------------------------------------------------
# list_apps — List all foreground GUI apps with control method detection
# Output: JSON array of {name, bundleId, methods: [...]}
# -----------------------------------------------------------------------------
list_apps() {
  local result
  result=$(osascript -l JavaScript -e '
    var app = Application("System Events");
    var procs = app.processes.whose({backgroundOnly: false});
    var result = [];
    for (var i = 0; i < procs.length; i++) {
      try {
        var p = procs[i];
        var name = p.name();
        var bid = p.bundleIdentifier() || "unknown";
        var methods = ["accessibility"];

        // Native macOS apps support AppleScript
        if (bid.indexOf("com.apple.") === 0) {
          methods.push("applescript");
        }
        // Some third-party scriptable apps
        var scriptable = ["com.sublimetext", "com.googlecode.iterm2",
          "com.microsoft.VSCode", "com.brave.Browser",
          "org.mozilla.firefox"];
        for (var s = 0; s < scriptable.length; s++) {
          if (bid.indexOf(scriptable[s]) === 0) {
            methods.push("applescript");
            break;
          }
        }
        // Chrome-based browsers support CDP
        if (bid === "com.google.Chrome" || bid === "com.brave.Browser" ||
            bid === "com.microsoft.edgemac") {
          methods.push("playwright");
        }

        var winCount = 0;
        try { winCount = p.windows.length; } catch(e) {}

        result.push({
          name: name,
          bundleId: bid,
          windows: winCount,
          controllable: true,
          methods: methods
        });
      } catch(e) {}
    }
    JSON.stringify(result);
  ' 2>&1)

  if [ $? -ne 0 ]; then
    error_exit "Failed to list apps: $result"
  fi
  echo "{\"success\":true,\"action\":\"list-apps\",\"apps\":$result}"
}

# -----------------------------------------------------------------------------
# app_info — Get detailed info for a specific app
# Params: appName
# Output: JSON with name, bundleId, windows, methods, and basic UI summary
# -----------------------------------------------------------------------------
app_info() {
  local app_name="$1"

  local result
  result=$(osascript -l JavaScript -e "
    var app = Application('System Events');
    var proc = app.processes.byName('$app_name');
    var name = proc.name();
    var bid = proc.bundleIdentifier() || 'unknown';
    var windows = proc.windows();

    var methods = ['accessibility'];
    if (bid.indexOf('com.apple.') === 0) methods.push('applescript');
    var scriptable = ['com.sublimetext', 'com.googlecode.iterm2',
      'com.microsoft.VSCode', 'com.brave.Browser', 'org.mozilla.firefox'];
    for (var s = 0; s < scriptable.length; s++) {
      if (bid.indexOf(scriptable[s]) === 0) { methods.push('applescript'); break; }
    }
    if (bid === 'com.google.Chrome' || bid === 'com.brave.Browser' ||
        bid === 'com.microsoft.edgemac') {
      methods.push('playwright');
    }

    var winInfo = [];
    for (var w = 0; w < windows.length; w++) {
      var win = windows[w];
      var wTitle = '';
      try { wTitle = win.title() || win.name() || 'Window ' + w; } catch(e) { wTitle = 'Window ' + w; }
      var childCount = 0;
      try { childCount = win.uiElements().length; } catch(e) {}
      winInfo.push({title: wTitle, elementCount: childCount});
    }

    JSON.stringify({
      name: name,
      bundleId: bid,
      windows: winInfo.length,
      windowDetails: winInfo,
      controllable: true,
      methods: methods
    });
  " 2>&1)

  if [ $? -ne 0 ]; then
    error_exit "Failed to get app info for '$app_name': $result"
  fi
  echo "{\"success\":true,\"action\":\"app-info\",\"app\":$result}"
}
