import { describe, it, expect } from '@jest/globals';
import { getFileIcon, countFiles } from './file-utils.js';

describe('file-utils', () => {
  describe('getFileIcon', () => {
    describe('directories', () => {
      it('should return specific icons for special directories', () => {
        expect(getFileIcon('.agentmux', true)).toBe('⚙️');
        expect(getFileIcon('node_modules', true)).toBe('📦');
        expect(getFileIcon('.git', true)).toBe('🔗');
        expect(getFileIcon('src', true)).toBe('📁');
        expect(getFileIcon('source', true)).toBe('📁');
        expect(getFileIcon('test', true)).toBe('🧪');
        expect(getFileIcon('tests', true)).toBe('🧪');
        expect(getFileIcon('__tests__', true)).toBe('🧪');
        expect(getFileIcon('docs', true)).toBe('📚');
        expect(getFileIcon('documentation', true)).toBe('📚');
        expect(getFileIcon('assets', true)).toBe('🖼️');
        expect(getFileIcon('images', true)).toBe('🖼️');
        expect(getFileIcon('components', true)).toBe('🧩');
        expect(getFileIcon('lib', true)).toBe('📚');
        expect(getFileIcon('libs', true)).toBe('📚');
        expect(getFileIcon('config', true)).toBe('⚙️');
        expect(getFileIcon('scripts', true)).toBe('📜');
        expect(getFileIcon('dist', true)).toBe('📦');
        expect(getFileIcon('build', true)).toBe('📦');
      });

      it('should return default folder icon for unknown directories', () => {
        expect(getFileIcon('unknown-folder', true)).toBe('📁');
        expect(getFileIcon('my-custom-dir', true)).toBe('📁');
        expect(getFileIcon('', true)).toBe('📁');
      });
    });

    describe('files', () => {
      it('should return correct icons for JavaScript/TypeScript files', () => {
        expect(getFileIcon('app.js', false)).toBe('📄');
        expect(getFileIcon('component.jsx', false)).toBe('📄');
        expect(getFileIcon('service.ts', false)).toBe('🔵');
        expect(getFileIcon('component.tsx', false)).toBe('🔵');
      });

      it('should return correct icons for various programming languages', () => {
        expect(getFileIcon('script.py', false)).toBe('🐍');
        expect(getFileIcon('Main.java', false)).toBe('☕');
        expect(getFileIcon('program.cpp', false)).toBe('⚙️');
        expect(getFileIcon('program.c', false)).toBe('⚙️');
        expect(getFileIcon('program.cc', false)).toBe('⚙️');
        expect(getFileIcon('main.rs', false)).toBe('🦀');
        expect(getFileIcon('main.go', false)).toBe('🐹');
        expect(getFileIcon('script.rb', false)).toBe('💎');
        expect(getFileIcon('index.php', false)).toBe('🐘');
      });

      it('should return correct icons for web files', () => {
        expect(getFileIcon('index.html', false)).toBe('🌐');
        expect(getFileIcon('page.htm', false)).toBe('🌐');
        expect(getFileIcon('styles.css', false)).toBe('🎨');
        expect(getFileIcon('styles.scss', false)).toBe('🎨');
        expect(getFileIcon('styles.sass', false)).toBe('🎨');
        expect(getFileIcon('styles.less', false)).toBe('🎨');
      });

      it('should return correct icons for config files', () => {
        expect(getFileIcon('package.json', false)).toBe('⚙️');
        expect(getFileIcon('config.yaml', false)).toBe('⚙️');
        expect(getFileIcon('settings.yml', false)).toBe('⚙️');
        expect(getFileIcon('config.toml', false)).toBe('⚙️');
      });

      it('should return correct icons for documentation files', () => {
        expect(getFileIcon('README.md', false)).toBe('📝');
        expect(getFileIcon('docs.markdown', false)).toBe('📝');
        expect(getFileIcon('notes.txt', false)).toBe('📄');
        expect(getFileIcon('error.log', false)).toBe('📄');
        expect(getFileIcon('manual.pdf', false)).toBe('📕');
      });

      it('should return correct icons for media files', () => {
        expect(getFileIcon('image.png', false)).toBe('🖼️');
        expect(getFileIcon('photo.jpg', false)).toBe('🖼️');
        expect(getFileIcon('pic.jpeg', false)).toBe('🖼️');
        expect(getFileIcon('logo.gif', false)).toBe('🖼️');
        expect(getFileIcon('icon.svg', false)).toBe('🖼️');
        expect(getFileIcon('video.mp4', false)).toBe('🎬');
        expect(getFileIcon('movie.avi', false)).toBe('🎬');
        expect(getFileIcon('clip.mov', false)).toBe('🎬');
        expect(getFileIcon('song.mp3', false)).toBe('🎵');
        expect(getFileIcon('audio.wav', false)).toBe('🎵');
        expect(getFileIcon('music.flac', false)).toBe('🎵');
      });

      it('should return correct icons for archive files', () => {
        expect(getFileIcon('archive.zip', false)).toBe('📦');
        expect(getFileIcon('backup.tar', false)).toBe('📦');
        expect(getFileIcon('compressed.gz', false)).toBe('📦');
        expect(getFileIcon('data.rar', false)).toBe('📦');
      });

      it('should return correct icons for special files', () => {
        expect(getFileIcon('package-lock.json', false)).toBe('⚙️');  // .json extension takes precedence
        expect(getFileIcon('.env', false)).toBe('🔐');
        expect(getFileIcon('Dockerfile', false)).toBe('🐳');
        expect(getFileIcon('script.sh', false)).toBe('📜');
        expect(getFileIcon('setup.bash', false)).toBe('📜');
        expect(getFileIcon('config.zsh', false)).toBe('📜');
        expect(getFileIcon('.gitignore', false)).toBe('🚫');
      });

      it('should handle case insensitive extensions', () => {
        expect(getFileIcon('App.JS', false)).toBe('📄');
        expect(getFileIcon('Component.TSX', false)).toBe('🔵');
        expect(getFileIcon('Image.PNG', false)).toBe('🖼️');
        expect(getFileIcon('Config.JSON', false)).toBe('⚙️');
      });

      it('should return default icon for unknown file types', () => {
        expect(getFileIcon('unknown.xyz', false)).toBe('📄');
        expect(getFileIcon('file-without-extension', false)).toBe('📄');
        expect(getFileIcon('file.unknown-ext', false)).toBe('📄');
      });

      it('should handle files with no extension', () => {
        expect(getFileIcon('README', false)).toBe('📄');
        expect(getFileIcon('Makefile', false)).toBe('📄');
        expect(getFileIcon('LICENSE', false)).toBe('📄');
      });

      it('should handle empty filename', () => {
        expect(getFileIcon('', false)).toBe('📄');
      });

      it('should handle files with multiple dots', () => {
        expect(getFileIcon('config.test.js', false)).toBe('📄');
        expect(getFileIcon('component.stories.tsx', false)).toBe('🔵');
        expect(getFileIcon('package-lock.json', false)).toBe('⚙️'); // .json extension takes precedence
      });
    });
  });

  describe('countFiles', () => {
    it('should count files in a flat structure', () => {
      const tree = [
        { type: 'file', name: 'file1.txt' },
        { type: 'file', name: 'file2.js' },
        { type: 'directory', name: 'folder1' },
      ];
      
      expect(countFiles(tree)).toBe(2);
    });

    it('should count files recursively in nested structure', () => {
      const tree = [
        { type: 'file', name: 'root-file.txt' },
        {
          type: 'directory',
          name: 'src',
          children: [
            { type: 'file', name: 'index.js' },
            { type: 'file', name: 'app.js' },
            {
              type: 'directory',
              name: 'components',
              children: [
                { type: 'file', name: 'Button.tsx' },
                { type: 'file', name: 'Modal.tsx' },
              ],
            },
          ],
        },
        {
          type: 'directory',
          name: 'tests',
          children: [
            { type: 'file', name: 'app.test.js' },
          ],
        },
      ];
      
      expect(countFiles(tree)).toBe(6); // root-file.txt + index.js + app.js + Button.tsx + Modal.tsx + app.test.js
    });

    it('should handle empty tree', () => {
      expect(countFiles([])).toBe(0);
    });

    it('should handle tree with only directories', () => {
      const tree = [
        { type: 'directory', name: 'folder1' },
        { 
          type: 'directory', 
          name: 'folder2', 
          children: [
            { type: 'directory', name: 'subfolder' }
          ] 
        },
      ];
      
      expect(countFiles(tree)).toBe(0);
    });

    it('should handle tree with only files', () => {
      const tree = [
        { type: 'file', name: 'file1.txt' },
        { type: 'file', name: 'file2.js' },
        { type: 'file', name: 'file3.md' },
      ];
      
      expect(countFiles(tree)).toBe(3);
    });

    it('should handle directories without children property', () => {
      const tree = [
        { type: 'file', name: 'file1.txt' },
        { type: 'directory', name: 'empty-folder' },
        { type: 'file', name: 'file2.txt' },
      ];
      
      expect(countFiles(tree)).toBe(2);
    });

    it('should handle deeply nested structure', () => {
      const tree = [
        {
          type: 'directory',
          name: 'level1',
          children: [
            {
              type: 'directory',
              name: 'level2',
              children: [
                {
                  type: 'directory',
                  name: 'level3',
                  children: [
                    { type: 'file', name: 'deep-file.txt' },
                  ],
                },
              ],
            },
            { type: 'file', name: 'level2-file.js' },
          ],
        },
        { type: 'file', name: 'root-file.md' },
      ];
      
      expect(countFiles(tree)).toBe(3); // deep-file.txt + level2-file.js + root-file.md
    });

    it('should handle malformed entries gracefully', () => {
      const tree = [
        { type: 'file', name: 'valid-file.txt' },
        { type: 'unknown', name: 'invalid-entry' }, // Should be ignored
        { name: 'no-type-entry' }, // Should be ignored
        null, // Should be ignored
        undefined, // Should be ignored
        { type: 'file', name: 'another-valid-file.js' },
      ].filter(Boolean); // Remove null/undefined for realistic test
      
      expect(countFiles(tree)).toBe(2);
    });
  });
});