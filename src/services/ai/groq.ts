import { postChat } from './client';
import type { ChatMessage } from '@/types/ai';

export const GROQ_CHAT_ENDPOINT = '/api/ai/groq/chat';
export const GROQ_DEFAULT_MODEL = 'llama-3.1-8b-instant';

export function sendGroqChat(messages: ChatMessage[]) {
  return postChat(GROQ_CHAT_ENDPOINT, messages);
}
