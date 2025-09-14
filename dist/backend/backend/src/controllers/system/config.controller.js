import * as path from 'path';
import * as fsSync from 'fs';
export async function getConfigFile(req, res) {
    try {
        const { fileName } = req.params;
        if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
            res.status(400).json({ success: false, error: 'Invalid file name' });
            return;
        }
        const configPath = path.join(process.cwd(), 'config', fileName);
        if (!fsSync.existsSync(configPath)) {
            res.status(404).json({ success: false, error: `Config file ${fileName} not found` });
            return;
        }
        const fileContent = fsSync.readFileSync(configPath, 'utf8');
        if (fileName.endsWith('.json')) {
            try {
                const jsonContent = JSON.parse(fileContent);
                res.json(jsonContent);
            }
            catch {
                res.status(500).json({ success: false, error: 'Invalid JSON format in config file' });
            }
        }
        else {
            res.json({ success: true, data: { content: fileContent }, message: `Config file ${fileName} retrieved successfully` });
        }
    }
    catch (error) {
        console.error('Error getting config file:', error);
        res.status(500).json({ success: false, error: 'Failed to get config file' });
    }
}
//# sourceMappingURL=config.controller.js.map