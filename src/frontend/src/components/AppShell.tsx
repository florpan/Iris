import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  currentPath?: string;
}

export function AppShell({ children, currentPath }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      <Sidebar currentPath={currentPath} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
