import type { IConversationBase, IGroupConversation } from "@/types/chat.types";

import {
  Hash,
  Users,
  Bell,
  Search,
  Edit3,
  Link,
  FlagTriangleLeft,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import AddGroupMembersDialog from "./add-group-members-modal";
import { apiRequest } from "@/services/api-request";
import { toastErrorHandler } from "@/lib/utils";
import { toast } from "sonner";
import { useChatActions } from "@/stores/chat-store";
import { useUser } from "@/stores/auth-store";
import { useMutation } from "@tanstack/react-query";

interface GroupInfoProps {
  group: IConversationBase & IGroupConversation;
  onClose: () => void;
  open: boolean;
}

export const GroupInfo = ({ group, onClose, open }: GroupInfoProps) => {
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  const { data: user } = useUser();
  const { removeMembers } = useChatActions();

  const existingMembers = group.participants.map(({ id }) => id);

  const isAdmin = group.participants.some(
    ({ id, role }) => role === "admin" && id === user?.id
  );

  const handleCopy = async () => {
    if (linkInputRef.current) {
      await navigator.clipboard.writeText(linkInputRef.current.value);
    }
  };

  const handleGroupLeave = useMutation({
    mutationKey: ["group_leave"],
    mutationFn: async ({ userId }: { userId: string; username: string }) => {
      const response = await apiRequest(
        `/chat/groups/${group.id}/remove/${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok)
        throw new Error("Failed to leave group. Please try again later.");
    },
    onSettled(_, error, { userId, username }) {
      if (error) {
        toastErrorHandler({ error });
      } else {
        toast.success(`${username} removed successfully`);
        removeMembers({ chatId: group.id, members: [userId] });
      }
    },
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Group Info</SheetTitle>
          <SheetDescription>Manage group members and settings</SheetDescription>
        </SheetHeader>

        <div className="gap-4 p-2">
          <div>
            {/* Group Header */}
            <div className="p-6 text-center">
              <Avatar className="h-20 w-20 mx-auto mb-4">
                <AvatarImage src={group.avatarUrl ?? ""} alt={group.name} />
                <AvatarFallback className="text-xl">
                  <Hash className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>

              <h4 className="text-xl font-semibold mb-2">{group.name}</h4>

              {group.description && (
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              )}

              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge variant="secondary">
                  <Users className="h-3 w-3 mr-1" />
                  {group.participants.length} members
                </Badge>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <AddGroupMembersDialog
                existingMembers={existingMembers}
                groupId={group.id}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Link className="h-4 w-4" />
                    <span className="text-xs">Invite to group via link</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="space-y-2">
                    <Input
                      ref={linkInputRef}
                      readOnly
                      value={`${location.origin}/group/join/${group.inviteLinkToken}`}
                    />
                    <Button
                      type="button"
                      onClick={handleCopy}
                      disabled={!group.inviteLinkToken}
                    >
                      Copy Link
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button variant="outline">
                <Bell className="h-4 w-4" />
                <span className="text-xs">Mute Group</span>
              </Button>

              <Button variant="outline">
                <Edit3 className="h-4 w-4" />
                <span className="text-xs">Edit Group</span>
              </Button>

              <Button
                variant="destructive"
                disabled={handleGroupLeave.isPending}
                onClick={() =>
                  handleGroupLeave.mutate({
                    userId: user!.id,
                    username: user!.username,
                  })
                }
              >
                <FlagTriangleLeft className="h-4 w-4" />
                <span className="text-xs">Leave Group</span>
              </Button>
            </div>
          </div>

          {/* Members Section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium">
                Members ({group.participants.length})
              </h5>
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-3">
              <Input placeholder="Search members..." className="h-8" />
            </div>

            <div className="space-y-2 overflow-y-auto max-h-80">
              {group.participants.map((member) => (
                <div
                  key={member.id}
                  className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={member.avatarUrl ?? ""}
                        alt={member.username}
                      />
                      <AvatarFallback className="text-xs">
                        {member.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate capitalize">
                        {member.username}
                      </p>
                      {member.role === "admin" && (
                        <Badge variant="destructive" className="text-xs">
                          Admin
                        </Badge>
                      )}
                      {member.role === "member" && (
                        <Badge variant="default" className="text-xs">
                          Member
                        </Badge>
                      )}
                    </div>
                  </div>

                  {(isAdmin || member.id === user?.id) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="group-hover:opacity-100 opacity-0 transition-opacity"
                      disabled={handleGroupLeave.isPending}
                      onClick={() =>
                        handleGroupLeave.mutate({
                          userId: member.id,
                          username: member.username,
                        })
                      }
                    >
                      <LogOut className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
