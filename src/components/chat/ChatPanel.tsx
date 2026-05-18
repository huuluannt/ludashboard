import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useModuleSurface } from '@/layout/ModuleSurfaceContext';
import type { ChatMessage, ChatResponse } from '@/types/ai';

const RIGHT_SIDEBAR_CHAT_CLEAR_EVENT = 'lu:right-sidebar:clear-chat';

interface ChatPanelProps {
  title: string;
  provider: string;
  defaultModel: string;
  icon: string;
  storageKey: string;
  maxPromptLength: number;
  cooldownMs: number;
  placeholder: string;
  emptyTitle: string;
  emptyDescription: string;
  sendMessage: (messages: ChatMessage[]) => Promise<ChatResponse>;
}

export default function ChatPanel({
  title,
  provider,
  defaultModel,
  icon,
  storageKey,
  maxPromptLength,
  cooldownMs,
  placeholder,
  emptyTitle,
  emptyDescription,
  sendMessage,
}: ChatPanelProps) {
  const compact = useModuleSurface() === 'right-sidebar';
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages(storageKey));
  const [input, setInput] = useState('');
  const [model, setModel] = useState(defaultModel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSentAt, setLastSentAt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== 'system'),
    [messages],
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibleMessages.length, loading]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError('');
    setInput('');
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!compact) return;
    window.addEventListener(RIGHT_SIDEBAR_CHAT_CLEAR_EVENT, clearChat);
    return () => window.removeEventListener(RIGHT_SIDEBAR_CHAT_CLEAR_EVENT, clearChat);
  }, [clearChat, compact]);

  const submit = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    if (prompt.length > maxPromptLength) {
      setError(`Prompt is too long. Maximum ${maxPromptLength.toLocaleString()} characters.`);
      return;
    }

    const elapsed = Date.now() - lastSentAt;
    if (elapsed < cooldownMs) {
      setError(`Please wait ${Math.ceil((cooldownMs - elapsed) / 1000)}s before sending another request.`);
      return;
    }

    const nextMessages = [...messages, { role: 'user' as const, content: prompt }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);
    setLastSentAt(Date.now());

    try {
      const response = await sendMessage(nextMessages);
      setMessages((current) => [...current, response.message]);
      if (response.model) setModel(response.model);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed.';
      setError(message);
      setMessages((current) => [...current, { role: 'assistant', content: message }]);
    } finally {
      setLoading(false);
    }
  }, [cooldownMs, input, lastSentAt, loading, maxPromptLength, messages, sendMessage]);

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      {!compact && (
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[var(--color-border-subtle)] px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name={icon} size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="truncate text-xs text-[var(--color-text-tertiary)]">
              {provider} | {model}
            </p>
          </div>
          <button
            type="button"
            onClick={clearChat}
            disabled={messages.length === 0 || loading}
            className="ml-auto flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Icon name="trash" size={14} />
            Clear
          </button>
        </header>
      )}

      <main
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto bg-[var(--color-surface-muted)] ${
          compact ? 'px-3 py-3' : 'px-4 py-5'
        }`}
      >
        {visibleMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className={compact ? 'max-w-[260px]' : 'max-w-sm'}>
              <div
                className={`mx-auto flex items-center justify-center border border-[var(--color-border)] bg-white text-[var(--color-accent)] ${
                  compact ? 'mb-3 h-10 w-10 rounded-xl' : 'mb-4 h-14 w-14 rounded-2xl'
                }`}
              >
                <Icon name={icon} size={compact ? 18 : 24} />
              </div>
              <h3 className={compact ? 'text-sm font-semibold' : 'text-base font-semibold'}>{emptyTitle}</h3>
              <p className={`mt-2 text-[var(--color-text-tertiary)] ${compact ? 'text-xs leading-5' : 'text-sm leading-6'}`}>
                {emptyDescription}
              </p>
            </div>
          </div>
        ) : (
          <div className={`mx-auto flex flex-col ${compact ? 'max-w-full gap-2' : 'max-w-4xl gap-3'}`}>
            {visibleMessages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} message={message} compact={compact} />
            ))}
            {loading && (
              <div
                className={`flex items-center gap-2 self-start border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-tertiary)] ${
                  compact ? 'rounded-xl px-3 py-2 text-xs' : 'rounded-2xl px-4 py-3 text-sm'
                }`}
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
                Thinking...
              </div>
            )}
          </div>
        )}
      </main>

      <footer className={`flex-shrink-0 border-t border-[var(--color-border-subtle)] bg-white ${compact ? 'p-3' : 'p-4'}`}>
        <div className="mx-auto max-w-4xl">
          {error && (
            <div
              className={`mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[var(--color-danger)] ${
                compact ? 'text-xs' : 'text-sm'
              }`}
            >
              {error}
            </div>
          )}
          <div className={`flex items-end ${compact ? 'gap-2' : 'gap-3'}`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={compact ? 2 : 3}
              maxLength={maxPromptLength}
              placeholder={placeholder}
              className={`flex-1 resize-none border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white ${
                compact
                  ? 'max-h-28 min-h-14 rounded-xl px-3 py-2 text-xs leading-5'
                  : 'max-h-40 min-h-20 rounded-2xl px-4 py-3 text-sm leading-6'
              }`}
            />
            <button
              type="button"
              onClick={submit}
              disabled={loading || !input.trim()}
              className={`flex flex-shrink-0 items-center justify-center bg-[var(--color-text-primary)] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 ${
                compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
              }`}
              title="Send"
            >
              <Icon name="navigation" size={compact ? 14 : 16} />
            </button>
          </div>
          <div className={`mt-2 flex items-center justify-between text-[var(--color-text-tertiary)] ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            <span>Enter to send, Shift+Enter for new line</span>
            <span>{input.length.toLocaleString()} / {maxPromptLength.toLocaleString()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({ message, compact }: { message: ChatMessage; compact: boolean }) {
  const isUser = message.role === 'user';

  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`whitespace-pre-wrap shadow-sm ${
          compact
            ? 'max-w-[88%] rounded-xl px-3 py-2 text-xs leading-5'
            : 'max-w-[min(760px,85%)] rounded-2xl px-4 py-3 text-sm leading-6'
        } ${
          isUser
            ? 'bg-[var(--color-text-primary)] text-white'
            : 'border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)]'
        }`}
      >
        {message.content}
      </div>
    </article>
  );
}

function loadStoredMessages(storageKey: string): ChatMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string',
    );
  } catch {
    return [];
  }
}
