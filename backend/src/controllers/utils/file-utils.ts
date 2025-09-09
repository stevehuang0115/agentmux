export function getFileIcon(fileName: string, isDirectory: boolean): string {
  if (isDirectory) {
    if (fileName === '.agentmux') return '⚙️';
    if (fileName === 'node_modules') return '📦';
    if (fileName === '.git') return '🔗';
    if (fileName === 'src' || fileName === 'source') return '📁';
    if (fileName === 'test' || fileName === 'tests' || fileName === '__tests__') return '🧪';
    if (fileName === 'docs' || fileName === 'documentation') return '📚';
    if (fileName === 'assets' || fileName === 'images') return '🖼️';
    if (fileName === 'components') return '🧩';
    if (fileName === 'lib' || fileName === 'libs') return '📚';
    if (fileName === 'config') return '⚙️';
    if (fileName === 'scripts') return '📜';
    if (fileName === 'dist' || fileName === 'build') return '📦';
    return '📁';
  } else {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': case 'jsx': return '📄';
      case 'ts': case 'tsx': return '🔵';
      case 'py': return '🐍';
      case 'java': return '☕';
      case 'cpp': case 'c': case 'cc': return '⚙️';
      case 'rs': return '🦀';
      case 'go': return '🐹';
      case 'rb': return '💎';
      case 'php': return '🐘';
      case 'html': case 'htm': return '🌐';
      case 'css': case 'scss': case 'sass': case 'less': return '🎨';
      case 'json': case 'yaml': case 'yml': case 'toml': return '⚙️';
      case 'md': case 'markdown': return '📝';
      case 'txt': case 'log': return '📄';
      case 'pdf': return '📕';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return '🖼️';
      case 'mp4': case 'avi': case 'mov': return '🎬';
      case 'mp3': case 'wav': case 'flac': return '🎵';
      case 'zip': case 'tar': case 'gz': case 'rar': return '📦';
      case 'lock': return '🔒';
      case 'env': return '🔐';
      case 'dockerfile': return '🐳';
      case 'sh': case 'bash': case 'zsh': return '📜';
      case 'gitignore': return '🚫';
      default: return '📄';
    }
  }
}

export function countFiles(tree: any[]): number {
  let count = 0;
  for (const node of tree) {
    if (node.type === 'file') {
      count++;
    } else if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}

