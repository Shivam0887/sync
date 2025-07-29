import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, User, Bell, Lock, Shield, PaintRoller } from "lucide-react";

import { ProfileSettings } from "./profile-settings";
import { AccountSettings } from "./account-settings";
import { PrivacySettings } from "./privacy-settings";
import { AppearanceSettings } from "./appearance-settings";
import { NotificationSettings } from "./notification-settings";

const Settings = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-3xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="profile" className="max-h-[512px] overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="account">
              <Lock className="mr-2 h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <PaintRoller className="mr-2 h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="notification">
              <Bell className="mr-2 h-4 w-4" />
              Notification
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="mr-2 h-4 w-4" />
              Privacy
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="overflow-y-auto mt-2">
            <ProfileSettings />
          </TabsContent>
          <TabsContent value="account" className="overflow-y-auto mt-2">
            <AccountSettings />
          </TabsContent>
          <TabsContent value="appearance" className="overflow-y-auto mt-2">
            <AppearanceSettings />
          </TabsContent>
          <TabsContent value="notification" className="overflow-y-auto mt-2">
            <NotificationSettings />
          </TabsContent>
          <TabsContent value="privacy" className="overflow-y-auto mt-2">
            <PrivacySettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default Settings;
