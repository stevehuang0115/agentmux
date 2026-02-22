# RedNote (小红书) Reader

Read content from the 小红书 (RedNote) macOS iPad app using the Accessibility API — no screenshots needed.

## Prerequisites

- The 小红书 app (bundle ID: `com.xingin.discover`, process name: `discover`) must be running
- Accessibility permission must be granted to the terminal app (System Settings > Privacy & Security > Accessibility)

## Actions

### feed — Read the current feed

Returns structured post data from the current feed view.

```bash
bash execute.sh '{"action":"feed"}'
bash execute.sh '{"action":"feed","limit":20}'
```

**Output:** Array of posts with `title`, `author`, `likes` fields, plus navigation context (current tab, categories).

### scroll-feed — Scroll and read more

Scrolls the feed down and reads new content.

```bash
bash execute.sh '{"action":"scroll-feed"}'
bash execute.sh '{"action":"scroll-feed","amount":5}'
```

### nav — Read navigation structure

Returns the app's navigation tabs, categories, and current state.

```bash
bash execute.sh '{"action":"nav"}'
```

### search — Read search results (after manually searching)

Reads content from the search results view.

```bash
bash execute.sh '{"action":"search"}'
```

### raw — Raw text dump (all visible text)

Returns all text content without parsing into structured posts.

```bash
bash execute.sh '{"action":"raw"}'
```

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `action`  | Yes      | -       | One of: `feed`, `scroll-feed`, `nav`, `search`, `raw` |
| `limit`   | No       | `50`    | Max number of text items to return |
| `amount`  | No       | `5`     | Scroll amount (for scroll-feed) |

## Technical Notes

- The 小红书 iPad app has a very deep UI hierarchy (25+ levels)
- Text content is in `AXDescription` attributes, not `AXValue`
- The process name is `discover` (not "小红书" or "rednote")
- Feed posts follow a pattern: AXStaticText(title) → AXStaticText(author) → AXButton(likes)

## Typical Workflow

1. Run `nav` to see current state (which tab is active)
2. Run `feed` to read visible posts
3. Run `scroll-feed` to load more content
4. Repeat `feed` to read newly loaded posts
