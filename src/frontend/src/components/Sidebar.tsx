import { useState } from "react";
import {
  Images,
  FolderOpen,
  Search,
  Tags,
  MapPin,
  Settings,
  ChevronLeft,
  ChevronRight,
  Aperture,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { SyncStatusWidget } from "./SyncStatusWidget";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
}

const navItems: NavItem[] = [
  { icon: Images, label: "Library", href: "/" },
  { icon: FolderOpen, label: "Folders", href: "/folders" },
  { icon: Search, label: "Search", href: "/search" },
  { icon: LayoutGrid, label: "Browse", href: "/browse" },
  { icon: Tags, label: "Tags", href: "/tags" },
  { icon: MapPin, label: "Map", href: "/map" },
];

const bottomItems: NavItem[] = [
  { icon: Settings, label: "Settings", href: "/settings" },
];

interface SidebarProps {
  currentPath?: string;
}

export function Sidebar({ currentPath = "/" }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-all duration-200 ease-in-out flex-shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Wordmark */}
      <div
        className={cn(
          "flex items-center h-14 px-4 border-b border-[var(--sidebar-border)]",
          collapsed ? "justify-center" : "gap-2.5"
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1456f0] flex-shrink-0">
          <Aperture className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-display text-lg font-600 text-[var(--color-text-heading)] tracking-tight">
            Iris
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-[#1456f0]/10 text-[#1456f0] dark:bg-[#1456f0]/20 dark:text-[#60a5fa]"
                  : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5 dark:hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </a>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-3 space-y-0.5 border-t border-[var(--sidebar-border)] pt-2">
        {/* Sync status */}
        {!collapsed ? (
          <div className="border-b border-[var(--sidebar-border)] mb-1 pb-1">
            <SyncStatusWidget collapsed={false} />
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <SyncStatusWidget collapsed={true} />
          </div>
        )}

        {/* Theme toggle */}
        {!collapsed && (
          <div className="px-3 py-2">
            <ThemeToggle />
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center py-1">
            <ThemeToggle compact />
          </div>
        )}

        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-[#1456f0]/10 text-[#1456f0]"
                  : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5 dark:hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </a>
          );
        })}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text-heading)] dark:hover:bg-white/5 dark:hover:text-white",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="ml-3">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
