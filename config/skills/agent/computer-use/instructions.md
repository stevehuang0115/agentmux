# Desktop Automation (Computer Use)

Control the macOS desktop by taking screenshots, moving/clicking the mouse, and typing text.

## Actions

### Screenshot
Capture the screen (or a region) to an image file.

```bash
bash execute.sh '{"action":"screenshot"}'
bash execute.sh '{"action":"screenshot","output":"/tmp/my-screenshot.png"}'
```

### Move Mouse
Move the mouse cursor to a specific coordinate.

```bash
bash execute.sh '{"action":"move","x":500,"y":300}'
```

### Click
Click at a specific coordinate. Supports left click, right click, and double click.

```bash
bash execute.sh '{"action":"click","x":500,"y":300}'
bash execute.sh '{"action":"click","x":500,"y":300,"button":"right"}'
bash execute.sh '{"action":"click","x":500,"y":300,"button":"double"}'
```

### Type Text
Type a string of text using simulated keystrokes.

```bash
bash execute.sh '{"action":"type","text":"Hello, world!"}'
```

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `action`  | Yes      | -       | One of: `screenshot`, `move`, `click`, `type` |
| `x`       | For move/click | - | X coordinate (pixels from left) |
| `y`       | For move/click | - | Y coordinate (pixels from top) |
| `button`  | No       | `left`  | Click button: `left`, `right`, or `double` |
| `text`    | For type | -       | Text string to type |
| `output`  | No       | `/tmp/screenshot.png` | Screenshot output file path |

## Requirements

- macOS (uses native `screencapture` and CoreGraphics)
- Accessibility permissions must be granted to the terminal app (System Settings > Privacy & Security > Accessibility)

## Typical Workflow

1. Take a screenshot to see the current screen state
2. Identify the coordinates of the target element
3. Move the mouse and/or click on the target
4. Optionally type text into a focused field
5. Take another screenshot to verify the result
