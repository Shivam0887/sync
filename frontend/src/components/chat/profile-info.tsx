import { Phone, Video, Shield, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

interface ProfileInfoProps {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  onClose: () => void;
  open: boolean;
}

export const ProfileInfo = ({ user, onClose, open }: ProfileInfoProps) => {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Profile Info</SheetTitle>
          <SheetDescription>
            Manage your profile settings and information
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Profile Header */}
          <div className="p-6 text-center border-b">
            <div className="relative inline-block">
              <Avatar className="h-20 w-20 mx-auto mb-4">
                <AvatarImage src={user.avatarUrl ?? ""} alt={user.username} />
                <AvatarFallback className="text-xl">
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <h4 className="text-xl font-semibold mb-2 capitalize">
              {user.username}
            </h4>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="flex-col gap-1 h-auto py-3">
                <Phone className="h-4 w-4" />
                <span className="text-xs">Call</span>
              </Button>
              <Button variant="outline" className="flex-col gap-1 h-auto py-3">
                <Video className="h-4 w-4" />
                <span className="text-xs">Video</span>
              </Button>
            </div>
          </div>

          {/* User Details */}
          <div className="p-4 space-y-4">
            {/* Privacy & Notifications */}
            <div>
              <h5 className="font-medium mb-3">Settings</h5>
              <div className="space-y-2">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Bell className="h-4 w-4" />
                  Mute Notifications
                </Button>

                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Shield className="h-4 w-4" />
                  Block User
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
