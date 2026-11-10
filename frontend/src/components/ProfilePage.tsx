'use client';

import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useChatStore } from "@/store/chat-store";

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { conversations } = useChatStore();

  const totalMessages = conversations.reduce(
    (acc, convo) => acc + convo.messages.length,
    0
  );

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md lg:max-w-none lg:w-[28%] lg:min-w-[300px] bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-xl z-50 transition-transform duration-500 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-4 flex items-center justify-between border-b border-border/50">
        <h2 className="text-lg font-semibold">Profile Settings</h2>

        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-6 space-y-6">

        {/* Name Setting */}
        <div>
          <label className="text-sm text-muted-foreground">Display Name</label>
          <input
            type="text"
            defaultValue="Guest"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Stats */}
        <div className="rounded-xl p-4 bg-muted/20 border border-border/50 backdrop-blur-xl">
          <p className="text-base font-medium">Your Stats</p>

          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Conversations Created:</span>
              <span>{conversations.length}</span>
            </div>

            <div className="flex justify-between">
              <span>Total Messages:</span>
              <span>{totalMessages}</span>
            </div>
          </div>
        </div>

        <Button className="w-full bg-gradient-to-br text-white bg-[#E37B53]  hover:text-[#E37B53] hover:bg-white rounded-xl hover:opacity-90">
          Save Changes
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-auto pb-4">
        Profile settings powered by Elite AI
      </p>
    </div>
  );
}
