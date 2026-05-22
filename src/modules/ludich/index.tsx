import { useEffect, useState } from 'react';
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

const TARGET_LANGUAGES = [
  { code: 'auto-pair', label: 'Vietnamese <-> English' },
  ...LANGUAGES.filter((language) => language.code !== 'auto'),
];

const languageLabelByCode = new Map(TARGET_LANGUAGES.map((language) => [language.code, language.label]));
const GOOGLE_TRANSLATE_URL = 'https://translate.google.com.vn/';

export default function LuDichModule() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('auto-pair');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [resolvedTargetLanguage, setResolvedTargetLanguage] = useState('');
  const [translating, setTranslating] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<'source' | 'translation' | null>(null);
  const [speakingTarget, setSpeakingTarget] = useState<'source' | 'translation' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => window.speechSynthesis?.cancel();
  }, []);

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
      setResolvedTargetLanguage(String(data.targetLanguage || ''));
    } catch (translateError) {
      setError(translateError instanceof Error ? translateError.message : 'Unable to translate text.');
    } finally {
      setTranslating(false);
    }
  };

  const swapLanguages = () => {
    if (sourceLanguage === 'auto' || targetLanguage === 'auto-pair') return;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
    setResolvedTargetLanguage(sourceLanguage);
  };

  const copyText = async (kind: 'source' | 'translation', value: string) => {
    if (!value) return;
    await copyTextToClipboard(value);
    setCopiedTarget(kind);
    window.setTimeout(() => {
      setCopiedTarget((current) => (current === kind ? null : current));
    }, 1100);
  };

  const clearSource = () => {
    window.speechSynthesis?.cancel();
    setSourceText('');
    setTranslatedText('');
    setDetectedLanguage('');
    setResolvedTargetLanguage('');
    setCopiedTarget(null);
    setSpeakingTarget(null);
    setError('');
  };

  const speakText = (kind: 'source' | 'translation', value: string, languageCode: string) => {
    const text = value.trim();
    if (!text || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const speechLanguage = normalizeSpeechLanguage(languageCode);
    utterance.lang = speechLanguage;
    const voice = selectSpeechVoice(speechLanguage);
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeakingTarget((current) => (current === kind ? null : current));
    utterance.onerror = () => setSpeakingTarget((current) => (current === kind ? null : current));
    setSpeakingTarget(kind);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[210px] flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => window.open(GOOGLE_TRANSLATE_URL, '_blank', 'noopener,noreferrer')}
            title="Open Google Translate"
            aria-label="Open Google Translate"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)] transition-colors hover:bg-white"
          >
            <Icon name="languages" size={17} />
          </button>
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

        <button type="button" onClick={swapLanguages} disabled={sourceLanguage === 'auto' || targetLanguage === 'auto-pair'} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent)] disabled:opacity-40">
          <Icon name="rotate-cw" size={14} />
        </button>

        <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="h-8 min-w-[140px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white">
          {TARGET_LANGUAGES.map((language) => (
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
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)]">
            <span>Source</span>
            <div className="flex items-center gap-1.5">
              <HeaderIconButton
                active={speakingTarget === 'source'}
                disabled={!sourceText}
                icon="volume-2"
                label="Read source text"
                onClick={() => speakText('source', sourceText, resolveSpeechSourceLanguage(sourceLanguage, detectedLanguage, sourceText))}
              />
              <button
                type="button"
                onClick={clearSource}
                disabled={!sourceText && !translatedText && !error}
                className="h-7 rounded-lg bg-[var(--color-text-primary)] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void translate();
                if (isTouchInputDevice()) event.currentTarget.blur();
              }}
              className="h-full w-full resize-none rounded-b-2xl bg-transparent p-4 pr-12 text-sm leading-7 outline-none placeholder:text-[var(--color-text-tertiary)]"
              placeholder="Enter text to translate..."
            />
            <CopyButton
              copied={copiedTarget === 'source'}
              disabled={!sourceText}
              label="Copy source text"
              onClick={() => void copyText('source', sourceText)}
            />
          </div>
        </section>

        <section className="flex min-h-[280px] flex-col rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2">
              <span>Translation</span>
              <HeaderIconButton
                active={speakingTarget === 'translation'}
                disabled={!translatedText}
                icon="volume-2"
                label="Read translation"
                onClick={() => speakText('translation', translatedText, resolveSpeechTargetLanguage(targetLanguage, resolvedTargetLanguage, detectedLanguage))}
              />
            </div>
            <div className="min-w-0 text-right">
              {(detectedLanguage || resolvedTargetLanguage) && (
                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                  {detectedLanguage ? `Detected: ${detectedLanguage}` : ''}
                  {resolvedTargetLanguage ? ` -> ${languageLabelByCode.get(resolvedTargetLanguage) || resolvedTargetLanguage}` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="relative min-h-0 flex-1 whitespace-pre-wrap p-4 pr-12 text-sm leading-7">
            <CopyButton
              copied={copiedTarget === 'translation'}
              disabled={!translatedText}
              label="Copy translation"
              onClick={() => void copyText('translation', translatedText)}
            />
            {translatedText || <span className="text-[var(--color-text-tertiary)]">Translation will appear here.</span>}
          </div>
        </section>
      </main>
    </div>
  );
}

function HeaderIconButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
      }`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

function CopyButton({
  copied,
  disabled,
  label,
  onClick,
}: {
  copied: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={copied ? 'Copied' : label}
      aria-label={label}
      className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white/90 shadow-sm transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-0 ${
        copied ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
      }`}
    >
      <Icon name="copy" size={13} />
    </button>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function normalizeSpeechLanguage(languageCode: string) {
  const code = String(languageCode || '').toLowerCase();
  if (code.startsWith('vi')) return 'vi-VN';
  if (code.startsWith('en')) return 'en-US';
  if (code.startsWith('ja')) return 'ja-JP';
  if (code.startsWith('ko')) return 'ko-KR';
  if (code.startsWith('zh')) return 'zh-CN';
  if (code.startsWith('fr')) return 'fr-FR';
  if (code.startsWith('de')) return 'de-DE';
  if (code.startsWith('es')) return 'es-ES';
  return 'en-US';
}

function selectSpeechVoice(languageCode: string) {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const code = languageCode.toLowerCase();
  const primary = code.split('-')[0];

  if (primary === 'vi') {
    return (
      voices.find((voice) => voice.lang.toLowerCase() === 'vi-vn') ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith('vi')) ??
      voices.find((voice) => /vietnam|tiếng việt|tieng viet/i.test(voice.name)) ??
      null
    );
  }

  return (
    voices.find((voice) => voice.lang.toLowerCase() === code) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${primary}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(primary)) ??
    null
  );
}

function resolveSpeechTargetLanguage(targetLanguage: string, resolvedTargetLanguage: string, detectedLanguage: string) {
  if (resolvedTargetLanguage) return resolvedTargetLanguage;
  if (targetLanguage !== 'auto-pair') return targetLanguage;
  return String(detectedLanguage || '').toLowerCase().startsWith('vi') ? 'en' : 'vi';
}

function resolveSpeechSourceLanguage(sourceLanguage: string, detectedLanguage: string, text: string) {
  if (sourceLanguage !== 'auto') return sourceLanguage;
  return detectedLanguage || guessVietnameseOrEnglish(text);
}

function guessVietnameseOrEnglish(text: string) {
  const normalized = text.normalize('NFD');
  return /[\u0300-\u036f]/.test(normalized) || /[\u0111\u0110]/.test(text) ? 'vi' : 'en';
}

function isTouchInputDevice() {
  return navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
}
