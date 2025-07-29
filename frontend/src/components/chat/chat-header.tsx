import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, Search, Phone, Video, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatHeaderProps = {
  toggleSidebar: () => void;
  username: string;
  avatarUrl: string;
};

const ChatHeader = ({
  toggleSidebar,
  avatarUrl,
  username,
}: ChatHeaderProps) => {
  return (
    <header className="border px-4 py-3 rounded-xl relative overflow-hidden flex items-center justify-between shadow">
      {/* Background layers */}
      <div className="absolute inset-0 backdrop-blur-xl bg-secondary/50 -z-10"></div>

      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-transparent"></div>

      <div className="flex items-center">
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="sm"
          className="mr-3 md:mr-2 text-foreground/80 hover:text-foreground hover:bg-white/5 relative"
        >
          <Menu size={18} />
          <span className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full bg-chat-primary animate-pulse"></span>
        </Button>
        <div className="flex items-center">
          <div className="relative">
            <Avatar className="h-9 w-9 border border-white/10 ring-2 ring-[#7F5AF0]/20">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>
                {username[0].toUpperCase() + username[1].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.4 h-3 w-3 rounded-full ring-2 ring-ring"></span>
          </div>
          <div className="ml-3 hidden sm:block">
            <div className="font-medium text-secondary-foreground capitalize">
              {username}
            </div>
            <div className="text-xs text-muted-foreground flex items-center">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-chat-green mr-1.5 animate-glow-pulse"></span>
              Active now
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <Search size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <Phone size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <Video size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <MoreHorizontal size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>
      </div>
    </header>
  );
};

export default ChatHeader;
