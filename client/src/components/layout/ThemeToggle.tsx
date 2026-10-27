import type { MouseEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/hooks/use-theme";

export function ThemeToggle() {
  const setTheme = useThemeStore((s) => s.setTheme);

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    // "system" stays the unsaved default; the first click saves the opposite of what's showing
    const nextDark = !root.classList.contains("dark");
    const apply = () => {
      setTheme(nextDark ? "dark" : "light");
      // useApplyTheme sets the class in an effect, too late for the view-transition snapshot
      root.classList.toggle("dark", nextDark);
    };

    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }

    const icon = e.currentTarget.firstElementChild;
    icon?.classList.add("theme-icon-spin");
    setTimeout(() => icon?.classList.remove("theme-icon-spin"), 480);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    // expand the new snapshot over the old one; shrinking the old one flashes white
    document.startViewTransition(apply).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 600, easing: "cubic-bezier(0.45, 0, 0.55, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  };

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
      <span className="relative block">
        <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute inset-0 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </span>
    </Button>
  );
}
