import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import Icon from '@/components/Icon';
import { app } from '@/firebase/config';

const LANGUAGES = [
  { code: 'auto', label: 'Auto detect' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese Simplified' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
];

export default function LuDichModule() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('vi');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');

  const translate = async () => {
    const text = sourceText.trim();
    if (!text) return;
    const user = getAuth(app).currentUser;
    if (!user) {
      setError('Sign in to LuDashboard before using LuDich.');
      return;
    }

    setTranslating(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/translate/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          q: text,
          source: sourceLanguage === 'auto' ? '' : sourceLanguage,
          target: targetLanguage,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'LuDich request failed.');
      setTranslatedText(String(data.translatedText || ''));
      setDetectedLanguage(String(data.detectedSourceLanguage || ''));
    } catch (translateError) {
      setError(translateError instanceof Error ? translateError.message : 'Unable to translate text.');
    } finally {
      setTranslating(false);
    }
  };

  const swapLanguages = () => {
    if (sourceLanguage === 'auto') return;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[210px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="languages" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuDich</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">Google Translate API</p>
          </div>
        </div>

        <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} className="h-8 min-w-[140px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white">
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>{language.label}</option>
          ))}
        </select>

        <button type="button" onClick={swapLanguages} disabled={sourceLanguage === 'auto'} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent)] disabled:opacity-40">
          <Icon name="rotate-cw" size={14} />
        </button>

        <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="h-8 min-w-[140px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white">
          {LANGUAGES.filter((language) => language.code !== 'auto').map((language) => (
            <option key={language.code} value={language.code}>{language.label}</option>
          ))}
        </select>

        <button type="button" onClick={translate} disabled={translating || !sourceText.trim()} className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">
          <Icon name="languages" size={13} />
          {translating ? 'Translating...' : 'Translate'}
        </button>
      </header>

      {error && (
        <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2">
          <p className="text-xs text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 bg-[var(--color-surface-muted)] p-3 lg:grid-cols-2">
        <section className="flex min-h-[280px] flex-col rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="border-b border-[var(--color-border-subtle)] px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)]">Source</div>
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            className="min-h-0 flex-1 resize-none rounded-b-2xl bg-transparent p-4 text-sm leading-7 outline-none placeholder:text-[var(--color-text-tertiary)]"
            placeholder="Enter text to translate..."
          />
        </section>

        <section className="flex min-h-[280px] flex-col rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)]">
            <span>Translation</span>
            {detectedLanguage && <span className="text-[10px] text-[var(--color-text-tertiary)]">Detected: {detectedLanguage}</span>}
          </div>
          <div className="min-h-0 flex-1 whitespace-pre-wrap p-4 text-sm leading-7">
            {translatedText || <span className="text-[var(--color-text-tertiary)]">Translation will appear here.</span>}
          </div>
        </section>
      </main>
    </div>
  );
}
