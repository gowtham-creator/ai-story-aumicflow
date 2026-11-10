'use client';

import { useState } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  LogOut,
  User,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function Sidebar({
  collapsed,
  onOpenProfile,
}: {
  collapsed: boolean;
  onOpenProfile: () => void;
}) {
  const {
    conversations,
    activeConversationId,
    deleteConversation,
    setActiveConversation,
    updateConversationTitle,
    clearConversation,
    clearAllConversations,
  } = useChatStore();

  const { user, logout } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const navigate = useNavigate();

  const handleNewChat = () => setActiveConversation(null);
  const handleSelectConversation = (id: string) => setActiveConversation(id);
  const handleStartEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };
  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) updateConversationTitle(editingId, editTitle.trim());
    setEditingId(null);
    setEditTitle('');
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit();
    else if (e.key === 'Escape') setEditingId(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };


  return (
    <div
      className={cn(
        'flex flex-col h-full border border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden rounded-r-2xl',
        collapsed ? 'w-[72px]' : 'w-80'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-center border-b border-border/30 h-14 px-3',
          !collapsed && 'justify-between px-4'
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-foreground" />
          </div>
          {!collapsed && <span className="font-semibold text-lg">Aumic Flow</span>}
        </div>
      </div>

      {/* New Chat */}
      <div className={cn('px-4 py-3', collapsed && 'px-2 flex justify-center')}>
        <Button
          onClick={handleNewChat}
          size={collapsed ? 'icon' : 'default'}
          className={cn(
            'text-[#E37B53] bg-muted/80 hover:bg-white hover:text-[#E37B53]',
            collapsed ? 'h-10 w-10' : 'w-full justify-start gap-2'
          )}
        >
          <Plus className="w-5 h-5" />
          {!collapsed && <span>New Chat</span>}
        </Button>
      </div>

{/* Conversations */}
{collapsed ? (
  <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto py-2 scrollbar-premium">
    {conversations.map((conv) => (
      <Button
        key={conv.id}
        size="icon"
        variant={activeConversationId === conv.id ? 'secondary' : 'ghost'}
        className="h-9 w-9"
        title={conv.title}
        onClick={() => handleSelectConversation(conv.id)}
      >
        <MessageSquare className="w-4 h-4" />
      </Button>
    ))}
  </div>
) : (
  <ScrollArea className="flex-1 px-2 scrollbar-premium">
    <div className="space-y-1 py-2">
      {conversations.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground text-sm">
          No conversations yet. <br />
          Start a new chat!
        </div>
      ) : (
        conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              'group relative rounded-lg transition-all duration-200',
              activeConversationId === conv.id
                ? 'bg-white/90 border border-white/20'
                : 'hover:bg-muted/50'
            )}
          >
            {editingId === conv.id ? (
              <div className="px-3 py-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
            ) : (
              <div
                onClick={() => handleSelectConversation(conv.id)}
                role="button"
                className="w-full px-3 py-2.5 flex items-start gap-2 text-left cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{conv.title}</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white border shadow-md">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(conv.id, conv.title);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async (e) => {
                        e.stopPropagation();
                        await clearConversation(conv.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear messages
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  </ScrollArea>
)}
{/* Footer */}
<div
  className={cn(
    'mt-2 pt-3',
    collapsed ? 'flex flex-col items-center gap-3 pb-4' : 'px-4 flex flex-col items-stretch'
  )}
>
  {collapsed ? (
    <>
      <Button
        size="icon"
        variant="ghost"
        title="Clear All Chats"
        onClick={async () => {
          if (window.confirm('Delete all conversations?')) {
            await clearAllConversations();
          }
        }}
        className="h-10 w-10 rounded-xl"
      >
        <Trash2 className="w-5 h-5" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        title="Logout"
        onClick={handleLogout}
        className="h-10 w-10 rounded-xl"
      >
        <LogOut className="w-5 h-5" />
      </Button>
    </>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-auto py-3 rounded-xl hover:bg-muted/80 transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-foreground" />
          </div>
          <div className="flex-1 text-left overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white/85 border">
          <DropdownMenuItem
            onClick={() => onOpenProfile()}
          >
            <User className="w-4 h-4 mr-2" /> Profile Settings
          </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            if (window.confirm('Delete all conversations?')) {
              await clearAllConversations();
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Clear All Conversations
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
          <LogOut className="w-4 h-4 mr-2" /> Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )}
</div>
    </div>
  );
}
