import { VideoItem } from './types';

export function parseDuration(iso: string): string {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function fetchDurations(videoIds: string, apiKey: string): Promise<Record<string, string>> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('id', videoIds);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url);
    const data = await res.json();

    const map: Record<string, string> = {};
    (data.items || []).forEach((item: any) => {
      map[item.id] = parseDuration(item.contentDetails.duration);
    });
    return map;
  } catch (err) {
    console.error('fetchDurations error:', err);
    return {};
  }
}

export async function searchVideos(query: string, apiKey: string): Promise<VideoItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '20');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('safeSearch', 'none');

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || 'YouTube API error');
  }

  const items = data.items || [];
  const videoIds = items.map((i: any) => i.id.videoId).filter(Boolean).join(',');
  
  let durations: Record<string, string> = {};
  if (videoIds) {
    durations = await fetchDurations(videoIds, apiKey);
  }

  return items.map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumb: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    published: item.snippet.publishedAt,
    duration: durations[item.id.videoId] || '',
  }));
}
