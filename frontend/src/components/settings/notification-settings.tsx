import { useState } from "react";
import { Volume2, VolumeX, Monitor } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    desktopNotifications: true,
    soundEnabled: true,
    messagePreview: true,
    notificationSound: "default",
  });

  const updateSetting = (
    key: keyof typeof settings,
    value: boolean | string
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Notification Settings</h2>
        <p className="text-muted-foreground">
          Configure how and when you receive notifications.
        </p>
      </div>

      {/* Desktop Notifications */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <CardTitle className="text-lg">Desktop Notifications</CardTitle>
          </div>
          <CardDescription>
            Control notifications when using the desktop app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable desktop notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified of new messages
              </p>
            </div>
            <Switch
              checked={settings.desktopNotifications}
              onCheckedChange={(checked) =>
                updateSetting("desktopNotifications", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Message previews</Label>
              <p className="text-sm text-muted-foreground">
                Show message content in notifications
              </p>
            </div>
            <Switch
              checked={settings.messagePreview}
              onCheckedChange={(checked) =>
                updateSetting("messagePreview", checked)
              }
              disabled={!settings.desktopNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sound Settings */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            {settings.soundEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
            <CardTitle className="text-lg">Sound Settings</CardTitle>
          </div>
          <CardDescription>
            Manage notification sounds and audio alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable sounds</Label>
              <p className="text-sm text-muted-foreground">
                Play sounds for notifications
              </p>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) =>
                updateSetting("soundEnabled", checked)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Notification sound</Label>
            <Select
              value={settings.notificationSound}
              onValueChange={(value) =>
                updateSetting("notificationSound", value)
              }
              disabled={!settings.soundEnabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="chime">Chime</SelectItem>
                <SelectItem value="bell">Bell</SelectItem>
                <SelectItem value="ping">Ping</SelectItem>
                <SelectItem value="pop">Pop</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
