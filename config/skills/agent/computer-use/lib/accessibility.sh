#!/usr/bin/env bash
# =============================================================================
# Accessibility API — Layer 3
# Universal UI automation: read elements, click, type, scroll, focus.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

# -----------------------------------------------------------------------------
# Accessibility permission check (cached per invocation)
# -----------------------------------------------------------------------------
_AX_CHECKED=""
_AX_TRUSTED=""

check_ax_permission() {
  if [ -z "$_AX_CHECKED" ]; then
    _AX_TRUSTED=$(swift -e 'import Cocoa; print(AXIsProcessTrusted())' 2>/dev/null || echo "false")
    _AX_CHECKED="1"
  fi
  [ "$_AX_TRUSTED" = "true" ]
}

require_ax_permission() {
  if ! check_ax_permission; then
    error_exit "Accessibility permission required. Fix: System Settings > Privacy & Security > Accessibility > enable your terminal app, then restart terminal."
  fi
}

do_check_access() {
  if check_ax_permission; then
    echo "{\"success\":true,\"action\":\"check-access\",\"trusted\":true,\"message\":\"Accessibility permission granted.\"}"
  else
    echo "{\"success\":true,\"action\":\"check-access\",\"trusted\":false,\"message\":\"Accessibility permission NOT granted. Fix: System Settings > Privacy & Security > Accessibility > enable your terminal app.\"}"
  fi
}

# -----------------------------------------------------------------------------
# ui_tree — Read UI element tree from an app
# Params: appName, maxDepth (default 8)
# -----------------------------------------------------------------------------
ui_tree() {
  local app_name="$1"
  local max_depth="${2:-8}"
  require_ax_permission

  local result
  result=$(osascript -l JavaScript -e "
    var app = Application('System Events');
    var proc = app.processes.byName('$app_name');
    var maxDepth = $max_depth;
    var nodeCount = 0;
    var MAX_NODES = 500;

    function readElement(el, depth) {
      if (depth > maxDepth || nodeCount >= MAX_NODES) return null;
      nodeCount++;
      var info = {};
      try { info.role = el.role(); } catch(e) { info.role = 'unknown'; }
      try { var t = el.title(); if (t) info.title = t; } catch(e) {}
      try { var v = el.value(); if (v !== null && v !== undefined) info.value = String(v).substring(0, 500); } catch(e) {}
      try { var d = el.description(); if (d) info.description = d; } catch(e) {}
      try { var p = el.position(); info.position = {x: p[0], y: p[1]}; } catch(e) {}
      try { var s = el.size(); info.size = {w: s[0], h: s[1]}; } catch(e) {}

      if (depth < maxDepth && nodeCount < MAX_NODES) {
        try {
          var children = el.uiElements();
          if (children.length > 0) {
            info.children = [];
            for (var i = 0; i < Math.min(children.length, 50); i++) {
              var child = readElement(children[i], depth + 1);
              if (child) info.children.push(child);
            }
          }
        } catch(e) {}
      }
      return info;
    }

    var windows = proc.windows();
    var result = {windowCount: windows.length, windows: []};
    for (var w = 0; w < windows.length; w++) {
      var win = windows[w];
      var winInfo = readElement(win, 0);
      try { winInfo.windowTitle = win.title() || win.name() || 'Window ' + w; } catch(e) { winInfo.windowTitle = 'Window ' + w; }
      result.windows.push(winInfo);
    }
    JSON.stringify(result);
  " 2>&1)

  if [ $? -ne 0 ]; then
    error_exit "Failed to read UI tree for '$app_name': $result"
  fi
  echo "{\"success\":true,\"action\":\"ui-tree\",\"appName\":\"$app_name\",\"maxDepth\":$max_depth,\"ui\":$result}"
}

# -----------------------------------------------------------------------------
# click_element — Click a UI element by role:name or coordinates
# Params: appName, element (role:name) OR x,y
# -----------------------------------------------------------------------------
click_element() {
  local app_name="$1"
  local element="${2:-}"
  local click_x="${3:-}"
  local click_y="${4:-}"

  if [ -n "$element" ]; then
    # Parse role:name format
    local role name
    role=$(echo "$element" | cut -d: -f1)
    name=$(echo "$element" | cut -d: -f2-)

    # Find element position via Accessibility API
    require_ax_permission
    local pos
    pos=$(osascript -l JavaScript -e "
      var app = Application('System Events');
      var proc = app.processes.byName('$app_name');
      var found = null;

      function findElement(el, depth) {
        if (depth > 10 || found) return;
        var elRole = '';
        var elTitle = '';
        var elDesc = '';
        try { elRole = el.role(); } catch(e) {}
        try { elTitle = el.title() || ''; } catch(e) {}
        try { elDesc = el.description() || ''; } catch(e) {}

        var roleMatch = '$role' === '' || elRole.toLowerCase().indexOf('$role'.toLowerCase()) >= 0;
        var nameMatch = elTitle.indexOf('$name') >= 0 || elDesc.indexOf('$name') >= 0;

        if (roleMatch && nameMatch) {
          try {
            var p = el.position();
            var s = el.size();
            found = {x: p[0] + s[0]/2, y: p[1] + s[1]/2};
          } catch(e) {}
        }

        if (!found) {
          try {
            var children = el.uiElements();
            for (var i = 0; i < children.length && !found; i++) {
              findElement(children[i], depth + 1);
            }
          } catch(e) {}
        }
      }

      var windows = proc.windows();
      for (var w = 0; w < windows.length && !found; w++) {
        findElement(windows[w], 0);
      }
      found ? JSON.stringify(found) : 'null';
    " 2>&1)

    if [ "$pos" = "null" ] || [ -z "$pos" ]; then
      error_exit "Element '$element' not found in '$app_name'"
    fi

    click_x=$(echo "$pos" | jq -r '.x')
    click_y=$(echo "$pos" | jq -r '.y')
  fi

  require_param "x or element" "$click_x"
  require_param "y or element" "$click_y"

  # Perform the click via CoreGraphics
  osascript -l JavaScript -e "
    ObjC.import('CoreGraphics');
    var point = $.CGPointMake($click_x, $click_y);
    var move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, 0);
    $.CGEventPost($.kCGHIDEventTap, move);
    var down = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, 0);
    $.CGEventPost($.kCGHIDEventTap, down);
    var up = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, 0);
    $.CGEventPost($.kCGHIDEventTap, up);
    'clicked';
  " >/dev/null 2>&1

  echo "{\"success\":true,\"action\":\"click\",\"appName\":\"$app_name\",\"x\":$click_x,\"y\":$click_y,\"element\":\"${element:-coordinates}\"}"
}

# -----------------------------------------------------------------------------
# type_text — Type text in the focused field
# Params: text
# -----------------------------------------------------------------------------
type_text() {
  local text="$1"
  osascript -e "tell application \"System Events\" to keystroke \"$text\"" 2>/dev/null
  local char_count=${#text}
  echo "{\"success\":true,\"action\":\"type\",\"characters\":$char_count}"
}

# -----------------------------------------------------------------------------
# get_text — Extract all visible text from an app
# Params: appName, maxDepth (default 25)
# -----------------------------------------------------------------------------
get_text() {
  local app_name="$1"
  local max_depth="${2:-25}"
  require_ax_permission

  local result
  result=$(osascript -l JavaScript -e "
    var app = Application('System Events');
    var proc = app.processes.byName('$app_name');
    var texts = [];
    var maxDepth = $max_depth;
    var skipDescs = {'group':1,'button':1,'scroll area':1,'collection':1,'text':1,
      'standard window':1,'image':1,'tab bar':1,'close button':1,
      'full screen button':1,'minimize button':1};

    function extractText(el, depth) {
      if (depth > maxDepth) return;
      var role = 'unknown';
      try { role = el.role(); } catch(e) {}
      try { var val = el.value(); if (val !== null && val !== undefined && String(val).trim().length > 0) texts.push({role: role, text: String(val).substring(0, 1000)}); } catch(e) {}
      try { var title = el.title(); if (title && title.trim().length > 0) texts.push({role: role, text: title}); } catch(e) {}
      try { var desc = el.description(); if (desc && desc.trim().length > 0 && !skipDescs[desc.toLowerCase()]) texts.push({role: role, text: desc}); } catch(e) {}
      try { var children = el.uiElements(); for (var i = 0; i < Math.min(children.length, 100); i++) extractText(children[i], depth + 1); } catch(e) {}
    }

    var windows = proc.windows();
    for (var w = 0; w < windows.length; w++) extractText(windows[w], 0);

    var seen = {};
    var unique = [];
    for (var i = 0; i < texts.length; i++) {
      if (!seen[texts[i].text]) { seen[texts[i].text] = true; unique.push(texts[i]); }
    }
    JSON.stringify(unique);
  " 2>&1)

  if [ $? -ne 0 ]; then
    error_exit "Failed to get text from '$app_name': $result"
  fi
  echo "{\"success\":true,\"action\":\"get-text\",\"appName\":\"$app_name\",\"texts\":$result}"
}

# -----------------------------------------------------------------------------
# scroll_app — Scroll within an app
# Params: direction (up|down|left|right), amount (default 3), appName (optional)
# -----------------------------------------------------------------------------
scroll_app() {
  local direction="${1:-down}"
  local amount="${2:-3}"
  local app_name="${3:-}"

  if [ -n "$app_name" ]; then
    osascript -l JavaScript -e "
      var app = Application('System Events');
      app.processes.byName('$app_name').frontmost = true;
    " >/dev/null 2>&1
    sleep 0.3
  fi

  local dx=0 dy=0
  case "$direction" in
    up)    dy=$amount ;;
    down)  dy=$(( -amount )) ;;
    left)  dx=$amount ;;
    right) dx=$(( -amount )) ;;
    *)     error_exit "Unknown direction: $direction" ;;
  esac

  osascript -l JavaScript -e "
    ObjC.import('CoreGraphics');
    var event = $.CGEventCreateScrollWheelEvent(null, $.kCGScrollEventUnitLine, 2, $dy, $dx);
    $.CGEventPost($.kCGHIDEventTap, event);
    'scrolled';
  " >/dev/null 2>&1

  echo "{\"success\":true,\"action\":\"scroll\",\"direction\":\"$direction\",\"amount\":$amount}"
}

# -----------------------------------------------------------------------------
# focus_app — Bring an app to the foreground
# Params: appName
# -----------------------------------------------------------------------------
focus_app() {
  local app_name="$1"
  osascript -l JavaScript -e "
    var app = Application('System Events');
    app.processes.byName('$app_name').frontmost = true;
  " >/dev/null 2>&1
  echo "{\"success\":true,\"action\":\"focus\",\"appName\":\"$app_name\"}"
}
