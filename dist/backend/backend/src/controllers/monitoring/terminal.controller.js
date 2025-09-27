export async function listTerminalSessions(req, res) {
    try {
        const sessions = await this.tmuxService.listSessions();
        res.json({ success: true, data: sessions });
    }
    catch (error) {
        console.error('Error listing terminal sessions:', error);
        res.status(500).json({ success: false, error: 'Failed to list terminal sessions' });
    }
}
export async function captureTerminal(req, res) {
    try {
        const { sessionName } = req.params;
        const { lines } = req.query;
        // Limit lines to prevent memory issues and apply strict timeout
        const maxLines = Math.min(parseInt(lines) || 50, 30); // Max 30 lines, default 50 reduced from 100
        const MAX_OUTPUT_SIZE = 2048; // Max 2KB output per request
        // Add timeout to prevent hanging requests
        const output = await Promise.race([
            this.tmuxService.capturePane(sessionName, maxLines),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Terminal capture timeout')), 1500) // 1.5 second timeout
            )
        ]).catch((error) => {
            console.warn(`Terminal capture failed for session ${sessionName}:`, error.message);
            return ''; // Return empty output on timeout/error
        });
        // Limit output size to prevent memory issues
        const trimmedOutput = output.length > MAX_OUTPUT_SIZE
            ? '...' + output.substring(output.length - MAX_OUTPUT_SIZE + 3)
            : output;
        res.json({
            success: true,
            data: {
                output: trimmedOutput,
                sessionName,
                lines: maxLines,
                truncated: output.length > MAX_OUTPUT_SIZE
            }
        });
    }
    catch (error) {
        console.error('Error capturing terminal:', error);
        res.status(500).json({ success: false, error: 'Failed to capture terminal output' });
    }
}
export async function sendTerminalInput(req, res) {
    try {
        const { sessionName } = req.params;
        const { input } = req.body;
        if (!input) {
            res.status(400).json({ success: false, error: 'Input is required' });
            return;
        }
        await this.tmuxService.sendMessage(sessionName, input);
        res.json({ success: true, message: 'Input sent successfully' });
    }
    catch (error) {
        console.error('Error sending terminal input:', error);
        res.status(500).json({ success: false, error: 'Failed to send terminal input' });
    }
}
export async function sendTerminalKey(req, res) {
    try {
        const { sessionName } = req.params;
        const { key } = req.body;
        if (!key) {
            res.status(400).json({ success: false, error: 'Key is required' });
            return;
        }
        await this.tmuxService.sendKey(sessionName, key);
        res.json({ success: true, message: 'Key sent successfully' });
    }
    catch (error) {
        console.error('Error sending terminal key:', error);
        res.status(500).json({ success: false, error: 'Failed to send terminal key' });
    }
}
//# sourceMappingURL=terminal.controller.js.map