import { type ReactNode, useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { LibraryPage } from "./pages/LibraryPage";
import { FolderPage } from "./pages/FolderPage";
import { SearchPage } from "./pages/SearchPage";
import { BrowsePage } from "./pages/BrowsePage";
import { TagManagementPage } from "./pages/TagManagementPage";
import { ImageDetailDeepLink } from "./pages/ImageDetailDeepLink";
import { useTheme } from "./hooks/useTheme";

function App() {
  const { theme } = useTheme();

  // Track path in state so popstate events trigger re-renders
  const [path, setPath] = useState(window.location.pathname);

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

  // Listen for browser navigation events (popstate) to update the active route.
  // In-app modal navigation uses pushState without changing the React tree, so
  // popstate only fires when navigating away from an /image/:id URL.
  useEffect(() => {
    const handlePopstate = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, []);

  // Resolve the active page from the current pathname
  const imageDetailMatch = path.match(/^\/image\/(\d+)$/);

  let page: ReactNode;
  if (imageDetailMatch) {
    // Deep link to a specific image — show standalone detail page
    page = <ImageDetailDeepLink imageId={parseInt(imageDetailMatch[1], 10)} />;
  } else if (path === "/folders" || path.startsWith("/folders/")) {
    page = <FolderPage />;
  } else if (path === "/search") {
    page = <SearchPage />;
  } else if (path === "/browse") {
    page = <BrowsePage />;
  } else if (path === "/tags" || path.startsWith("/tags/")) {
    page = <TagManagementPage />;
  } else {
    page = <LibraryPage />;
  }

  // Determine the "active section" for the AppShell nav — /image/* should
  // highlight the originating section based on the `from` param
  let navPath = path;
  if (imageDetailMatch) {
    const fromParam = new URLSearchParams(window.location.search).get("from");
    if (fromParam === "search") navPath = "/search";
    else if (fromParam === "folder") navPath = "/folders";
    else if (fromParam === "browse") navPath = "/browse";
    else if (fromParam === "tags") navPath = "/tags";
    else navPath = "/";
  }

  return (
    <AppShell currentPath={navPath}>
      {page}
    </AppShell>
  );
}

export default App;
