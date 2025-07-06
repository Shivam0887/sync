import { useTheme } from "@/hooks/use-theme";
import { Button } from "./ui/button";
import { Moon, Sun } from "lucide-react";

const ToggleTheme = () => {
  const { onThemeChange, theme } = useTheme();
  return (
    <div>
      {theme === "light" ? (
        <Button
          variant="outline"
          className="shadow"
          size="icon"
          onClick={() => onThemeChange("dark")}
        >
          <Sun />
        </Button>
      ) : (
        <Button
          variant="outline"
          className="shadow"
          size="icon"
          onClick={() => onThemeChange("light")}
        >
          <Moon />
        </Button>
      )}
    </div>
  );
};

export default ToggleTheme;
