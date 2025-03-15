"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import ChatDialog from "./ChatDialog";

export default function ChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-50"
        size="icon"
        variant="default"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      
      <ChatDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
