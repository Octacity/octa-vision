
'use client';

import type { ChatMessage, Camera } from '@/app/(main)/cameras/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Bot } from 'lucide-react';

interface CameraChatDrawerContentProps {
  chatMessages: ChatMessage[];
  isSendingMessage: boolean;
  selectedCameraForChat: Camera | null; // Only needed for context if the AI message includes camera name
}

const CameraChatDrawerContent: React.FC<CameraChatDrawerContentProps> = ({
  chatMessages,
  isSendingMessage,
  // selectedCameraForChat, // Not directly used in rendering messages if text already has name
}) => {
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {chatMessages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
          <div className="flex items-end space-x-2 max-w-[80%]">
            {msg.sender === 'ai' && (
              <Avatar className="h-8 w-8">
                <div className="bg-primary rounded-full p-1.5 flex items-center justify-center h-full w-full">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
              </Avatar>
            )}
            <div
              className={`p-3 rounded-lg ${
                msg.sender === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-none'
                  : 'bg-muted text-foreground rounded-bl-none'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
            {msg.sender === 'user' && msg.avatar && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={msg.avatar} alt="User" data-ai-hint="user avatar" />
                <AvatarFallback>{/* User initials */}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      ))}
      {isSendingMessage && (
        <div className="flex justify-start mb-3">
          <div className="flex items-end space-x-2">
            <Avatar className="h-8 w-8">
              <div className="bg-primary rounded-full p-1.5 flex items-center justify-center h-full w-full">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
            </Avatar>
            <div className="p-3 rounded-lg bg-muted text-foreground rounded-bl-none">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraChatDrawerContent;
