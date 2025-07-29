import { useState } from "react";
import { useTheme, type Theme } from "@/hooks/use-theme";

import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import ModernSlider from "@/components/ui/modern-slider";

interface IThemeOptions {
  value: Theme;
  label: string;
  icon: LucideIcon;
}

const themeOptions: IThemeOptions[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const MIN_RANGE = 12;
const MAX_RANGE = 20;
const STEP_SIZE = 2;

export const AppearanceSettings = () => {
  const [settings, setSettings] = useState({
    fontSize: [MIN_RANGE],
    showAvatars: true,
    colorScheme: "default",
  });

  const { onThemeChange, theme } = useTheme();

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Appearance Settings</h2>
        <p className="text-muted-foreground">
          Customize the look and feel of your chat experience.
        </p>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <CardTitle className="text-lg">Theme</CardTitle>
          </div>
          <CardDescription>Choose your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.value}
                  variant="ghost"
                  onClick={() => onThemeChange(option.value)}
                  className={`flex flex-col h-fit items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                    theme === option.value ? "border-primary" : "border-border"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            <CardTitle className="text-lg">Typography</CardTitle>
          </div>
          <CardDescription>
            Adjust text size and spacing for better readability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Font size</Label>
              <span className="text-sm text-muted-foreground">
                {settings.fontSize[0]}px
              </span>
            </div>
            <ModernSlider
              value={settings.fontSize}
              onValueChange={(value) => updateSetting("fontSize", value)}
              max={MAX_RANGE}
              min={MIN_RANGE}
              step={STEP_SIZE}
              className="w-full"
              dotSize="md"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle className="text-lg">Display Options</CardTitle>
          </div>
          <CardDescription>
            Control what elements are shown in the interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Show avatars</Label>
              <p className="text-sm text-muted-foreground">
                Display profile pictures in messages
              </p>
            </div>
            <Switch
              checked={settings.showAvatars}
              onCheckedChange={(checked) =>
                updateSetting("showAvatars", checked)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Color scheme</Label>
            <Select
              value={settings.colorScheme}
              onValueChange={(value) => updateSetting("colorScheme", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="blue">Ocean Blue</SelectItem>
                <SelectItem value="green">Forest Green</SelectItem>
                <SelectItem value="purple">Royal Purple</SelectItem>
                <SelectItem value="orange">Sunset Orange</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
