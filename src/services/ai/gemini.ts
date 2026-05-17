import { postChat } from './client';
import type { ChatMessage } from '@/types/ai';

export const GEMINI_CHAT_ENDPOINT = '/api/ai/gemini/chat';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

export function sendGeminiChat(messages: ChatMessage[]) {
  return postChat(GEMINI_CHAT_ENDPOINT, messages);
}
