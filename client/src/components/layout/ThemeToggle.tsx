import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/hooks/use-theme";

export function ThemeToggle() {
  const setTheme = useThemeStore((s) => s.setTheme);
  // "system" stays the unsaved default; the first click saves the opposite of what's showing
  const toggle = () =>
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
      <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  );
}
