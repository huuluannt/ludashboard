import ChatPanel from '@/components/chat/ChatPanel';
import { GEMINI_DEFAULT_MODEL, sendGeminiChat } from '@/services/ai/gemini';

export default function LuGeminiModule() {
  return (
    <ChatPanel
      title="LuGemini"
      provider="Gemini"
      defaultModel={GEMINI_DEFAULT_MODEL}
      icon="sparkles"
      storageKey="lu:module:lugemini:messages"
      maxPromptLength={50000}
      cooldownMs={4000}
      placeholder="Paste a long question, notes, source text, or research task for LuGemini..."
      emptyTitle="Research and long-context assistant"
      emptyDescription="Use LuGemini for summaries, document analysis, research outlines, and structured long-form reasoning."
      sendMessage={sendGeminiChat}
    />
  );
}
