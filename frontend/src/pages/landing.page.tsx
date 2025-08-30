import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useNavigate } from "react-router";
import Navbar from "@/components/navbar";
import { useAuthModal, useUser } from "@/stores/auth-store";
import useNetworkChange from "@/hooks/use-network-change";

export default function ChatHeroSection() {
  const navigate = useNavigate();
  const { isOnline } = useNetworkChange();

  const { data: user, isLoading } = useUser(isOnline && true);
  const { setAuthModalOpen } = useAuthModal();

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-accent/10 bg-no-repeat"></div>

      <Navbar />

      <main className="transition-transform relative flex-1 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="sm:hidden text-muted-foreground">
          Connect • Collaborate • Create
        </div>
        <div
          className={`inline-flex items-center px-6 py-3 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 text-primary text-sm mb-8 font-medium shadow-lg shadow-primary/10 transition-all duration-1000`}
        >
          <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
          New Messaging Platform
        </div>

        <h1 className="font-medium text-4xl sm:text-5xl lg:text-7xl text-foreground max-w-6xl leading-tight tracking-tight">
          Connect your team with{" "}
          <span
            style={{
              background:
                "linear-gradient(to right, oklch(0.795 0.184 86.047), oklch(0.828 0.189 84.429), oklch(0.769 0.188 70.08))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            instant messaging
          </span>
        </h1>

        <p
          className={`text-muted-foreground sm:text-lg lg:text-xl mb-10 max-w-4xl leading-relaxed font-light`}
        >
          <span className="block mt-2">
            Secure Conversations. Enhanced Collaboration in{" "}
            <span className="font-medium text-primary">Every Channel</span>.
          </span>
          Advanced Chat Platform to{" "}
          <span className="text-primary font-medium">
            Unite Your Entire Team
          </span>
          . Real-Time Communication.{" "}
        </p>

        <div>
          <Button
            onClick={() => {
              if (!user && !isLoading) {
                setAuthModalOpen(true);
              } else {
                navigate("/chat");
              }
            }}
            className="bg-primary/10 backdrop-blur-sm text-primary border border-primary/20 font-semibold !px-8 py-6 rounded-4xl shadow-xl shadow-primary/10 transition-all duration-300 hover:scale-105 group text-sm mb-8 hover:bg-primary/10"
          >
            Start Chatting
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
          </Button>
        </div>
      </main>
    </div>
  );
}
