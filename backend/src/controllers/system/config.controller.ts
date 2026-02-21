import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import * as path from 'path';
import * as fsSync from 'fs';
import { ApiResponse } from '../../types/index.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('ConfigController');

export async function getConfigFile(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { fileName } = req.params as any;
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) { res.status(400).json({ success: false, error: 'Invalid file name' } as ApiResponse); return; }

    // Map specific files to their new subdirectories
    let configPath: string;
    if (fileName === 'available_team_roles.json') {
      configPath = path.join(process.cwd(), 'config', 'teams', fileName);
    } else if (fileName.startsWith('build_') && fileName.endsWith('_prompt.json')) {
      configPath = path.join(process.cwd(), 'config', 'task_starters', fileName);
    } else if (fileName === 'runtime-config.json') {
      configPath = path.join(process.cwd(), 'config', 'runtime_scripts', fileName);
    } else {
      // For other files, check in the root config directory first
      configPath = path.join(process.cwd(), 'config', fileName);
    }

    if (!fsSync.existsSync(configPath)) { res.status(404).json({ success: false, error: `Config file ${fileName} not found` } as ApiResponse); return; }
    const fileContent = fsSync.readFileSync(configPath, 'utf8');
    if (fileName.endsWith('.json')) {
      try { const jsonContent = JSON.parse(fileContent); res.json(jsonContent); }
      catch { res.status(500).json({ success: false, error: 'Invalid JSON format in config file' } as ApiResponse); }
    } else {
      res.json({ success: true, data: { content: fileContent }, message: `Config file ${fileName} retrieved successfully` } as ApiResponse);
    }
  } catch (error) {
    logger.error('Error getting config file', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to get config file' } as ApiResponse);
  }
}
