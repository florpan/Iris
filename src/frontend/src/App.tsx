import { type ReactNode, useEffect } from "react";
import { AppShell } from "./components/AppShell";
import { LibraryPage } from "./pages/LibraryPage";
import { FolderPage } from "./pages/FolderPage";
import { SearchPage } from "./pages/SearchPage";
import { BrowsePage } from "./pages/BrowsePage";
import { useTheme } from "./hooks/useTheme";

function App() {
  const { theme } = useTheme();

  // Apply initial theme on mount (before any re-renders)
  useEffect(() => {
    const stored = localStorage.getItem("iris-theme") ?? "system";
    const root = document.documentElement;
    const resolved =
      stored === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : stored;
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Simple client-side routing
  const path = window.location.pathname;

  let page: ReactNode;
  if (path === "/folders" || path.startsWith("/folders/")) {
    page = <FolderPage />;
  } else if (path === "/search") {
    page = <SearchPage />;
  } else if (path === "/browse") {
    page = <BrowsePage />;
  } else {
    page = <LibraryPage />;
  }

  return (
    <AppShell currentPath={path}>
      {page}
    </AppShell>
  );
}

export default App;
