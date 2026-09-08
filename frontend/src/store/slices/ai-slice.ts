import { StateCreator } from 'zustand';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
  tokens?: number;
  model?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: string;
  tokensUsed: number;
  summary?: string;
}

export interface AISlice {
  conversations: Conversation[];
  currentConversationId: string | null;
  isProcessing: boolean;
  streamingContent: string;
  activeModel: string;
  availableModels: string[];
  reasoningChain: string[];
  currentToolCalls: ToolCall[];

  setCurrentConversation: (id: string | null) => void;
  addMessage: (message: Omit<Message, 'id'>) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  setIsProcessing: (processing: boolean) => void;
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  clearConversations: () => void;
  setActiveModel: (model: string) => void;
  setAvailableModels: (models: string[]) => void;
  addReasoningStep: (step: string) => void;
  clearReasoningChain: () => void;
  addToolCall: (call: ToolCall) => void;
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void;
  clearToolCalls: () => void;
}

let messageCounter = 0;
function generateId(): string {
  messageCounter++;
  return `${Date.now()}-${messageCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

export const createAISlice: StateCreator<AISlice> = (set, get) => ({
  conversations: [],
  currentConversationId: null,
  isProcessing: false,
  streamingContent: '',
  activeModel: 'jarvis-pro',
  availableModels: [
    'jarvis-pro',
    'jarvis-lite',
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-opus',
    'claude-3-sonnet',
  ],
  reasoningChain: [],
  currentToolCalls: [],

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  addMessage: (message) => {
    const { currentConversationId, conversations } = get();
    const newMessage: Message = {
      ...message,
      id: generateId(),
    };

    if (currentConversationId) {
      set({
        conversations: conversations.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [...conv.messages, newMessage],
                updatedAt: Date.now(),
                tokensUsed: (conv.tokensUsed || 0) + (message.tokens || 0),
              }
            : conv
        ),
      });
    } else {
      const newId = generateId();
      const newConv: Conversation = {
        id: newId,
        title: message.content.substring(0, 60) || 'New Conversation',
        messages: [newMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: get().activeModel,
        tokensUsed: message.tokens || 0,
      };
      set({
        conversations: [...conversations, newConv],
        currentConversationId: newId,
      });
    }
  },

  updateMessage: (messageId, updates) => {
    const { currentConversationId, conversations } = get();
    if (!currentConversationId) return;

    set({
      conversations: conversations.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              ),
              updatedAt: Date.now(),
            }
          : conv
      ),
    });
  },

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),

  setIsProcessing: (processing) => set({ isProcessing: processing }),

  createConversation: (title) => {
    const newId = generateId();
    const newConv: Conversation = {
      id: newId,
      title: title || 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: get().activeModel,
      tokensUsed: 0,
    };
    set((state) => ({
      conversations: [newConv, ...state.conversations],
      currentConversationId: newId,
    }));
    return newId;
  },

  deleteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId:
        state.currentConversationId === id
          ? state.conversations.find((c) => c.id !== id)?.id ?? null
          : state.currentConversationId,
    })),

  clearConversations: () =>
    set({
      conversations: [],
      currentConversationId: null,
    }),

  setActiveModel: (model) => set({ activeModel: model }),
  setAvailableModels: (models) => set({ availableModels: models }),

  addReasoningStep: (step) =>
    set((state) => ({ reasoningChain: [...state.reasoningChain, step] })),

  clearReasoningChain: () => set({ reasoningChain: [] }),

  addToolCall: (call) =>
    set((state) => ({ currentToolCalls: [...state.currentToolCalls, call] })),

  updateToolCall: (id, updates) =>
    set((state) => ({
      currentToolCalls: state.currentToolCalls.map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    })),

  clearToolCalls: () => set({ currentToolCalls: [] }),
});
