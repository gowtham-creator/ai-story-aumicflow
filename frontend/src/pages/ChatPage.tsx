'use client';
import { useState, useRef, useEffect } from 'react';
import { useChatStore, Message } from '@/store/chat-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AudioRecorder from '@/components/AudioRecorder';
import StoryCanvas from '@/components/StoryCanvas';
import ProfileDrawer from '@/components/ProfilePage';
// import { LanguageSelector } from '@/components/LanguageSelector';
// import { AudioVisualizer } from '@/components/AudioVisualizer'; 

import {
  Menu,
  Loader2,
  User,
  Sparkles,
  ArrowUp,
  ChevronLeft,
  Plus,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sidebar } from '@/components/Sidebar';
import CreativeWritingPanel from '@/components/CreativeWritingPanel';
import { cn } from '@/lib/utils';


function ChatPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { editMessage } = useChatStore();
  const [input, setInput] = useState("");
  const [liveDraft, setLiveDraft] = useState("");
  const [userIsTyping, setUserIsTyping] = useState(false);
  const {
    activeConversationId,
    addMessageToConversation,
    getActiveConversation,
    getCreativePrompt,
    clearConversation,
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
  } = useChatStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');
  const [showParams, setShowParams] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [storyContent, setStoryContent] = useState('');
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);




  const [language, setLanguage] = useState("en");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://backend:5000/api';

  const activeConversation = getActiveConversation();
  const messages = activeConversation?.messages || [];

  // ✅ Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingMessage]);

  // ✅ Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // ✅ Close sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleSaveEdit = (index: number) => {
    if (!activeConversationId || !editedContent.trim()) return;
    editMessage(activeConversationId, index, editedContent.trim());
    setEditingMessageId(null);
    setEditedContent('');
  };
  const handleVoiceTranscription = (transcribedText: string) => {
  console.log("📝 Voice transcription received:", transcribedText);
  
  if (!transcribedText.trim()) return;
  
  // Set input and immediately send
  setUserIsTyping(true); 
  setInput(transcribedText);
  setLiveDraft("");
  // setUserIsTyping(false);
  
  // Trigger send after state update
  setTimeout(() => {
    const form = new FormData();
    document.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true }));
  }, 50);
};
// 🧠 Send Message to Flask Backend (streaming)
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() || isStreaming) return;

  const { creativeSettings } = useChatStore.getState();
  const fullInput = input.trim();

  let conversationId = activeConversationId;
  if (!conversationId) {
    conversationId = useChatStore.getState().createConversation();
  }

  addMessageToConversation(conversationId, {
    role: "user",
    content: fullInput,
    timestamp: Date.now(),
  });

  setInput("");

  try {
    const token = localStorage.getItem("DEVV_CODE_SID");

    setIsStreaming(true);
    setCurrentStreamingMessage("");

    const res = await fetch(`${API_URL}/chat_stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        payload: {
          message: fullInput,
          params: creativeSettings,
          conversation_id: conversationId,
        },
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullReply = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      fullReply += chunk;
      setCurrentStreamingMessage(fullReply);
    }

    const reply = fullReply.trim() || "[No response]";

    addMessageToConversation(conversationId, {
      role: "assistant",
      content: reply,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(error);
    toast({
      title: "Error",
      description: "Something went wrong.",
      variant: "destructive",
    });
  } finally {
    setIsStreaming(false);
    setCurrentStreamingMessage("");
  }
};

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleClearChat = async () => {
    if (activeConversationId) {
      await clearConversation(activeConversationId);
      toast({
        title: "Chat cleared",
        description: "All messages have been removed from this chat.",
      });
    }
  };

  const renderMessage = (content: string) => (
    <div className="prose-ai">
      {content.split('\n').map((line, i) => (
        <p key={i}>{line || '\u00A0'}</p>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out bg-muted backdrop-blur-xl',
          isMobile
            ? cn(
                'fixed inset-y-0 left-0 z-50 transform',
                isSidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full w-80'
              )
            : 'relative'
        )}
      >
        <Sidebar collapsed={!isSidebarOpen} 
        onOpenProfile={() => setProfileOpen(true)}/>
      </div>

      {/* Overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white/60 min-h-0">
        <header className="sticky top-0 z-10 bg-white/70 backdrop-blur">
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="rounded-xl hover:bg-muted/80"
              >
                {isSidebarOpen ? (
                  <ChevronLeft className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
              {activeConversation && (
                <h1 className="font-semibold text-sm truncate max-w-[200px] sm:max-w-none">
                  {activeConversation.title}
                </h1>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearChat}
              title="Clear Chat"
              className="rounded-xl hover:bg-muted/80"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto scrollbar-premium min-h-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center text-muted-foreground">
                  <h2 className="text-xl font-medium">How can I help?</h2>
                  <p className="text-sm mt-2 max-w-sm">
                    Ask anything or start a new conversation.
                  </p>
                </div>
              )}          

            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 group',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-muted/40 border border-border flex items-center justify-center">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="relative flex flex-col items-end max-w-[85%] sm:max-w-[80%]">
                    <div
                      className={cn(
                        'rounded-2xl px-4 sm:px-5 py-3 sm:py-4',
                        message.role === 'user'
                          ? 'bg-white/50 dark:bg-zinc-900/40 border border-border/40 shadow-sm'
                          : 'bg-muted/50 border border-border/40'
                      )}
                    >
                      {editingMessageId === index ? (
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit(index);
                            } else if (e.key === 'Escape') {
                              setEditingMessageId(null);
                              setEditedContent('');
                            }
                          }}
                          className="w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                          rows={2}
                          autoFocus
                        />
                      ) : (
                        renderMessage(message.content)
                      )}
                    </div>

                    {message.role === 'assistant' && (
                      <div className="absolute -bottom-6 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 px-2 rounded-md"
                          onClick={() => {
                            setStoryContent((prev) => prev + '\n\n' + message.content);
                            toast({ title: '✨ Added to Story Canvas' });
                          }}
                        >
                          ➕ Add to Canvas
                        </Button>
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-muted/40 border border-border flex items-center justify-center">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/80" />
                    </div>
                  )}
                </div>
              ))}

              {/* ✅ STREAMING MESSAGE PREVIEW GOES **AFTER** THE MESSAGES MAP */}
              {isStreaming && currentStreamingMessage && (
                <div className="flex justify-start gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="glass-strong rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-lg max-w-[85%] sm:max-w-[80%]">
                    {renderMessage(currentStreamingMessage)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer / Input */}
        <footer className="sticky bottom-0 bg-white/40 border-0 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
            <form onSubmit={handleSendMessage} className="w-full">
              <div className="flex w-full flex-wrap items-stretch gap-2 border border-border/40 rounded-lg bg-muted/30 px-3 py-2 sm:flex-nowrap sm:items-center sm:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Creative Parameters"
                  onClick={() => setShowParams(!showParams)}
                  className={cn(
                    'h-10 w-10 rounded-xl transition-all flex items-center justify-center shadow-md border border-transparent flex-shrink-0',
                    'text-white hover:text-[#E37B53] hover:bg-white bg-[#E37B53] border border-border/40 shadow-sm',
                    showParams && 'from-primary to-secondary scale-105'
                  )}
                >
                  <Plus
                    className={cn(
                      'w-5 h-5 transition-transform duration-300',
                      showParams && 'rotate-45 scale-110'
                    )}
                  />
                </Button>
                  <AudioRecorder
                    onStream={setMicStream}
                    onPartial={(text: string) => {
                      setLiveDraft(text); // just show what user is currently saying
                    }}

                    onFinal={(text: string) => {
                      if (!text.trim()) return;

                      setInput(prev => (prev.trim() ? prev + " " + text : text)); // append spoken text
                      setLiveDraft("");    // clear the draft
                      setUserIsTyping(true); // lock input mode
                    }}
                  />

                  {/* {micStream && (
                    <AudioVisualizer
                      stream={micStream}
                      className="rounded-md border border-border/40 ml-2"
                  />
                  )
                  } */}


                <Textarea
                  ref={textareaRef}
                  value={userIsTyping ? input : (input + (liveDraft ? " " + liveDraft : ""))}
                  onChange={(e) => {
                    setUserIsTyping(true);
                    setInput(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Elite AI..."
                  disabled={isStreaming}
                  className="min-h-[48px] flex-1 min-w-[200px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-hidden text-sm sm:text-base placeholder:text-muted-foreground"
                  rows={1}
                />

                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isStreaming}
                  className="h-10 w-full rounded-md bg-[#E37B53] hover:bg-white text-white hover:text-[#E37B53] border border-border/40 sm:w-10"
                >
                  {isStreaming ? (
                    <Loader2 className="w-7 h-7 animate-spin text-white" />
                  ) : (
                    <ArrowUp className="w-7 h-7 text-white" />
                  )}
                </Button>
              </div>
            </form>

            <div
              className={cn(
                'transition-all duration-500 ease-in-out overflow-hidden',
                showParams
                  ? 'max-h-[1100px] mt-4 opacity-100'
                  : 'max-h-0 mt-0 opacity-0'
              )}
            >
              <div className="rounded-2xl shadow-inner glass-strong p-4 transition-all duration-300">
                <CreativeWritingPanel />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Aumic Flow can make mistakes. Verify important information.
            </p>
          </div>
        </footer>
      </div>
      {/* ✅ Fixed Story Canvas Sidebar (full height, toggleable) */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-40 transition-all duration-500 ease-in-out w-full sm:w-[420px] lg:w-[30%]',
          isCanvasOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="relative h-full border-l border-border/50 bg-background/90 backdrop-blur-xl shadow-xl overflow-y-auto p-4">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCanvasOpen(false)}
            className="absolute top-4 left-4 rounded-full hover:bg-muted/70"
            title="Close Canvas"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="mt-12">
            <StoryCanvas story={storyContent} title={activeConversation?.title} />
          </div>
        </div>
      </div>

      {/* Floating button to reopen canvas */}
      {!isCanvasOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed right-4 z-50 rounded-full shadow-md
                    bg-muted/50 backdrop-blur border border-border/40
                    hover:bg-muted/70 hover:scale-105 transition-transform
                    bottom-24 sm:bottom-auto sm:top-1/2"
          onClick={() => setIsCanvasOpen(true)}
          title="Open Story Canvas"
        >
          <ChevronLeft className="w-5 h-5 rotate-180 text-foreground" />
        </Button>

      )}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export default ChatPage;
