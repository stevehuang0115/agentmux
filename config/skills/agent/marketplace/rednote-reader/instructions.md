# RedNote (小红书) Reader

Two modes of operation:
1. **Web API** (recommended) — `list-notes`, `read-post` — uses curl + cookies, lowest token cost
2. **iPad App** — `feed`, `scroll-feed`, `nav`, `raw` — uses macOS Accessibility API

## Prerequisites

### Web API Mode
- Chrome cookies exported to `~/.mcp/rednote/cookies.json` (use pycookiecheat)
- User must be logged into xiaohongshu.com in Chrome

### iPad App Mode
- The 小红书 app (bundle ID: `com.xingin.discover`, process name: `discover`) must be running
- Accessibility permission granted to terminal (System Settings > Privacy & Security > Accessibility)

## Web API Actions (Recommended)

### list-notes — Get user's published notes

Returns all notes with IDs, titles, stats, and xsecTokens needed for `read-post`.

```bash
bash execute.sh '{"action":"list-notes"}'
bash execute.sh '{"action":"list-notes","userId":"66a127670000000024021b32"}'
```

**Output:** `userId`, `nickname`, `totalNotes`, and array of notes with `noteId`, `title`, `type`, `likes`, `pinned`, `xsecToken`.

### read-post — Read full post content

Reads the complete body text, tags, interaction stats. Requires `noteId` and `xsecToken` from `list-notes`.

```bash
bash execute.sh '{"action":"read-post","noteId":"691d3754000000001e02e518","xsecToken":"ABjPmMojTRo..."}'
```

**Output:** `title`, `body` (full text), `type`, `author`, `likes`, `collects`, `comments`, `shares`, `tags`, `imageCount`, `hasVideo`.

### Typical Web API Workflow

1. Run `list-notes` to get all user notes with IDs and xsecTokens
2. Pick a note and run `read-post` with its `noteId` and `xsecToken`
3. Repeat for additional notes as needed

## iPad App Actions

### feed — Read the current feed

```bash
bash execute.sh '{"action":"feed"}'
bash execute.sh '{"action":"feed","limit":20}'
```

### scroll-feed — Scroll and read more

```bash
bash execute.sh '{"action":"scroll-feed","amount":5}'
```

### nav — Read navigation structure

```bash
bash execute.sh '{"action":"nav"}'
```

### raw — Raw text dump

```bash
bash execute.sh '{"action":"raw","limit":100}'
```

## Parameters

| Parameter   | Required | Default | Description |
|-------------|----------|---------|-------------|
| `action`    | Yes      | -       | `list-notes`, `read-post`, `feed`, `scroll-feed`, `nav`, `search`, `raw` |
| `noteId`    | read-post| -       | Note ID from `list-notes` |
| `xsecToken` | read-post| -      | Security token from `list-notes` |
| `userId`    | No       | auto    | User ID (auto-detected from cookies if omitted) |
| `limit`     | No       | `50`    | Max text items (iPad app actions) |
| `amount`    | No       | `5`     | Scroll amount (scroll-feed only) |

## Technical Notes

- Web API uses `__INITIAL_STATE__` server-rendered JSON in page HTML
- `xsecToken` is per-note, obtained from profile page, required to access note pages
- iPad app text is in `AXDescription` attributes, not `AXValue`
- Post body text is NOT accessible via Accessibility API (custom rendering, AXNumberOfCharacters=0)
- Use `read-post` (web API) to get post body content
