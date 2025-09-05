// Type definitions for File System Access API
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
}

interface ShowDirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | string;
}

interface ShowOpenFilePickerOptions {
  id?: string;
  multiple?: boolean;
  startIn?: FileSystemHandle | string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

declare global {
  interface Window {
    showDirectoryPicker?(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?(options?: ShowOpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  }
}

export {};