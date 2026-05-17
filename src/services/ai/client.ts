import type { ChatMessage, ChatResponse } from '@/types/ai';

export async function postChat(endpoint: string, messages: ChatMessage[]): Promise<ChatResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || 'AI backend is not available. Check API route configuration.');
  }

  if (!payload?.message?.content) {
    throw new Error('AI provider returned an empty response.');
  }

  return payload;
}
