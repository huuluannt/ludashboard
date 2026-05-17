import ChatPanel from '@/components/chat/ChatPanel';
import { GROQ_DEFAULT_MODEL, sendGroqChat } from '@/services/ai/groq';

export default function LuChatModule() {
  return (
    <ChatPanel
      title="LuChat"
      provider="Groq"
      defaultModel={GROQ_DEFAULT_MODEL}
      icon="bot"
      storageKey="lu:module:luchat:messages"
      maxPromptLength={12000}
      cooldownMs={2500}
      placeholder="Ask LuChat for a quick answer, coding help, writing, or dashboard support..."
      emptyTitle="Fast chat for everyday work"
      emptyDescription="Use LuChat for concise answers, coding help, writing support, and quick dashboard tasks."
      sendMessage={sendGroqChat}
    />
  );
}
