import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TmuxSession {
  name: string;
  windows: TmuxWindow[];
  created?: Date;
  lastActivity?: Date;
}

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
  panes?: TmuxPane[];
}

export interface TmuxPane {
  index: number;
  active: boolean;
  width: number;
  height: number;
  command?: string;
}

export interface TerminalSession {
  id: string;
  sessionName: string;
  windowName?: string;
  output: string[];
  created: Date;
  lastActivity: Date;
}

export interface AppSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  maxTerminalHistory: number;
  theme: 'light' | 'dark' | 'auto';
  terminalFontSize: number;
  terminalFontFamily: string;
}

export interface AppState {
  // Session data
  sessions: TmuxSession[];
  selectedSession: string | null;
  selectedWindow: number | null;
  
  // Terminal data
  terminals: Map<string, TerminalSession>;
  activeTerminal: string | null;
  
  // Capture data
  captureContent: Map<string, string>;
  activeCaptureTargets: Set<string>;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  
  // Settings
  settings: AppSettings;
  
  // Connection state
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface AppActions {
  // Session actions
  setSessions: (sessions: TmuxSession[]) => void;
  selectSession: (sessionName: string) => void;
  selectWindow: (windowIndex: number) => void;
  updateSession: (sessionName: string, updates: Partial<TmuxSession>) => void;
  
  // Terminal actions
  addTerminal: (terminal: TerminalSession) => void;
  removeTerminal: (terminalId: string) => void;
  updateTerminal: (terminalId: string, updates: Partial<TerminalSession>) => void;
  appendTerminalOutput: (terminalId: string, output: string) => void;
  setActiveTerminal: (terminalId: string | null) => void;
  
  // Capture actions
  setCaptureContent: (target: string, content: string) => void;
  clearCaptureContent: (target: string) => void;
  addCaptureTarget: (target: string) => void;
  removeCaptureTarget: (target: string) => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // Settings actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  // Connection actions
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  setConnected: (connected: boolean) => void;
  
  // Utility actions
  reset: () => void;
}

const defaultSettings: AppSettings = {
  autoRefresh: true,
  refreshInterval: 5000,
  maxTerminalHistory: 1000,
  theme: 'auto',
  terminalFontSize: 14,
  terminalFontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
};

const initialState: AppState = {
  // Session data
  sessions: [],
  selectedSession: null,
  selectedWindow: null,
  
  // Terminal data
  terminals: new Map(),
  activeTerminal: null,
  
  // Capture data
  captureContent: new Map(),
  activeCaptureTargets: new Set(),
  
  // UI state
  isLoading: false,
  error: null,
  sidebarOpen: true,
  
  // Settings
  settings: defaultSettings,
  
  // Connection state
  isConnected: false,
  connectionStatus: 'disconnected'
};

export const useStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Session actions
      setSessions: (sessions: TmuxSession[]) => set({ sessions }),
      
      selectSession: (sessionName: string) => set({ 
        selectedSession: sessionName,
        selectedWindow: null // Reset window selection when changing sessions
      }),
      
      selectWindow: (windowIndex: number) => set({ selectedWindow: windowIndex }),
      
      updateSession: (sessionName: string, updates: Partial<TmuxSession>) => set((state) => ({
        sessions: state.sessions.map(session => 
          session.name === sessionName ? { ...session, ...updates } : session
        )
      })),
      
      // Terminal actions
      addTerminal: (terminal: TerminalSession) => set((state) => {
        const newTerminals = new Map(state.terminals);
        newTerminals.set(terminal.id, terminal);
        return { terminals: newTerminals };
      }),
      
      removeTerminal: (terminalId: string) => set((state) => {
        const newTerminals = new Map(state.terminals);
        newTerminals.delete(terminalId);
        return { 
          terminals: newTerminals,
          activeTerminal: state.activeTerminal === terminalId ? null : state.activeTerminal
        };
      }),
      
      updateTerminal: (terminalId: string, updates: Partial<TerminalSession>) => set((state) => {
        const newTerminals = new Map(state.terminals);
        const existing = newTerminals.get(terminalId);
        if (existing) {
          newTerminals.set(terminalId, { ...existing, ...updates });
        }
        return { terminals: newTerminals };
      }),
      
      appendTerminalOutput: (terminalId: string, output: string) => set((state) => {
        const newTerminals = new Map(state.terminals);
        const terminal = newTerminals.get(terminalId);
        if (terminal) {
          const newOutput = [...terminal.output, output];
          // Keep only last maxTerminalHistory lines
          const maxHistory = state.settings.maxTerminalHistory;
          if (newOutput.length > maxHistory) {
            newOutput.splice(0, newOutput.length - maxHistory);
          }
          newTerminals.set(terminalId, {
            ...terminal,
            output: newOutput,
            lastActivity: new Date()
          });
        }
        return { terminals: newTerminals };
      }),
      
      setActiveTerminal: (terminalId: string | null) => set({ activeTerminal: terminalId }),
      
      // Capture actions
      setCaptureContent: (target: string, content: string) => set((state) => {
        const newCaptureContent = new Map(state.captureContent);
        newCaptureContent.set(target, content);
        return { captureContent: newCaptureContent };
      }),
      
      clearCaptureContent: (target: string) => set((state) => {
        const newCaptureContent = new Map(state.captureContent);
        newCaptureContent.delete(target);
        return { captureContent: newCaptureContent };
      }),
      
      addCaptureTarget: (target: string) => set((state) => {
        const newTargets = new Set(state.activeCaptureTargets);
        newTargets.add(target);
        return { activeCaptureTargets: newTargets };
      }),
      
      removeCaptureTarget: (target: string) => set((state) => {
        const newTargets = new Set(state.activeCaptureTargets);
        newTargets.delete(target);
        return { activeCaptureTargets: newTargets };
      }),
      
      // UI actions
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      
      setError: (error: string | null) => set({ error }),
      
      clearError: () => set({ error: null }),
      
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      // Settings actions
      updateSettings: (settings: Partial<AppSettings>) => set((state) => ({
        settings: { ...state.settings, ...settings }
      })),
      
      resetSettings: () => set({ settings: defaultSettings }),
      
      // Connection actions
      setConnectionStatus: (connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error') => set({ 
        connectionStatus,
        isConnected: connectionStatus === 'connected'
      }),
      
      setConnected: (isConnected: boolean) => set({ 
        isConnected,
        connectionStatus: isConnected ? 'connected' : 'disconnected'
      }),
      
      // Utility actions
      reset: () => set(initialState)
    }),
    {
      name: 'agentmux-store',
      // Only persist settings and UI preferences, not real-time data
      partialize: (state) => ({
        settings: state.settings,
        sidebarOpen: state.sidebarOpen,
        selectedSession: state.selectedSession,
        selectedWindow: state.selectedWindow
      }),
    }
  )
);

// Selectors for computed state
export const useSelectedSession = () => {
  const { sessions, selectedSession } = useStore();
  return sessions.find(s => s.name === selectedSession) || null;
};

export const useSelectedWindow = () => {
  const { sessions, selectedSession, selectedWindow } = useStore();
  const session = sessions.find(s => s.name === selectedSession);
  if (!session || selectedWindow === null) return null;
  return session.windows.find(w => w.index === selectedWindow) || null;
};

export const useActiveTerminal = () => {
  const { terminals, activeTerminal } = useStore();
  return activeTerminal ? terminals.get(activeTerminal) || null : null;
};

export const useTerminalsBySession = (sessionName: string) => {
  const { terminals } = useStore();
  return Array.from(terminals.values()).filter(t => t.sessionName === sessionName);
};

export const useCaptureForTarget = (target: string) => {
  const { captureContent } = useStore();
  return captureContent.get(target) || '';
};

export const useIsCapturing = (target: string) => {
  const { activeCaptureTargets } = useStore();
  return activeCaptureTargets.has(target);
};