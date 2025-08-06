import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toastErrorHandler } from "@/lib/utils";
import { useNavigate } from "react-router";
import { Label } from "../ui/label";
import type { IUser } from "@/layouts/chat.layout";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useChatActions } from "@/stores/chat-store";
import { apiRequest } from "@/services/api-request";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  allUsers: IUser;
}

const CreateGroupDialog = ({
  open,
  onClose,
  allUsers,
}: CreateGroupDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { fetchConversations } = useChatActions();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiRequest("/chat/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          userIds: selectedUsers,
        }),
      });

      if (!res.ok) throw new Error("Failed to create group");

      const { groupId } = await res.json();

      //Todo: Add new group or chat directly into conversations state rather than calling the fetchConversations
      await fetchConversations();

      onClose();
      navigate(`/chat/${groupId}`);
    } catch (error) {
      toastErrorHandler({ error });
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  console.log({ selectedUsers });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>
            Enter group details and select members to start a new group chat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Group Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div>
            <div className="font-semibold mb-1">Add Members</div>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
              {allUsers.map((u) => (
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
                    type="checkbox"
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => handleUserToggle(u.id)}
                    className="size-4"
                  />
                </Label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={loading || !name}>
            {loading ? "Creating..." : "Create Group"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
