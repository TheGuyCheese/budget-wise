"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from 'react-markdown';

type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
};

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChatDialog({ open, onOpenChange }: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-message",
      content: "Hi there! I'm your budget assistant. How can I help you with your finances today?",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          history: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const botMessage: Message = {
        id: Date.now().toString() + "-bot",
        content: data.response,
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      
      const errorMessage: Message = {
        id: Date.now().toString() + "-error",
        content: "Sorry, I encountered an error. Please try again later.",
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[85vw] md:max-w-[75vw] lg:max-w-[65vw] xl:max-w-[55vw] 
                               w-full 
                               h-[90vh] sm:h-[85vh] md:h-[80vh] lg:h-[75vh] 
                               p-3 sm:p-4 md:p-6 
                               flex flex-col overflow-hidden">
        <DialogHeader className="pb-2 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl">Budget Assistant</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-1 sm:pr-2 md:pr-4 overflow-y-auto">
          <div className="flex flex-col space-y-3 sm:space-y-4 pb-2 sm:pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-full", 
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "flex flex-col max-w-[90%] sm:max-w-[85%] md:max-w-[80%] rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-left",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}>
                  <div className="w-full break-words">
                    <ReactMarkdown
                      components={{
                        p: ({children, ...props}) => (
                          <p className="mb-1.5 sm:mb-2 last:mb-0" {...props}>
                            {children}
                          </p>
                        ),
                        ul: ({children, ...props}) => (
                          <ul className="list-disc pl-3 sm:pl-4 mb-1.5 sm:mb-2 w-full" {...props}>
                            {children}
                          </ul>
                        ),
                        li: ({children, ...props}) => (
                          <li className="mb-0.5 sm:mb-1" {...props}>
                            {children}
                          </li>
                        ),
                        code: ({children, ...props}) => (
                          <code className="bg-muted-foreground/20 rounded px-1 py-0.5 text-xs sm:text-sm" {...props}>
                            {children}
                          </code>
                        )
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex">
                <div className="flex max-w-[75%] rounded-lg px-3 py-2 text-sm bg-muted">
                  <Skeleton className="h-3 sm:h-4 w-[120px] sm:w-[200px]" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="flex items-center space-x-2 pt-3 sm:pt-4 mt-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your budget..."
            className="text-xs sm:text-sm h-8 sm:h-10 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
          />
          <Button 
            onClick={handleSendMessage} 
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}