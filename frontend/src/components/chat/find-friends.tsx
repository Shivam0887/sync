import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { DialogTitle } from "@radix-ui/react-dialog";
import { useAuth } from "@/providers/auth-provider";
import { useNavigate } from "react-router";
import { useChat } from "@/providers/chat-provider";
import { toastErrorHandler } from "@/lib/utils";

const FindFriends = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<{ username: string; id: string }[]>(
    []
  );

  const router = useNavigate();
  const { apiRequest, user } = useAuth();
  const { fetchConversations } = useChat();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiRequest(`/user/username/${query}/search`);
      if (!res.ok)
        throw new Error("Unable to find friends. Please try again later");

      const { users } = await res.json();
      setFriends(users);
    } catch (error) {
      toastErrorHandler({ error });
    } finally {
      setLoading(false);
    }
  };

  const handleUserAdd = async (friendId: string) => {
    try {
      setLoading(true);
      const res = await apiRequest("/chat/direct", {
        method: "POST",
        body: JSON.stringify({ otherUserId: friendId }),
      });

      if (!res.ok) throw new Error("Failed to create or get chat");

      const data = await res.json();
      await fetchConversations();

      router(`/chat/${data.chatId}`);
    } catch (error) {
      toastErrorHandler({ error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-8 border">
        <DialogHeader>
          <DialogTitle>Find Friends</DialogTitle>
          <DialogDescription>
            Search for people by username and send them a friend request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <Input
            placeholder="Enter username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={loading}>
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Search className="size-4" />
            )}
          </Button>
        </form>

        {!loading && !friends.length && (
          <div className="text-center text-muted-foreground py-6">
            Start typing a username to search.
          </div>
        )}

        <div className="space-y-3 max-h-[80px]">
          {friends.map(({ id, username }) => (
            <div
              key={id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition"
            >
              <Avatar className="h-10 w-10">
                <div className="bg-primary/10 h-full w-full flex items-center justify-center text-base font-medium text-primary">
                  {username[0]}
                </div>
              </Avatar>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">@{username}</div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                type="button"
                disabled={id === user?.id}
                onClick={() => handleUserAdd(id)}
              >
                <UserPlus size={16} className="mr-1" /> Add
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FindFriends;
