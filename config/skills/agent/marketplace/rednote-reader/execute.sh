#!/bin/bash
# =============================================================================
# RedNote (小红书) Reader Skill
# Two modes of operation:
#   1. iPad App (Accessibility API) — feed, scroll-feed, nav, raw
#   2. Web API (curl + cookies) — list-notes, read-post (lowest token cost)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

APP_NAME="discover"
MAX_DEPTH=28
COOKIE_FILE="${HOME}/.mcp/rednote/cookies.json"
XHS_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"action\":\"list-notes|read-post|feed|scroll-feed|nav|raw\"}'"

ACTION=$(echo "$INPUT" | jq -r '.action // empty')
require_param "action" "$ACTION"

# =============================================================================
# Web API Mode — uses curl + cookies (lowest token cost, no Playwright)
# =============================================================================

# Build cookie header string from cookies.json
build_cookie_header() {
  if [ ! -f "$COOKIE_FILE" ]; then
    error_exit "Cookies not found at $COOKIE_FILE. Log in via browser first."
  fi
  python3 -c "
import json, sys
cookies = json.load(open('$COOKIE_FILE'))
print('; '.join(f\"{c['name']}={c['value']}\" for c in cookies))
" 2>/dev/null || error_exit "Failed to parse cookies from $COOKIE_FILE"
}

# Get user ID from cookies
get_user_id() {
  local uid
  uid=$(echo "$INPUT" | jq -r '.userId // empty')
  if [ -n "$uid" ]; then
    echo "$uid"
    return
  fi
  python3 -c "
import json
cookies = json.load(open('$COOKIE_FILE'))
uid = [c['value'] for c in cookies if c['name'] == 'x-user-id-creator.xiaohongshu.com']
print(uid[0] if uid else '')
" 2>/dev/null
}

# -----------------------------------------------------------------------------
# list-notes — Get user's notes via web API (titles, IDs, stats, xsecTokens)
# -----------------------------------------------------------------------------
do_list_notes() {
  local cookies user_id
  cookies=$(build_cookie_header)
  user_id=$(get_user_id)
  [ -z "$user_id" ] && error_exit "No userId found. Pass userId param or ensure x-user-id-creator cookie exists."

  local html
  html=$(curl -s "https://www.xiaohongshu.com/user/profile/${user_id}" \
    -H "User-Agent: ${XHS_USER_AGENT}" \
    -H "Cookie: ${cookies}" \
    -H "Referer: https://www.xiaohongshu.com/" 2>/dev/null)

  [ -z "$html" ] && error_exit "Empty response from profile page"

  local result
  result=$(python3 -c "
import json, re, sys

html = sys.stdin.read()
match = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.+?})\s*</script>', html, re.DOTALL)
if not match:
    print(json.dumps({'error': 'No __INITIAL_STATE__ found. Page may be blocked or cookies expired.'}))
    sys.exit(0)

raw = match.group(1)
raw = re.sub(r'\bundefined\b', 'null', raw)
data = json.loads(raw)

# notes[0] contains the array of note card wrappers
all_notes = data.get('user', {}).get('notes', [[]])
note_cards = all_notes[0] if all_notes and isinstance(all_notes[0], list) else []

# user info
user_info = data.get('user', {}).get('userPageData', {})
nickname = user_info.get('basicInfo', {}).get('nickname', '')
desc = user_info.get('basicInfo', {}).get('desc', '')
fans = user_info.get('interactions', [{}])[0].get('count', '?') if user_info.get('interactions') else '?'

notes = []
for item in note_cards:
    nc = item.get('noteCard', {})
    ii = nc.get('interactInfo', {})
    notes.append({
        'noteId': nc.get('noteId', item.get('id', '')),
        'title': nc.get('displayTitle', ''),
        'type': nc.get('type', 'unknown'),
        'likes': ii.get('likedCount', '0'),
        'pinned': ii.get('sticky', False),
        'xsecToken': nc.get('xsecToken', item.get('xsecToken', ''))
    })

print(json.dumps({
    'userId': '${user_id}',
    'nickname': nickname,
    'desc': desc,
    'totalNotes': len(notes),
    'notes': notes
}, ensure_ascii=False))
" <<< "$html" 2>/dev/null)

  if echo "$result" | jq -e '.error' >/dev/null 2>&1; then
    error_exit "$(echo "$result" | jq -r '.error')"
  fi
  echo "{\"success\":true,\"action\":\"list-notes\",\"data\":$result}"
}

# -----------------------------------------------------------------------------
# read-post — Read full post content via web API (body, tags, comments, images)
# -----------------------------------------------------------------------------
do_read_post() {
  local note_id xsec_token cookies user_id
  note_id=$(echo "$INPUT" | jq -r '.noteId // empty')
  require_param "noteId" "$note_id"

  xsec_token=$(echo "$INPUT" | jq -r '.xsecToken // empty')
  require_param "xsecToken" "$xsec_token"

  cookies=$(build_cookie_header)
  user_id=$(get_user_id)

  local referer="https://www.xiaohongshu.com/"
  [ -n "$user_id" ] && referer="https://www.xiaohongshu.com/user/profile/${user_id}"

  local html
  html=$(curl -s "https://www.xiaohongshu.com/explore/${note_id}?xsec_token=${xsec_token}&xsec_source=pc_user" \
    -H "User-Agent: ${XHS_USER_AGENT}" \
    -H "Cookie: ${cookies}" \
    -H "Referer: ${referer}" 2>/dev/null)

  [ -z "$html" ] && error_exit "Empty response from note page"

  local result
  result=$(python3 -c "
import json, re, sys

html = sys.stdin.read()

# Check for anti-scraping block
if '/404/sec_' in html or len(html) < 500:
    print(json.dumps({'error': 'Note page blocked by anti-scraping. xsecToken may be expired.'}))
    sys.exit(0)

match = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.+?})\s*</script>', html, re.DOTALL)
if not match:
    print(json.dumps({'error': 'No __INITIAL_STATE__ found in note page'}))
    sys.exit(0)

raw = match.group(1)
raw = re.sub(r'\bundefined\b', 'null', raw)
data = json.loads(raw)

note_map = data.get('note', {}).get('noteDetailMap', {})
note_key = list(note_map.keys())[0] if note_map else None
if not note_key:
    print(json.dumps({'error': 'No note detail in __INITIAL_STATE__'}))
    sys.exit(0)

note = note_map[note_key].get('note', {})
ii = note.get('interactInfo', {})
tags = [t.get('name', '') for t in note.get('tagList', []) if t.get('name')]

# Extract image URLs
images = []
for img in note.get('imageList', []):
    url = img.get('urlDefault', img.get('url', ''))
    if url:
        images.append(url)

# Extract video URL if present
video = None
video_info = note.get('video', {})
if video_info:
    media = video_info.get('media', {})
    streams = media.get('stream', {})
    for quality in ['h264', 'h265', 'av1']:
        stream_list = streams.get(quality, [])
        if stream_list:
            video = stream_list[0].get('masterUrl', '')
            if video:
                break

# Author info
user = note.get('user', {})

result = {
    'noteId': note.get('noteId', '${note_id}'),
    'title': note.get('title', ''),
    'body': note.get('desc', ''),
    'type': note.get('type', 'unknown'),
    'author': user.get('nickname', user.get('nickName', '')),
    'authorId': user.get('userId', ''),
    'likes': ii.get('likedCount', '0'),
    'collects': ii.get('collectedCount', '0'),
    'comments': ii.get('commentCount', '0'),
    'shares': ii.get('shareCount', '0'),
    'tags': tags,
    'imageCount': len(images),
    'hasVideo': video is not None,
}

print(json.dumps(result, ensure_ascii=False))
" <<< "$html" 2>/dev/null)

  if echo "$result" | jq -e '.error' >/dev/null 2>&1; then
    error_exit "$(echo "$result" | jq -r '.error')"
  fi
  echo "{\"success\":true,\"action\":\"read-post\",\"data\":$result}"
}

# =============================================================================
# iPad App Mode — uses Accessibility API (requires app running on macOS)
# =============================================================================

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
  # Web API actions (low token cost, recommended)
  list-notes)   do_list_notes ;;
  read-post)    do_read_post ;;
  # iPad App actions (Accessibility API)
  feed)         do_feed ;;
  scroll-feed)  do_scroll_feed ;;
  nav)          do_nav ;;
  search)       do_search ;;
  raw)          do_raw ;;
  *)            error_exit "Unknown action: $ACTION (use list-notes, read-post, feed, scroll-feed, nav, search, raw)" ;;
esac
