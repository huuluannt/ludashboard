import type { MusicSearchResponse } from './types';

const cache = new Map<string, MusicSearchResponse>();

export async function searchMusic(query: string, apiKey: string): Promise<MusicSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Search query cannot be empty.');
  }
  if (!apiKey.trim()) {
    throw new Error('Missing YouTube API key. Add your key in LuMusic or LuVideo settings.');
  }

  const cacheKey = `${trimmed.toLowerCase()}:${apiKey.slice(-6)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch('/api/music/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: trimmed, apiKey: apiKey.trim(), maxResults: 18 }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Music search failed.');
  }

  const result: MusicSearchResponse = {
    tracks: Array.isArray(data.tracks) ? data.tracks : [],
    weak: Boolean(data.weak),
    notice: typeof data.notice === 'string' ? data.notice : '',
  };
  cache.set(cacheKey, result);
  return result;
}
