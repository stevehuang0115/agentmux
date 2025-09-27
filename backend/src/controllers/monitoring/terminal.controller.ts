import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ApiResponse } from '../../types/index.js';

export async function listTerminalSessions(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const sessions = await this.tmuxService.listSessions();
    res.json({ success: true, data: sessions } as ApiResponse);
  } catch (error) {
    console.error('Error listing terminal sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to list terminal sessions' } as ApiResponse);
  }
}

export async function captureTerminal(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { sessionName } = req.params as any;
    const { lines } = req.query as any;

    // Limit lines to prevent memory issues and apply strict timeout
    const maxLines = Math.min(parseInt(lines) || 50, 30); // Max 30 lines, default 50 reduced from 100
    const MAX_OUTPUT_SIZE = 2048; // Max 2KB output per request

    // Add timeout to prevent hanging requests
    const output = await Promise.race([
      this.tmuxService.capturePane(sessionName, maxLines),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Terminal capture timeout')), 1500) // 1.5 second timeout
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
    } as ApiResponse);
    
  } catch (error) {
    console.error('Error capturing terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to capture terminal output' } as ApiResponse);
  }
}

export async function sendTerminalInput(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { sessionName } = req.params as any;
    const { input } = req.body as any;
    if (!input) { res.status(400).json({ success: false, error: 'Input is required' } as ApiResponse); return; }
    await this.tmuxService.sendMessage(sessionName, input);
    res.json({ success: true, message: 'Input sent successfully' } as ApiResponse);
  } catch (error) {
    console.error('Error sending terminal input:', error);
    res.status(500).json({ success: false, error: 'Failed to send terminal input' } as ApiResponse);
  }
}

export async function sendTerminalKey(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { sessionName } = req.params as any;
    const { key } = req.body as any;
    if (!key) { res.status(400).json({ success: false, error: 'Key is required' } as ApiResponse); return; }
    await this.tmuxService.sendKey(sessionName, key);
    res.json({ success: true, message: 'Key sent successfully' } as ApiResponse);
  } catch (error) {
    console.error('Error sending terminal key:', error);
    res.status(500).json({ success: false, error: 'Failed to send terminal key' } as ApiResponse);
  }
}
