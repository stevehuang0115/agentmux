#!/bin/bash
# =============================================================================
# RedNote (小红书) Reader Skill
# Reads content from the 小红书 macOS iPad app via Accessibility API.
# The app's UI is deeply nested (25+ levels) — this skill knows the exact
# structure so agents don't need to explore each time.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

APP_NAME="discover"
MAX_DEPTH=28

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"action\":\"feed|scroll-feed|nav|search|raw\"}'"

ACTION=$(echo "$INPUT" | jq -r '.action // empty')
require_param "action" "$ACTION"

# -----------------------------------------------------------------------------
# Check that the app is running and accessible
# -----------------------------------------------------------------------------
check_app() {
  local running
  running=$(osascript -l JavaScript -e "
    var app = Application('System Events');
    var procs = app.processes.whose({name: '$APP_NAME'});
    procs.length;
  " 2>/dev/null || echo "0")

  if [ "$running" = "0" ]; then
    error_exit "小红书 (discover) is not running. Please start the app first."
  fi

  # Check accessibility
  local trusted
  trusted=$(swift -e 'import Cocoa; print(AXIsProcessTrusted())' 2>/dev/null || echo "false")
  if [ "$trusted" != "true" ]; then
    error_exit "Accessibility permission required. System Settings > Privacy & Security > Accessibility > enable Terminal."
  fi
}

# -----------------------------------------------------------------------------
# Generic descriptions to skip when extracting text
# -----------------------------------------------------------------------------
SKIP_DESCS_JS="var skipDescs={'group':1,'button':1,'scroll area':1,'collection':1,'text':1,'standard window':1,'image':1,'tab bar':1,'close button':1,'full screen button':1,'minimize button':1};"

# -----------------------------------------------------------------------------
# feed — Read structured feed posts
# -----------------------------------------------------------------------------
do_feed() {
  local limit
  limit=$(echo "$INPUT" | jq -r '.limit // 50')
  check_app

  local result
  result=$(osascript -l JavaScript -e "
    var app = Application('System Events');
    var proc = app.processes.byName('$APP_NAME');
    $SKIP_DESCS_JS

    var items = [];
    var maxDepth = $MAX_DEPTH;

    function extractAll(el, depth) {
      if (depth > maxDepth || items.length >= $limit) return;
      var role = 'unknown';
      try { role = el.role(); } catch(e) {}

      // Collect text from AXStaticText, AXButton (likes), AXGenericElement
      if (role === 'AXStaticText' || role === 'AXButton' || role === 'AXGenericElement') {
        var text = '';
        try {
          var desc = el.description();
          if (desc && desc.trim().length > 0 && !skipDescs[desc.toLowerCase()]) {
            text = desc;
          }
        } catch(e) {}
        if (!text) {
          try {
            var val = el.value();
            if (val !== null && val !== undefined && String(val).trim().length > 0) {
              text = String(val);
            }
          } catch(e) {}
        }
        if (text) {
          var pos = null;
          try { var p = el.position(); pos = {x: p[0], y: p[1]}; } catch(e) {}
          items.push({role: role, text: text.substring(0, 500), pos: pos});
        }
      }

      try {
        var children = el.uiElements();
        for (var i = 0; i < Math.min(children.length, 100); i++) {
          extractAll(children[i], depth + 1);
          if (items.length >= $limit) return;
        }
      } catch(e) {}
    }

    var windows = proc.windows();
    for (var w = 0; w < windows.length; w++) {
      extractAll(windows[w], 0);
    }

    // Parse items into structured posts
    // Strategy: use position data to separate navigation (y < 260) from feed (y >= 260)
    // Feed posts follow the pattern: title (AXStaticText) → author (AXStaticText) → likes (AXButton or AXStaticText number)
    var FEED_Y_THRESHOLD = 260;
    var nav = [];
    var posts = [];
    var currentPost = null;

    // Common nav labels to collect but not treat as post content
    var navLabels = {'Home':1,'Market':1,'Messages':1,'Me':1,'Following':1,
      'Explore':1,'Video':1,'For You':1,'Live':1,'Series':1,'Travel':1,
      'Career':1,'Food':1,'Comedy':1,'Cars':1,'Digital technology':1,
      'Love & life':1,'Music':1,'Crafts':1,'Fashion':1,'Reading':1,
      'Photography':1,'rednote':1};

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      // Position-based filtering: anything above the feed threshold is navigation
      if (item.pos && item.pos.y < FEED_Y_THRESHOLD) {
        if (item.text && item.text.length > 0) nav.push(item.text);
        continue;
      }

      // Skip common nav labels even if position is missing
      if (navLabels[item.text]) {
        nav.push(item.text);
        continue;
      }

      // Skip generic labels
      if (item.text === 'Sponsored' || item.text === 'Release Tag') continue;

      // Detect like counts: numbers with optional commas (e.g. '1,065', '23', '0')
      var isLikeCount = /^[\d,]+$/.test(item.text);

      // AXButton with numeric text or 'Like' text = like count
      if (item.role === 'AXButton') {
        var btnText = item.text.replace('Like','').trim();
        if (item.text === 'Like' || /^[\d,]+$/.test(btnText)) {
          if (currentPost) {
            currentPost.likes = (item.text === 'Like') ? '0' : item.text;
            posts.push(currentPost);
            currentPost = null;
          }
          continue;
        }
      }

      // AXStaticText that is purely numeric (with commas) = like count
      if (item.role === 'AXStaticText' && isLikeCount) {
        if (currentPost) {
          currentPost.likes = item.text;
          posts.push(currentPost);
          currentPost = null;
        }
        continue;
      }

      // AXStaticText: alternate between title and author
      if (item.role === 'AXStaticText') {
        if (!currentPost) {
          currentPost = {title: item.text};
        } else if (!currentPost.author) {
          currentPost.author = item.text;
        } else {
          // Previous post didn't get likes, save it and start new
          posts.push(currentPost);
          currentPost = {title: item.text};
        }
      }
    }
    // Don't forget the last post
    if (currentPost) posts.push(currentPost);

    JSON.stringify({nav: nav, posts: posts, totalItems: items.length});
  " 2>&1)

  if [ $? -ne 0 ]; then
    error_exit "Failed to read feed: $result"
  fi
  echo "{\"success\":true,\"action\":\"feed\",\"data\":$result}"
}

# -----------------------------------------------------------------------------
# scroll-feed — Scroll the feed and read new content
# -----------------------------------------------------------------------------
do_scroll_feed() {
  local amount
  amount=$(echo "$INPUT" | jq -r '.amount // 5')
  check_app

  # Focus the app
  osascript -l JavaScript -e "
    var app = Application('System Events');
    var proc = app.processes.byName('$APP_NAME');
    proc.frontmost = true;
  " >/dev/null 2>&1
  sleep 0.3

  # Scroll down
  osascript -l JavaScript -e "
    ObjC.import('CoreGraphics');
    var event = \$.CGEventCreateScrollWheelEvent(null, \$.kCGScrollEventUnitLine, 2, $(( -amount )), 0);
    \$.CGEventPost(\$.kCGHIDEventTap, event);
  " >/dev/null 2>&1
  sleep 0.5

  # Now read the feed
  do_feed
}

# -----------------------------------------------------------------------------
# nav — Read navigation structure
# -----------------------------------------------------------------------------
do_nav() {
  check_app

  local result
  result=$(osascript -l JavaScript -e "
    var app = Application('System Events');
    var proc = app.processes.byName('$APP_NAME');
    $SKIP_DESCS_JS
    var nav = {bottomTabs: [], topTabs: [], categories: [], searchHint: ''};

    function scan(el, depth) {
      if (depth > $MAX_DEPTH) return;
      var role = 'unknown';
      try { role = el.role(); } catch(e) {}

      if (role === 'AXStaticText' || role === 'AXGenericElement') {
        var text = '';
        try { var d = el.description(); if (d && !skipDescs[d.toLowerCase()]) text = d; } catch(e) {}
        if (!text) try { var v = el.value(); if (v) text = String(v); } catch(e) {}

        if (text) {
          var pos = null;
          try { var p = el.position(); pos = {x: p[0], y: p[1]}; } catch(e) {}

          // Bottom tabs are at y > 990
          if (pos && pos.y > 990) {
            nav.bottomTabs.push(text);
          }
          // Top-level tabs (Following, Explore, Video) at depth ~19, y ~186-192
          else if (['Following','Explore','Video'].indexOf(text) >= 0) {
            nav.topTabs.push(text);
          }
          // Category tabs (For You, Live, etc.) at y ~194 in the category bar
          else if (pos && pos.y >= 190 && pos.y <= 250 && depth >= 20) {
            nav.categories.push(text);
          }
        }
      }

      // Check for search hint
      if (role === 'AXGroup') {
        try {
          var desc = el.description();
          if (desc === '搜索' || desc === 'search') {
            nav.searchHint = desc;
          }
        } catch(e) {}
      }

      try {
        var children = el.uiElements();
        for (var i = 0; i < Math.min(children.length, 50); i++) {
          scan(children[i], depth + 1);
        }
      } catch(e) {}
    }

    var windows = proc.windows();
    for (var w = 0; w < windows.length; w++) {
      scan(windows[w], 0);
    }
    JSON.stringify(nav);
  " 2>&1)

  if [ $? -ne 0 ]; then
    error_exit "Failed to read nav: $result"
  fi
  echo "{\"success\":true,\"action\":\"nav\",\"data\":$result}"
}

# -----------------------------------------------------------------------------
# raw — Raw text dump
# -----------------------------------------------------------------------------
do_raw() {
  local limit
  limit=$(echo "$INPUT" | jq -r '.limit // 50')
  check_app

  local result
  result=$(osascript -l JavaScript -e "
    var app = Application('System Events');
    var proc = app.processes.byName('$APP_NAME');
    $SKIP_DESCS_JS
    var texts = [];
    var maxDepth = $MAX_DEPTH;

    function extract(el, depth) {
      if (depth > maxDepth || texts.length >= $limit) return;
      var role = 'unknown';
      try { role = el.role(); } catch(e) {}

      try {
        var val = el.value();
        if (val !== null && val !== undefined && String(val).trim().length > 0) {
          texts.push({role: role, text: String(val).substring(0, 1000)});
        }
      } catch(e) {}
      try {
        var title = el.title();
        if (title && title.trim().length > 0) {
          texts.push({role: role, text: title});
        }
      } catch(e) {}
      try {
        var desc = el.description();
        if (desc && desc.trim().length > 0 && !skipDescs[desc.toLowerCase()]) {
          texts.push({role: role, text: desc});
        }
      } catch(e) {}
      try {
        var children = el.uiElements();
        for (var i = 0; i < Math.min(children.length, 100); i++) {
          extract(children[i], depth + 1);
          if (texts.length >= $limit) return;
        }
      } catch(e) {}
    }

    var windows = proc.windows();
    for (var w = 0; w < windows.length; w++) {
      extract(windows[w], 0);
    }

    // Deduplicate
    var seen = {};
    var unique = [];
    for (var i = 0; i < texts.length; i++) {
      if (!seen[texts[i].text]) {
        seen[texts[i].text] = true;
        unique.push(texts[i]);
      }
    }
    JSON.stringify(unique);
  " 2>&1)

  if [ $? -ne 0 ]; then
    error_exit "Failed to read raw text: $result"
  fi
  echo "{\"success\":true,\"action\":\"raw\",\"texts\":$result}"
}

# -----------------------------------------------------------------------------
# search — Read search results
# -----------------------------------------------------------------------------
do_search() {
  # Search results use the same deep structure, just read the feed
  do_feed
}

# -----------------------------------------------------------------------------
# Dispatch
# -----------------------------------------------------------------------------
case "$ACTION" in
  feed)         do_feed ;;
  scroll-feed)  do_scroll_feed ;;
  nav)          do_nav ;;
  search)       do_search ;;
  raw)          do_raw ;;
  *)            error_exit "Unknown action: $ACTION (use feed, scroll-feed, nav, search, raw)" ;;
esac
