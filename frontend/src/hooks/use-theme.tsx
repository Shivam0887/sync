import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  onThemeChange: (newTheme: Theme) => void;
}

const ThemeContext = createContext<ThemeState>({
  theme: "dark",
  onThemeChange: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [theme, setTheme] = useState<Theme>("light");

  const onThemeChange = useCallback((newTheme: Theme) => {
    let preferredTheme = newTheme;

    if (newTheme === "system") {
      preferredTheme = matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light";
    }

    document.documentElement.classList.toggle(
      "dark",
      preferredTheme === "dark"
    );

    localStorage.setItem("theme", newTheme);
    setTheme(newTheme);
  }, []);

  useEffect(() => {
    const currentTheme = (localStorage.getItem("theme") ?? "light") as Theme;
    onThemeChange(currentTheme);
  }, [onThemeChange]);

  return (
    <ThemeContext.Provider value={{ theme, onThemeChange }}>
      {children}
    </ThemeContext.Provider>
  );
};
