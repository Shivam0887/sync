import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "../ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toastErrorHandler } from "@/lib/utils";
import { useOutletContext } from "react-router";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/services/api-request";
import { useChatActions } from "@/stores/chat-store";
import type { IParticipant } from "@/types/chat.types";
import { useMutation } from "@tanstack/react-query";

interface AddGroupMembersDialogProps {
  groupId: string;
  existingMembers: string[];
}

const AddGroupMembersDialog = ({
  groupId,
  existingMembers,
}: AddGroupMembersDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const { addMembers } = useChatActions();

  const { directParticipants } = useOutletContext<{
    directParticipants: IParticipant[];
  }>();

  const existingMembersRef = useRef<Set<string>>(new Set(existingMembers));

  const handleUserToggle = (id: string) => {
    const newSelectedUsers = new Set(selectedUsers);

    if (newSelectedUsers.has(id)) newSelectedUsers.delete(id);
    else newSelectedUsers.add(id);

    setSelectedUsers(newSelectedUsers);
  };

  const handleSubmit = useMutation({
    mutationKey: ["group_add_member"],
    mutationFn: async (e: React.FormEvent) => {
      e.preventDefault();
      const res = await apiRequest(`/chat/groups/${groupId}/add`, {
        method: "POST",
        body: JSON.stringify({ userIds: Array.from(selectedUsers) }),
      });

      if (!res.ok) throw new Error("Failed to add members");
    },
    onSettled: (_, error) => {
      if (error) {
        toastErrorHandler({ error });
      } else {
        toast.success("Users added successfully");

        addMembers(
          groupId,
          directParticipants.filter(({ id }) => selectedUsers.has(id))
        );
        setIsOpen(false);
      }
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="h-4 w-4" />
          <span className="text-xs">Add Member</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
          <DialogDescription>
            Select users to add to this group.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit.mutate} className="space-y-4">
          <div>
            <div className="font-semibold mb-1">Users</div>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
              {directParticipants.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No users available to add.
                </div>
              )}
              {directParticipants.map((u) => (
                <Label
                  key={u.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex gap-3 items-center">
                    <Avatar>
                      <AvatarImage src={u.avatarUrl ?? ""} />
                      <AvatarFallback>
                        {u.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="capitalize">{u.username}</span>
                  </div>
                  <Input
                    disabled={existingMembersRef.current.has(u.id)}
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => handleUserToggle(u.id)}
                    className="size-4"
                  />
                </Label>
              ))}
            </div>
          </div>
          <Button
            type="submit"
            disabled={handleSubmit.isPending || selectedUsers.size === 0}
          >
            {handleSubmit.isPending ? "Adding..." : "Add Members"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddGroupMembersDialog;
