/**
 * useAppState.ts
 *
 * Shared application state hook. Manages cross-cutting UI state that needs
 * to be synchronized across the header, sidebar, and content areas:
 *
 *  - viewMode: grid | list | timeline — stored in localStorage
 *  - sidebarOpen: whether the mobile navigation drawer is open
 *  - sidebarCollapsed: whether the desktop sidebar is collapsed — stored in localStorage
 *
 * This is a module-level singleton so that multiple components importing this
 * hook all share the same state (no context provider needed for a single-page app).
 */

import { useState, useCallback, useEffect } from "react";
import type { ViewMode } from "@/components/Header";

// ── Module-level state (shared between all hook instances) ────────────────────

const STORAGE_KEY_VIEW_MODE = "iris-view-mode";
const STORAGE_KEY_SIDEBAR_COLLAPSED = "iris-sidebar-collapsed";

function readViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
    if (stored === "grid" || stored === "list" || stored === "timeline" || stored === "map") return stored;
  } catch {
    // ignore
  }
  return "grid";
}

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED) === "true";
  } catch {
    return false;
  }
}

// Shared mutable state — used as module-level singleton
let _viewMode: ViewMode = readViewMode();
let _sidebarCollapsed: boolean = readSidebarCollapsed();
let _sidebarOpen: boolean = false; // mobile drawer — never persisted

// Subscriber callbacks for state updates
type Listener = () => void;
const _viewModeListeners = new Set<Listener>();
const _sidebarListeners = new Set<Listener>();

function notifyViewModeListeners() {
  _viewModeListeners.forEach((cb) => cb());
}
function notifySidebarListeners() {
  _sidebarListeners.forEach((cb) => cb());
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface AppState {
  /** Grid / list / timeline display mode */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  /** Desktop sidebar collapsed state */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;

  /** Mobile sidebar/drawer open state */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarOpen: () => void;
}

export function useAppState(): AppState {
  const [viewMode, setViewModeState] = useState<ViewMode>(_viewMode);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(_sidebarCollapsed);
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(_sidebarOpen);

  // Subscribe to module-level state changes from other instances
  useEffect(() => {
    const handleViewMode = () => setViewModeState(_viewMode);
    const handleSidebar = () => {
      setSidebarCollapsedState(_sidebarCollapsed);
      setSidebarOpenState(_sidebarOpen);
    };
    _viewModeListeners.add(handleViewMode);
    _sidebarListeners.add(handleSidebar);
    return () => {
      _viewModeListeners.delete(handleViewMode);
      _sidebarListeners.delete(handleSidebar);
    };
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    _viewMode = mode;
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
    } catch {
      // ignore
    }
    notifyViewModeListeners();
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    _sidebarCollapsed = collapsed;
    try {
      localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(collapsed));
    } catch {
      // ignore
    }
    notifySidebarListeners();
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed(!_sidebarCollapsed);
  }, [setSidebarCollapsed]);

  const setSidebarOpen = useCallback((open: boolean) => {
    _sidebarOpen = open;
    notifySidebarListeners();
  }, []);

  const toggleSidebarOpen = useCallback(() => {
    setSidebarOpen(!_sidebarOpen);
  }, [setSidebarOpen]);

  return {
    viewMode,
    setViewMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebarOpen,
  };
}
