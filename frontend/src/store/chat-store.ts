import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// import { useAuthStore } from "@/store/auth-store";


const API_URL = import.meta.env.VITE_API_URL || "http://backend:5000/api";

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface CreativeSettings {
  genre?: string;
  tone?: string;
  character?: string;
  setting?: string;
  theme?: string;
  narrativeStyle?: string;
  inspiration?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  creativeSettings: CreativeSettings;
  isSidebarOpen: boolean;

  createConversation: () => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  addMessageToConversation: (id: string, message: Message) => void;
  clearConversation: (id: string) => Promise<void>;
  clearAllConversations: () => Promise<void>; // ✅ Added this
  getActiveConversation: () => Conversation | null;
  fetchUserHistory: () => Promise<void>;
  editMessage: (id: string, index: number, newContent: string) => void;



  updateCreativeSettings: (settings: Partial<CreativeSettings>) => void;
  clearCreativeSettings: () => void;
  getCreativePrompt: () => string;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const generateId = () =>
  crypto.randomUUID();

const generateTitle = (messages: Message[]): string => {
  if (messages.length === 0) return 'New Conversation';
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage) return 'New Conversation';
  const content = firstUserMessage.content;
  return content.length <= 40 ? content : content.substring(0, 37) + '...';
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      creativeSettings: {},
      isSidebarOpen: true,

      // Create a new "unsaved" conversation session
      createConversation: () => {
        const id = generateId();
        const newConversation: Conversation = {
          id,
          title: 'New Conversation',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          activeConversationId: id,
        }));

        return id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          const newActiveId =
            state.activeConversationId === id
              ? filtered[0]?.id || null
              : state.activeConversationId;
          return { conversations: filtered, activeConversationId: newActiveId };
        });
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      updateConversationTitle: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
      },
            // ✅ Fetch user chat history from backend
      fetchUserHistory: async () => {
        const token = localStorage.getItem("DEVV_CODE_SID");
        if (!token) return;

        try {
          const res = await fetch(`${API_URL}/history`, {
            headers: { "Authorization": `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("Failed to fetch chat history");

          const data = await res.json(); // [{conversation_id,title,created_at,updated_at,messages:[...]}]

          const conversations = data.map((c: any) => ({
            id: c.conversation_id,
            title: c.title || "Conversation",
            messages: (c.messages || []).map((m: any) => ({
              role: m.role,
              content: m.content,
              timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
            })),
            createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
            updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
          }));

          // newest last -> we keep your UX same
          conversations.sort((a: any, b: any) => a.createdAt - b.createdAt);

          set({
            conversations,
            activeConversationId: conversations[conversations.length - 1]?.id || null,
          });
        } catch (err) {
          console.error("Error fetching history:", err);
        }
      },
      editMessage: (id: string, index: number, newContent: string) =>
  set((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === id
        ? {
            ...c,
            messages: c.messages.map((m, i) =>
              i === index ? { ...m, content: newContent, timestamp: Date.now() } : m
            ),
            updatedAt: Date.now(),
          }
        : c
    ),
  })),
            // Only save the conversation once the first message is added
      addMessageToConversation: (id, message) => {
        set((state) => {
          let conv = state.conversations.find((c) => c.id === id);

          // 🧠 If no conversation exists yet, create a new one automatically
          if (!conv) {
            const newId = generateId();
            const newConversation: Conversation = {
              id: newId,
              title: generateTitle([message]),
              messages: [message],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            return {
              conversations: [newConversation, ...state.conversations],
              activeConversationId: newId,
            };
          }

          const updatedMessages = [...conv.messages, message];
          const title =
            conv.title === 'New Conversation'
              ? generateTitle(updatedMessages)
              : conv.title;

          const updatedConversation = {
            ...conv,
            messages: updatedMessages,
            title,
            updatedAt: Date.now(),
          };

          return {
            conversations: state.conversations.map((c) =>
              c.id === id ? updatedConversation : c
            ),
          };
        });
      },

      // ✅ Clears ALL conversations (for profile dropdown)
      clearConversation: async (id) => {
            // Clear in DB
            await fetch(`${API_URL}/clear_conversation`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversation_id: id }),
            });

            // Clear UI
            set((state) => ({
              conversations: state.conversations.map((c) =>
                c.id === id
                  ? { ...c, messages: [], title: "New Conversation", updatedAt: Date.now() }
                  : c
              ),
            }));
          },

          clearAllConversations: async () => {
            // Clear all in DB
            await fetch(`${API_URL}/clear_all_conversations`, { method: "POST" });

            // Clear UI
            set({ conversations: [], activeConversationId: null });
          },


      getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId) || null;
      },

      updateCreativeSettings: (settings) => {
        set((state) => ({
          creativeSettings: { ...state.creativeSettings, ...settings },
        }));
      },

      clearCreativeSettings: () => set({ creativeSettings: {} }),

      getCreativePrompt: () => {
        const { creativeSettings } = get();
        const parts: string[] = [];

        if (creativeSettings.genre) parts.push(`Genre: ${creativeSettings.genre}`);
        if (creativeSettings.tone) parts.push(`Tone/Mood: ${creativeSettings.tone}`);
        if (creativeSettings.character)
          parts.push(`Character: ${creativeSettings.character}`);
        if (creativeSettings.setting)
          parts.push(`Setting: ${creativeSettings.setting}`);
        if (creativeSettings.theme)
          parts.push(`Theme: ${creativeSettings.theme}`);
        if (creativeSettings.narrativeStyle)
          parts.push(`Narrative Style: ${creativeSettings.narrativeStyle}`);
        if (creativeSettings.inspiration)
          parts.push(`Inspiration: ${creativeSettings.inspiration}`);

        if (parts.length === 0) return '';
        return `[Creative Writing Context]\n${parts.join('\n')}\n\n`;
      },

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        creativeSettings: state.creativeSettings,
        isSidebarOpen: state.isSidebarOpen,
      }),
    }
  )
);

