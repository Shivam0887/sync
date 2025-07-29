import { useState } from "react";
import { Eye, Clock, Users } from "lucide-react";
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

export const PrivacySettings = () => {
  const [settings, setSettings] = useState({
    onlineStatus: "everyone",
    readReceipts: true,
    lastSeen: true,
    profileVisibility: "everyone",
    messageHistory: true,
  });

  const updateSetting = (key: string, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Privacy Settings</h2>
        <p className="text-muted-foreground">
          Control your privacy and who can see your information.
        </p>
      </div>

      {/* Online Status */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <CardTitle className="text-lg">Online Status</CardTitle>
          </div>
          <CardDescription>
            Control who can see when you're online
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Who can see your online status</Label>
            <Select
              value={settings.onlineStatus}
              onValueChange={(value) => updateSetting("onlineStatus", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="nobody">Nobody</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Show last seen</Label>
              <p className="text-sm text-muted-foreground">
                Let others see when you were last active
              </p>
            </div>
            <Switch
              checked={settings.lastSeen}
              onCheckedChange={(checked) => updateSetting("lastSeen", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Message Privacy */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle className="text-lg">Message Privacy</CardTitle>
          </div>
          <CardDescription>
            Control message-related privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Read receipts</Label>
              <p className="text-sm text-muted-foreground">
                Let others know when you've read their messages
              </p>
            </div>
            <Switch
              checked={settings.readReceipts}
              onCheckedChange={(checked) =>
                updateSetting("readReceipts", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Save message history</Label>
              <p className="text-sm text-muted-foreground">
                Keep a local copy of your chat history
              </p>
            </div>
            <Switch
              checked={settings.messageHistory}
              onCheckedChange={(checked) =>
                updateSetting("messageHistory", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile Privacy */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle className="text-lg">Profile Privacy</CardTitle>
          </div>
          <CardDescription>
            Control who can see your profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Profile visibility</Label>
            <Select
              value={settings.profileVisibility}
              onValueChange={(value) =>
                updateSetting("profileVisibility", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="nobody">Nobody</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
