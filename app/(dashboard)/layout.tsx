import Navbar from "@/components/Navbar";
import React, { ReactNode } from "react";
import ChatButton from "@/components/chat/ChatButton";

function layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen w-full flex-col">
      <Navbar />
      <div className="w-full">{children}</div>
      <ChatButton />
    </div>
  );
}

export default layout;
