#!/usr/bin/env bash
# =============================================================================
# AppleScript/JXA Automation — Layer 2
# Run custom AppleScript or use presets for common operations.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

# -----------------------------------------------------------------------------
# run_applescript — Execute raw AppleScript code
# Params: code
# -----------------------------------------------------------------------------
run_applescript() {
  local code="$1"

  local result
  result=$(osascript -e "$code" 2>&1)
  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    # Escape for JSON
    local escaped
    escaped=$(echo "$result" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' ' ')
    echo "{\"success\":false,\"action\":\"applescript\",\"error\":\"$escaped\"}"
    return 1
  fi

  # Escape result for JSON: handle backslashes, quotes, tabs, and newlines
  local escaped
  escaped=$(printf '%s' "$result" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' ' ' | sed 's/ *$//')
  echo "{\"success\":true,\"action\":\"applescript\",\"result\":\"$escaped\"}"
}

# -----------------------------------------------------------------------------
# run_preset — Execute a preset AppleScript operation
# Params: preset, ...args
# Presets: activate-app, get-window-list, click-menu-item, open-file,
#          get-clipboard, set-clipboard
# -----------------------------------------------------------------------------
run_preset() {
  local preset="$1"
  shift

  case "$preset" in
    activate-app)
      local app_name="$1"
      require_param "app" "$app_name"
      run_applescript "tell application \"$app_name\" to activate"
      ;;

    get-window-list)
      local app_name="$1"
      require_param "app" "$app_name"
      local result
      result=$(osascript -l JavaScript -e "
        var app = Application('$app_name');
        var wins = app.windows();
        var result = [];
        for (var i = 0; i < wins.length; i++) {
          try {
            result.push({index: i, name: wins[i].name()});
          } catch(e) {
            result.push({index: i, name: 'Window ' + i});
          }
        }
        JSON.stringify(result);
      " 2>&1)
      if [ $? -ne 0 ]; then
        echo "{\"success\":false,\"action\":\"applescript\",\"preset\":\"get-window-list\",\"error\":\"Failed: $result\"}"
        return 1
      fi
      echo "{\"success\":true,\"action\":\"applescript\",\"preset\":\"get-window-list\",\"windows\":$result}"
      ;;

    click-menu-item)
      local app_name="$1"
      local menu_name="$2"
      local item_name="$3"
      require_param "app" "$app_name"
      require_param "menu" "$menu_name"
      require_param "item" "$item_name"
      run_applescript "tell application \"System Events\" to tell process \"$app_name\" to click menu item \"$item_name\" of menu \"$menu_name\" of menu bar 1"
      ;;

    open-file)
      local file_path="$1"
      require_param "path" "$file_path"
      if [ ! -e "$file_path" ]; then
        echo "{\"success\":false,\"action\":\"applescript\",\"preset\":\"open-file\",\"error\":\"File not found: $file_path\"}"
        return 1
      fi
      run_applescript "tell application \"Finder\" to open POSIX file \"$file_path\""
      ;;

    get-clipboard)
      local content
      content=$(pbpaste 2>/dev/null || echo "")
      local escaped
      escaped=$(echo "$content" | head -c 10000 | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' ' ')
      echo "{\"success\":true,\"action\":\"applescript\",\"preset\":\"get-clipboard\",\"content\":\"$escaped\"}"
      ;;

    set-clipboard)
      local text="$1"
      require_param "text" "$text"
      echo -n "$text" | pbcopy
      echo "{\"success\":true,\"action\":\"applescript\",\"preset\":\"set-clipboard\"}"
      ;;

    *)
      error_exit "Unknown preset: $preset (use activate-app, get-window-list, click-menu-item, open-file, get-clipboard, set-clipboard)"
      ;;
  esac
}
