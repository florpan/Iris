/**
 * AppShell.tsx
 *
 * Root layout shell for the Iris application. Composes:
 *
 *  ┌─────────────────────────────────────┐
 *  │ Header: Search + View Mode Toggle   │  h-14, full width
 *  ├──────────┬──────────────────────────┤
 *  │ Sidebar  │ Main Content Area        │  flex-1, overflow
 *  │ nav links│ (page content rendered   │
 *  │ collapse │  here via children)      │
 *  └──────────┴──────────────────────────┘
 *
 * Responsive behavior:
 *  - Desktop (≥ md): Sidebar visible, collapsible to icon rail
 *  - Mobile (< md):  Sidebar hidden by default, opens as a slide-in drawer
 *                    triggered by the hamburger button in the Header
 *
 * Shared state is managed via useAppState() and passed down to both
 * the Header and Sidebar so all three stay in sync.
 */

import { useEffect } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useAppState } from "@/hooks/useAppState";

interface AppShellProps {
  children: React.ReactNode;
  currentPath?: string;
}

export function AppShell({ children, currentPath }: AppShellProps) {
  const {
    viewMode,
    setViewMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
  } = useAppState();

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath, setSidebarOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* ── Global Header ─────────────────────────────────────────────────── */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showMenuButton
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* ── Body (sidebar + content) ──────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Navigation sidebar */}
        <Sidebar
          currentPath={currentPath}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        {/* Main page content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
