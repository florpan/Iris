import { useEffect } from "react";
import { AppShell } from "./components/AppShell";
import { LibraryPage } from "./pages/LibraryPage";
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

  return (
    <AppShell currentPath={path}>
      <LibraryPage />
    </AppShell>
  );
}

export default App;
