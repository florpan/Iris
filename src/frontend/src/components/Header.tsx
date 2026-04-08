/**
 * Header.tsx
 *
 * Global application header containing:
 *  - Mobile menu toggle (hamburger) — visible only on mobile
 *  - Application logo and name
 *  - Global search bar (navigates to /search)
 *  - View mode toggle buttons (grid / list / timeline)
 *
 * The header is rendered at the top of the AppShell above the sidebar+content area.
 */

import { LayoutGrid, AlignJustify, Calendar, Menu, Aperture } from "lucide-react";
import { TopSearchBar } from "./SearchBar";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list" | "timeline";

interface ViewModeButtonProps {
  mode: ViewMode;
  current: ViewMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: (mode: ViewMode) => void;
}

function ViewModeButton({ mode, current, icon: Icon, label, onClick }: ViewModeButtonProps) {
  const isActive = mode === current;
  return (
    <button
      onClick={() => onClick?.(mode)}
      title={`${label} view`}
      aria-label={`Switch to ${label.toLowerCase()} view`}
      aria-pressed={isActive}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] text-xs font-medium transition-colors",
        isActive
          ? "bg-[var(--color-bg)] text-[var(--color-text-heading)] shadow-sm"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

interface HeaderProps {
  /** Current view mode */
  viewMode?: ViewMode;
  /** Called when user switches view mode */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Called when mobile menu button is clicked */
  onMenuToggle?: () => void;
  /** Whether to show the mobile hamburger menu button */
  showMenuButton?: boolean;
  className?: string;
}

export function Header({
  viewMode = "grid",
  onViewModeChange,
  onMenuToggle,
  showMenuButton = false,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center gap-3 h-14 px-3 sm:px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 z-20",
        className
      )}
    >
      {/* Mobile hamburger menu */}
      {showMenuButton && (
        <button
          onClick={onMenuToggle}
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5 transition-colors shrink-0 md:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Logo — hidden on desktop (shown in sidebar) */}
      <a
        href="/"
        className="flex items-center gap-2 shrink-0 md:hidden"
        aria-label="Iris — go to library"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1456f0]">
          <Aperture className="h-4 w-4 text-white" />
        </div>
        <span className="font-display text-base font-600 text-[var(--color-text-heading)] tracking-tight">
          Iris
        </span>
      </a>

      {/* Global search bar */}
      <TopSearchBar className="flex-1 max-w-xl" />

      {/* View mode toggle */}
      <div
        className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-[var(--radius-md)] p-0.5 shrink-0"
        role="group"
        aria-label="View mode"
      >
        <ViewModeButton
          mode="grid"
          current={viewMode}
          icon={LayoutGrid}
          label="Grid"
          onClick={onViewModeChange}
        />
        <ViewModeButton
          mode="list"
          current={viewMode}
          icon={AlignJustify}
          label="List"
          onClick={onViewModeChange}
        />
        <ViewModeButton
          mode="timeline"
          current={viewMode}
          icon={Calendar}
          label="Timeline"
          onClick={onViewModeChange}
        />
      </div>
    </header>
  );
}
