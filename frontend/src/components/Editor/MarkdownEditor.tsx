import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  placeholder?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  onSave,
  readOnly = false,
  placeholder = 'Start writing...'
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [renderedContent, setRenderedContent] = useState('');

  useEffect(() => {
    if (isPreviewMode) {
      renderMarkdown(content);
    }
  }, [content, isPreviewMode]);

  const renderMarkdown = async (markdown: string) => {
    try {
      // Simple markdown rendering - in a real app you'd use a library like marked
      let html = markdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/!\[([^\]]*)\]\(([^\)]*)\)/gim, '<img src="$2" alt="$1" />')
        .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>')
        .replace(/`([^`]*)`/gim, '<code>$1</code>')
        .replace(/```([^`]*)```/gim, '<pre><code>$1</code></pre>')
        .replace(/\n$/gim, '<br />')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

      // Wrap consecutive <li> elements in <ul> or <ol>
      html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
      html = html.replace(/<\/ul>\s*<ul>/gim, '');

      // Sanitize HTML to prevent XSS attacks
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em',
                       'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
        ALLOW_DATA_ATTR: false
      });

      setRenderedContent(sanitizedHtml);
    } catch (error) {
      console.error('Error rendering markdown:', error);
      setRenderedContent('Error rendering markdown preview');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      onChange(newContent);
      
      // Restore cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }

    // Handle Ctrl+S for save
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (onSave) {
        onSave();
      }
    }

    // Handle Ctrl+B for bold
    if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      insertMarkdown('**', '**');
    }

    // Handle Ctrl+I for italic
    if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      insertMarkdown('*', '*');
    }
  };

  const insertMarkdown = (before: string, after: string) => {
    const textarea = document.querySelector('.markdown-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    onChange(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selectedText.length;
      } else {
        textarea.selectionStart = textarea.selectionEnd = start + before.length;
      }
    }, 0);
  };

  const insertHeader = (level: number) => {
    const prefix = '#'.repeat(level) + ' ';
    const textarea = document.querySelector('.markdown-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    
    onChange(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    }, 0);
  };

  const insertList = (ordered = false) => {
    const prefix = ordered ? '1. ' : '- ';
    const textarea = document.querySelector('.markdown-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    
    onChange(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    }, 0);
  };

  return (
    <div className="markdown-editor">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            className="toolbar-button"
            onClick={() => insertHeader(1)}
            title="Header 1"
            disabled={readOnly}
          >
            H1
          </button>
          <button
            className="toolbar-button"
            onClick={() => insertHeader(2)}
            title="Header 2"
            disabled={readOnly}
          >
            H2
          </button>
          <button
            className="toolbar-button"
            onClick={() => insertHeader(3)}
            title="Header 3"
            disabled={readOnly}
          >
            H3
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="toolbar-button"
            onClick={() => insertMarkdown('**', '**')}
            title="Bold (Ctrl+B)"
            disabled={readOnly}
          >
            B
          </button>
          <button
            className="toolbar-button"
            onClick={() => insertMarkdown('*', '*')}
            title="Italic (Ctrl+I)"
            disabled={readOnly}
          >
            I
          </button>
          <button
            className="toolbar-button"
            onClick={() => insertMarkdown('`', '`')}
            title="Code"
            disabled={readOnly}
          >
            &lt;/&gt;
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="toolbar-button"
            onClick={() => insertList(false)}
            title="Bullet List"
            disabled={readOnly}
          >
            • List
          </button>
          <button
            className="toolbar-button"
            onClick={() => insertList(true)}
            title="Numbered List"
            disabled={readOnly}
          >
            1. List
          </button>
          <button
            className="toolbar-button"
            onClick={() => insertMarkdown('\n> ', '')}
            title="Quote"
            disabled={readOnly}
          >
            Quote
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="toolbar-button"
            onClick={() => insertMarkdown('[', '](url)')}
            title="Link"
            disabled={readOnly}
          >
            Link
          </button>
          <button
            className="toolbar-button"
            onClick={() => insertMarkdown('![', '](url)')}
            title="Image"
            disabled={readOnly}
          >
            Image
          </button>
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-group">
          <button
            className={`toolbar-button ${!isPreviewMode ? 'active' : ''}`}
            onClick={() => setIsPreviewMode(false)}
          >
            Edit
          </button>
          <button
            className={`toolbar-button ${isPreviewMode ? 'active' : ''}`}
            onClick={() => setIsPreviewMode(true)}
          >
            Preview
          </button>
        </div>

        {onSave && (
          <div className="toolbar-group">
            <button
              className="toolbar-button save-button"
              onClick={onSave}
              title="Save (Ctrl+S)"
            >
              Save
            </button>
          </div>
        )}
      </div>

      <div className="editor-content">
        {isPreviewMode ? (
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        ) : (
          <textarea
            className="markdown-textarea"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            spellCheck={false}
          />
        )}
      </div>

      <div className="editor-status">
        <span className="word-count">
          {content.split(/\s+/).filter(word => word.length > 0).length} words
        </span>
        <span className="char-count">
          {content.length} characters
        </span>
      </div>
    </div>
  );
};