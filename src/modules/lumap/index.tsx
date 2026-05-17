import { useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import Icon from '@/components/Icon';
import { saveModuleCloudData, subscribeModuleCloudData } from '@/firebase/moduleCloudSync';

interface SavedPlace {
  id: string;
  title: string;
  address: string;
  mapUrl: string;
  notes: string;
  lat?: number;
  lng?: number;
  createdAt: number;
  updatedAt: number;
}

interface ParsedMapValue {
  query: string;
  title: string;
  mapUrl: string;
  lat?: number;
  lng?: number;
}

interface StoredLuMapState {
  places: SavedPlace[];
  updatedAt: number;
}

interface LuMapCloudValue {
  places: SavedPlace[];
}

const STORAGE_KEY = 'lu:module:lumap';
const DEFAULT_MAP_QUERY = 'Ho Chi Minh City, Vietnam';

export default function LuMapModule() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(0);
  const [cardSearch, setCardSearch] = useState('');
  const [mapSearch, setMapSearch] = useState(DEFAULT_MAP_QUERY);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkValue, setLinkValue] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  const lastUpdatedAtRef = useRef(0);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    get(STORAGE_KEY).then((stored: SavedPlace[] | StoredLuMapState | undefined) => {
      const cached = normalizeStoredLuMapState(stored);
      if (cached.updatedAt > lastUpdatedAtRef.current) {
        lastUpdatedAtRef.current = cached.updatedAt;
        setPlaces(cached.places);
        setLastUpdatedAt(cached.updatedAt);
        if (cached.places.length) {
          setActiveId(cached.places[0].id);
          setMapSearch(getPlaceSearchValue(cached.places[0]));
        }
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    lastUpdatedAtRef.current = lastUpdatedAt;
  }, [lastUpdatedAt]);

  useEffect(() => {
    return subscribeModuleCloudData<LuMapCloudValue>('lumap', 'places', {
      onData: (remote) => {
        if (remote.updatedAt <= lastUpdatedAtRef.current) return;

        const remotePlaces = Array.isArray(remote.value.places) ? remote.value.places : [];
        const currentActiveId = activeIdRef.current;
        const nextActivePlace = remotePlaces.find((place) => place.id === currentActiveId) ?? remotePlaces[0] ?? null;

        applyingRemoteRef.current = true;
        lastUpdatedAtRef.current = remote.updatedAt;
        setPlaces(remotePlaces);
        setLastUpdatedAt(remote.updatedAt);
        setActiveId(nextActivePlace?.id ?? null);
        if (nextActivePlace) {
          setMapSearch(getPlaceSearchValue(nextActivePlace));
        }
        set(STORAGE_KEY, { places: remotePlaces, updatedAt: remote.updatedAt });

        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      },
      onReady: () => setCloudReady(true),
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;

    set(STORAGE_KEY, { places, updatedAt: lastUpdatedAt });
    if (!cloudReady || applyingRemoteRef.current || lastUpdatedAt <= 0) return;

    const syncTimer = window.setTimeout(() => {
      saveModuleCloudData<LuMapCloudValue>('lumap', 'places', {
        value: { places },
        updatedAt: lastUpdatedAt,
      }).catch((error) => {
        console.error('Failed to sync LuMap places', error);
      });
    }, 600);

    return () => window.clearTimeout(syncTimer);
  }, [places, lastUpdatedAt, loaded, cloudReady]);

  const activePlace = places.find((place) => place.id === activeId) ?? null;

  const filteredPlaces = useMemo(() => {
    const query = normalize(cardSearch);
    if (!query) return places;
    return places.filter((place) =>
      normalize(`${place.title} ${place.address} ${place.notes} ${place.mapUrl}`).includes(query),
    );
  }, [places, cardSearch]);

  const currentMapQuery = activePlace ? getPlaceSearchValue(activePlace) : mapSearch;
  const currentEmbedUrl = buildGoogleMapsEmbedUrl(currentMapQuery);
  const currentExternalUrl = activePlace?.mapUrl || buildGoogleMapsSearchUrl(currentMapQuery);

  const savePlace = (place: SavedPlace) => {
    const updatedAt = Date.now();
    const nextPlace = { ...place, updatedAt };
    lastUpdatedAtRef.current = updatedAt;
    setLastUpdatedAt(updatedAt);
    setPlaces((prev) => [nextPlace, ...prev]);
    setActiveId(nextPlace.id);
    setMapSearch(getPlaceSearchValue(nextPlace));
  };

  const saveCurrentMapSearch = () => {
    const trimmed = mapSearch.trim();
    if (!trimmed) return;

    const parsed = parseMapValue(trimmed);
    savePlace({
      id: crypto.randomUUID(),
      title: parsed.title || trimmed,
      address: parsed.query || trimmed,
      mapUrl: parsed.mapUrl || buildGoogleMapsSearchUrl(trimmed),
      notes: '',
      lat: parsed.lat,
      lng: parsed.lng,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const saveLinkCard = () => {
    const trimmed = linkValue.trim();
    if (!trimmed) return;

    const parsed = parseMapValue(trimmed);
    const title = linkTitle.trim() || parsed.title || parsed.query || 'Google Maps link';
    const address = parsed.query && normalize(parsed.query) !== normalize(title) ? parsed.query : '';

    savePlace({
      id: crypto.randomUUID(),
      title,
      address,
      mapUrl: parsed.mapUrl || trimmed,
      notes: '',
      lat: parsed.lat,
      lng: parsed.lng,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setLinkTitle('');
    setLinkValue('');
    setShowLinkForm(false);
  };

  const deletePlace = (id: string) => {
    if (!places.some((place) => place.id === id)) return;

    const updatedAt = Date.now();
    lastUpdatedAtRef.current = updatedAt;
    setLastUpdatedAt(updatedAt);
    setPlaces((prev) => {
      const next = prev.filter((place) => place.id !== id);
      if (activeId === id) {
        const nextActive = next[0] ?? null;
        setActiveId(nextActive?.id ?? null);
        if (nextActive) setMapSearch(getPlaceSearchValue(nextActive));
      }
      return next;
    });
  };

  const updatePlaceNotes = (id: string, notes: string) => {
    const updatedAt = Date.now();
    lastUpdatedAtRef.current = updatedAt;
    setLastUpdatedAt(updatedAt);
    setPlaces((prev) =>
      prev.map((place) =>
        place.id === id
          ? {
              ...place,
              notes,
              updatedAt,
            }
          : place,
      ),
    );
  };

  return (
    <div className="flex h-full min-w-0 bg-white">
      {!sidebarCollapsed && (
      <aside className="w-[320px] min-w-[280px] border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] flex flex-col">
        <div className="p-3 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
            <Icon name="map-pin" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">LuMap</h2>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{places.length} saved places</p>
          </div>
          <button
            type="button"
            onClick={() => setShowLinkForm((prev) => !prev)}
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            title="New card from Google Maps link"
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            title="Collapse place list"
          >
            <Icon name="chevron-left" size={16} />
          </button>
        </div>

        <div className="p-3 border-b border-[var(--color-border-subtle)] space-y-2">
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
            <input
              value={cardSearch}
              onChange={(event) => setCardSearch(event.target.value)}
              placeholder="Search saved cards"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {showLinkForm && (
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3 space-y-2 shadow-sm">
              <input
                value={linkTitle}
                onChange={(event) => setLinkTitle(event.target.value)}
                placeholder="Card title"
                className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-transparent text-sm focus:outline-none focus:border-[var(--color-accent)] focus:bg-white"
              />
              <input
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                placeholder="Paste Google Maps link"
                className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-transparent text-sm focus:outline-none focus:border-[var(--color-accent)] focus:bg-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkForm(false)}
                  className="h-8 px-3 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveLinkCard}
                  disabled={!linkValue.trim()}
                  className="h-8 px-3 rounded-lg text-xs font-medium bg-[var(--color-text-primary)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black transition-colors cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredPlaces.length === 0 ? (
            <div className="h-full flex items-center justify-center px-6 text-center">
              <div>
                <div className="w-11 h-11 mx-auto mb-3 rounded-2xl bg-white border border-[var(--color-border)] flex items-center justify-center">
                  <Icon name="map" size={20} className="text-[var(--color-text-tertiary)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">No saved places</p>
              </div>
            </div>
          ) : (
            filteredPlaces.map((place) => (
              <div
                key={place.id}
                className={`group flex items-start gap-2 rounded-xl px-3 py-3 mb-1 transition-colors ${
                  place.id === activeId
                    ? 'bg-white shadow-sm border border-[var(--color-border-subtle)]'
                    : 'hover:bg-white/70 border border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(place.id);
                    setMapSearch(getPlaceSearchValue(place));
                  }}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        place.id === activeId
                          ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                          : 'bg-white text-[var(--color-text-tertiary)]'
                      }`}
                    >
                      <Icon name="map-pin" size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{place.title}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                        {place.address || getHostLabel(place.mapUrl)}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deletePlace(place.id)}
                  className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)] hover:bg-red-50 transition-all cursor-pointer"
                  title="Delete card"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 border-b border-[var(--color-border-subtle)] px-4 flex items-center gap-2 bg-white">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
              title="Show saved places"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          )}
          <div className="relative flex-1">
            <Icon
              name="search"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
            <input
              value={mapSearch}
              onChange={(event) => {
                setMapSearch(event.target.value);
                setActiveId(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setMapSearch(event.currentTarget.value.trim() || DEFAULT_MAP_QUERY);
                  setActiveId(null);
                }
              }}
              placeholder="Search address in Google Maps"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--color-surface-subtle)] border border-transparent text-sm focus:outline-none focus:bg-white focus:border-[var(--color-accent)]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setMapSearch((value) => value.trim() || DEFAULT_MAP_QUERY);
              setActiveId(null);
            }}
            className="h-10 px-3 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
          >
            Search
          </button>
          <button
            type="button"
            onClick={saveCurrentMapSearch}
            disabled={!mapSearch.trim()}
            className="h-10 px-3 rounded-xl text-sm font-medium bg-[var(--color-text-primary)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black transition-colors cursor-pointer"
          >
            Save card
          </button>
          <a
            href={currentExternalUrl}
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent)] transition-colors"
            title="Open in Google Maps"
          >
            <Icon name="navigation" size={16} />
          </a>
        </div>

        <div className="flex-1 min-h-0 relative bg-[var(--color-surface-muted)]">
          <iframe
            key={currentEmbedUrl}
            title="LuMap Google Map"
            src={currentEmbedUrl}
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />

          {activePlace && (
            <section className="absolute left-4 bottom-4 w-[min(420px,calc(100%-2rem))] rounded-xl bg-white/95 backdrop-blur border border-[var(--color-border)] shadow-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center text-[var(--color-accent)]">
                  <Icon name="map-pin" size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {activePlace.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                    {activePlace.address || getHostLabel(activePlace.mapUrl)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deletePlace(activePlace.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-colors cursor-pointer"
                  title="Delete card"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
              <textarea
                value={activePlace.notes}
                onChange={(event) => updatePlaceNotes(activePlace.id, event.target.value)}
                placeholder="Notes"
                className="mt-3 w-full h-20 resize-none rounded-lg bg-[var(--color-surface-subtle)] border border-transparent px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:bg-white focus:border-[var(--color-accent)]"
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function normalizeStoredLuMapState(stored: SavedPlace[] | StoredLuMapState | undefined): StoredLuMapState {
  if (Array.isArray(stored)) {
    const updatedAt = stored.length
      ? Math.max(...stored.map((place) => place.updatedAt || place.createdAt || 0))
      : 0;
    return { places: stored, updatedAt };
  }

  if (stored && Array.isArray(stored.places)) {
    return {
      places: stored.places,
      updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
    };
  }

  return { places: [], updatedAt: 0 };
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildGoogleMapsEmbedUrl(query: string) {
  const safeQuery = query.trim() || DEFAULT_MAP_QUERY;
  return `https://www.google.com/maps?q=${encodeURIComponent(safeQuery)}&output=embed`;
}

function buildGoogleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim() || DEFAULT_MAP_QUERY)}`;
}

function getPlaceSearchValue(place: SavedPlace) {
  if (place.lat != null && place.lng != null) return `${place.lat},${place.lng}`;
  return place.address || place.title || place.mapUrl || DEFAULT_MAP_QUERY;
}

function parseMapValue(value: string): ParsedMapValue {
  const trimmed = value.trim();
  const coordinate = parseCoordinate(trimmed);
  const fallback: ParsedMapValue = {
    query: coordinate ? `${coordinate.lat},${coordinate.lng}` : trimmed,
    title: coordinate ? `${coordinate.lat}, ${coordinate.lng}` : trimUrlForTitle(trimmed),
    mapUrl: looksLikeUrl(trimmed) ? trimmed : buildGoogleMapsSearchUrl(trimmed),
    lat: coordinate?.lat,
    lng: coordinate?.lng,
  };

  if (!looksLikeUrl(trimmed)) return fallback;

  try {
    const url = new URL(trimmed);
    const urlCoordinate = parseCoordinate(url.href);
    const query =
      url.searchParams.get('query') ||
      url.searchParams.get('q') ||
      url.searchParams.get('destination') ||
      '';
    const placeTitle = extractPlaceTitle(url);
    const parsedQuery = urlCoordinate ? `${urlCoordinate.lat},${urlCoordinate.lng}` : decodeMapText(query);

    return {
      query: parsedQuery || placeTitle || fallback.query,
      title: placeTitle || parsedQuery || fallback.title,
      mapUrl: trimmed,
      lat: urlCoordinate?.lat,
      lng: urlCoordinate?.lng,
    };
  } catch {
    return fallback;
  }
}

function parseCoordinate(value: string) {
  const atMatch = value.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const bangMatch = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const plainMatch = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  const match = atMatch || bangMatch || plainMatch;
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function extractPlaceTitle(url: URL) {
  const placeMatch = url.pathname.match(/\/place\/([^/]+)/);
  if (!placeMatch) return '';
  return decodeMapText(placeMatch[1]);
}

function decodeMapText(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' ')).trim();
  } catch {
    return value.replace(/\+/g, ' ').trim();
  }
}

function trimUrlForTitle(value: string) {
  if (!looksLikeUrl(value)) return value;
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function getHostLabel(value: string) {
  if (!value) return 'Google Maps';
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return 'Google Maps';
  }
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value);
}
