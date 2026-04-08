import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const nextTheme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(nextTheme)}
        className={cn("h-9 w-9", className)}
        title={`Theme: ${theme}. Click to switch.`}
      >
        <Icon className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/10 p-1", className)}>
      {(
        [
          { value: "light", Icon: Sun, label: "Light" },
          { value: "system", Icon: Monitor, label: "System" },
          { value: "dark", Icon: Moon, label: "Dark" },
        ] as const
      ).map(({ value, Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-all",
            theme === value
              ? "bg-white shadow-sm dark:bg-white/20 text-[#18181b] dark:text-white"
              : "text-[#8e8e93] hover:text-[#18181b] dark:hover:text-white"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
