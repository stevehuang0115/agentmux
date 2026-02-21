#!/bin/bash
# =============================================================================
# Desktop Automation (Computer Use) Skill
# Controls macOS desktop: screenshots, mouse, keyboard
# Uses native macOS APIs — no external dependencies required
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"action\":\"screenshot|move|click|type\", ...}'"

ACTION=$(echo "$INPUT" | jq -r '.action // empty')
require_param "action" "$ACTION"

# -----------------------------------------------------------------------------
# screenshot — capture the screen to a file
# -----------------------------------------------------------------------------
do_screenshot() {
  local output
  output=$(echo "$INPUT" | jq -r '.output // "/tmp/screenshot.png"')

  # Ensure output directory exists
  mkdir -p "$(dirname "$output")"

  screencapture -x "$output" 2>/dev/null

  if [ -f "$output" ]; then
    local size
    size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null || echo "unknown")
    echo "{\"success\":true,\"action\":\"screenshot\",\"file\":\"$output\",\"size\":$size}"
  else
    error_exit "Screenshot failed — file not created"
  fi
}

# -----------------------------------------------------------------------------
# move — move mouse cursor to (x, y)
# -----------------------------------------------------------------------------
do_move() {
  local x y
  x=$(echo "$INPUT" | jq -r '.x // empty')
  y=$(echo "$INPUT" | jq -r '.y // empty')
  require_param "x" "$x"
  require_param "y" "$y"

  osascript -l JavaScript -e "
    ObjC.import('CoreGraphics');
    var point = $.CGPointMake($x, $y);
    var event = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, 0);
    $.CGEventPost($.kCGHIDEventTap, event);
    'moved';
  " >/dev/null 2>&1

  echo "{\"success\":true,\"action\":\"move\",\"x\":$x,\"y\":$y}"
}

# -----------------------------------------------------------------------------
# click — click at (x, y) with optional button type
# -----------------------------------------------------------------------------
do_click() {
  local x y button
  x=$(echo "$INPUT" | jq -r '.x // empty')
  y=$(echo "$INPUT" | jq -r '.y // empty')
  button=$(echo "$INPUT" | jq -r '.button // "left"')
  require_param "x" "$x"
  require_param "y" "$y"

  case "$button" in
    left)
      osascript -l JavaScript -e "
        ObjC.import('CoreGraphics');
        var point = $.CGPointMake($x, $y);
        var move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, 0);
        $.CGEventPost($.kCGHIDEventTap, move);
        var down = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, 0);
        $.CGEventPost($.kCGHIDEventTap, down);
        var up = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, 0);
        $.CGEventPost($.kCGHIDEventTap, up);
        'clicked';
      " >/dev/null 2>&1
      ;;
    right)
      osascript -l JavaScript -e "
        ObjC.import('CoreGraphics');
        var point = $.CGPointMake($x, $y);
        var move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, 0);
        $.CGEventPost($.kCGHIDEventTap, move);
        var down = $.CGEventCreateMouseEvent(null, $.kCGEventRightMouseDown, point, $.kCGMouseButtonRight);
        $.CGEventPost($.kCGHIDEventTap, down);
        var up = $.CGEventCreateMouseEvent(null, $.kCGEventRightMouseUp, point, $.kCGMouseButtonRight);
        $.CGEventPost($.kCGHIDEventTap, up);
        'clicked';
      " >/dev/null 2>&1
      ;;
    double)
      osascript -l JavaScript -e "
        ObjC.import('CoreGraphics');
        var point = $.CGPointMake($x, $y);
        var move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, 0);
        $.CGEventPost($.kCGHIDEventTap, move);
        var down1 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, 0);
        $.CGEventSetIntegerValueField(down1, $.kCGMouseEventClickState, 1);
        $.CGEventPost($.kCGHIDEventTap, down1);
        var up1 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, 0);
        $.CGEventSetIntegerValueField(up1, $.kCGMouseEventClickState, 1);
        $.CGEventPost($.kCGHIDEventTap, up1);
        delay(0.05);
        var down2 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, 0);
        $.CGEventSetIntegerValueField(down2, $.kCGMouseEventClickState, 2);
        $.CGEventPost($.kCGHIDEventTap, down2);
        var up2 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, 0);
        $.CGEventSetIntegerValueField(up2, $.kCGMouseEventClickState, 2);
        $.CGEventPost($.kCGHIDEventTap, up2);
        'double-clicked';
      " >/dev/null 2>&1
      ;;
    *)
      error_exit "Unknown button type: $button (use left, right, or double)"
      ;;
  esac

  echo "{\"success\":true,\"action\":\"click\",\"x\":$x,\"y\":$y,\"button\":\"$button\"}"
}

# -----------------------------------------------------------------------------
# type — simulate keyboard input
# -----------------------------------------------------------------------------
do_type() {
  local text
  text=$(echo "$INPUT" | jq -r '.text // empty')
  require_param "text" "$text"

  osascript -e "tell application \"System Events\" to keystroke \"$text\"" 2>/dev/null

  local char_count=${#text}
  echo "{\"success\":true,\"action\":\"type\",\"characters\":$char_count}"
}

# -----------------------------------------------------------------------------
# Dispatch
# -----------------------------------------------------------------------------
case "$ACTION" in
  screenshot) do_screenshot ;;
  move)       do_move ;;
  click)      do_click ;;
  type)       do_type ;;
  *)          error_exit "Unknown action: $ACTION (use screenshot, move, click, or type)" ;;
esac
