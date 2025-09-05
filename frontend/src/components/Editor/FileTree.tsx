import React, { useState, useEffect } from 'react';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
  expanded?: boolean;
}

interface FileTreeProps {
  projectPath: string;
  onFileSelect: (filePath: string) => void;
  selectedFile?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({
  projectPath,
  onFileSelect,
  selectedFile
}) => {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectPath) {
      fetchFileTree();
    }
  }, [projectPath]);

  const fetchFileTree = async () => {
    try {
      const response = await fetch(`/api/files/tree?path=${encodeURIComponent(projectPath)}`);
      if (response.ok) {
        const treeData = await response.json();
        setFileTree(treeData);
      }
    } catch (error) {
      console.error('Error fetching file tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = async (node: FileNode) => {
    if (node.type !== 'directory') return;

    const updateTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(n => {
        if (n.path === node.path) {
          return { ...n, expanded: !n.expanded };
        }
        if (n.children) {
          return { ...n, children: updateTree(n.children) };
        }
        return n;
      });
    };

    setFileTree(updateTree(fileTree));

    // If expanding and children not loaded, fetch them
    if (!node.expanded && !node.children?.length) {
      try {
        const response = await fetch(`/api/files/tree?path=${encodeURIComponent(node.path)}`);
        if (response.ok) {
          const childrenData = await response.json();
          const updateTreeWithChildren = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(n => {
              if (n.path === node.path) {
                return { ...n, children: childrenData, expanded: true };
              }
              if (n.children) {
                return { ...n, children: updateTreeWithChildren(n.children) };
              }
              return n;
            });
          };
          setFileTree(updateTreeWithChildren(fileTree));
        }
      } catch (error) {
        console.error('Error fetching directory contents:', error);
      }
    }
  };

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return node.expanded ? '📂' : '📁';
    }
    
    const extension = node.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
        return '📄';
      case 'ts':
      case 'tsx':
        return '📘';
      case 'css':
      case 'scss':
        return '🎨';
      case 'html':
        return '🌐';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'py':
        return '🐍';
      case 'java':
        return '☕';
      case 'cpp':
      case 'c':
        return '⚙️';
      case 'yml':
      case 'yaml':
        return '⚙️';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return '🖼️';
      default:
        return '📄';
    }
  };

  const renderNode = (node: FileNode, depth = 0): React.ReactNode => {
    const isSelected = selectedFile === node.path;
    const paddingLeft = depth * 20 + 8;

    return (
      <div key={node.path}>
        <div
          className={`file-tree-node ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleDirectory(node);
            } else {
              onFileSelect(node.path);
            }
          }}
        >
          <span className="file-icon">{getFileIcon(node)}</span>
          <span className="file-name">{node.name}</span>
          {node.type === 'directory' && (
            <span className="expand-icon">
              {node.expanded ? '▼' : '▶'}
            </span>
          )}
        </div>
        {node.type === 'directory' && node.expanded && node.children && (
          <div className="directory-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="file-tree">
        <div className="file-tree-header">
          <h3>Project Files</h3>
        </div>
        <div className="loading-state">Loading file tree...</div>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <h3>Project Files</h3>
        <button 
          className="refresh-button"
          onClick={fetchFileTree}
        >
          🔄
        </button>
      </div>
      <div className="file-tree-content">
        {fileTree.length > 0 ? (
          fileTree.map(node => renderNode(node))
        ) : (
          <div className="empty-state">
            <p>No files found</p>
          </div>
        )}
      </div>
    </div>
  );
};