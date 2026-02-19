# Send PDF to Slack

Converts a markdown file to PDF using `pandoc` and uploads it to a Slack channel via the `/api/slack/upload-file` endpoint.

## Prerequisites

- **pandoc** must be installed (`brew install pandoc` on macOS, `sudo apt-get install pandoc` on Linux)
- A **LaTeX engine** is required for PDF output (e.g. `brew install basictex` on macOS, `sudo apt-get install texlive` on Linux)

## Usage

```bash
bash config/skills/orchestrator/send-pdf-to-slack/execute.sh --channel C0123ABC --file /path/to/document.md --title "Weekly Report"
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--channel`, `-c` | Yes | Slack channel ID to upload the PDF to |
| `--file`, `-f` | Yes | Path to the markdown file to convert |
| `--title`, `-T` | No | Title for the uploaded PDF (defaults to filename) |
| `--text`, `-t` | No | Initial comment to include with the upload |
| `--thread`, `-r` | No | Slack thread timestamp for threaded upload |

## Examples

```bash
# Basic upload
bash execute.sh --channel C0123ABC --file report.md

# Upload with title and comment
bash execute.sh --channel C0123ABC --file report.md --title "Q4 Report" --text "Here is the quarterly report"

# Upload in a thread
bash execute.sh --channel C0123ABC --file notes.md --thread 1707123456.789000
```

## Output

JSON response from the upload API with `fileId` on success. Also emits a `[NOTIFY]` block for chat service integration.

## Error Handling

- Exits with error if `pandoc` is not installed (includes install instructions)
- Exits with error if the markdown file does not exist
- Exits with error if PDF conversion fails
- Temp PDF files are cleaned up after upload (stored in `~/.crewly/tmp/slack-pdfs/`)
