import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const CATALOG_CACHE_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MS = 5 * 60 * 1000;
const DETAILS_CACHE_MS = 30 * 60 * 1000;
const PROVIDERS_CACHE_MS = 24 * 60 * 60 * 1000;
const TMDB_TIMEOUT_MS = 8_000;
const MAX_CACHE_ENTRIES = 300;
const REQUEST_LIMIT = 90;
const REQUEST_WINDOW_MS = 60_000;

const genreNames: Record<number, string> = {
  12: 'Adventure',
  14: 'Fantasy',
  16: 'Animation',
  18: 'Drama',
  27: 'Horror',
  28: 'Action',
  35: 'Comedy',
  36: 'History',
  53: 'Thriller',
  80: 'Crime',
  99: 'Documentary',
  878: 'Sci-fi',
  9648: 'Mystery',
  10402: 'Music',
  10749: 'Romance',
  10751: 'Family',
  10752: 'War',
  10759: 'Action',
  10762: 'Family',
  10763: 'Talk',
  10764: 'Reality',
  10765: 'Sci-fi',
  10766: 'Drama',
  10767: 'Talk',
  10768: 'War',
};

const moodGenres: Record<string, number[]> = {
  Cozy: [35, 10751, 16],
  Fun: [35, 12, 16],
  Intense: [53, 80, 28],
  Thoughtful: [18, 878, 36],
  Emotional: [18, 10749],
  Surreal: [14, 9648, 878],
  Relaxed: [35, 10751, 16],
  Romantic: [10749, 18],
  Adventurous: [12, 28, 14],
  Mysterious: [9648, 53, 878],
  Inspiring: [18, 36, 99],
};

type TmdbMovie = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  original_language?: string;
  media_type?: 'movie' | 'tv' | 'person';
};

type TmdbList = { results: TmdbMovie[] };
type TmdbVideo = { site?: string; type?: string; official?: boolean; key?: string };
type TmdbCastMember = { id: number; name: string; character?: string; profile_path?: string | null };
type TmdbProvider = { provider_id: number; provider_name: string; logo_path?: string | null; display_priority?: number };
type TmdbProviderList = { results: TmdbProvider[] };
type TmdbProviderRegion = { flatrate?: TmdbProvider[]; free?: TmdbProvider[]; link?: string };
type TmdbDetails = TmdbMovie & {
  runtime?: number;
  episode_run_time?: number[];
  tagline?: string;
  genres?: Array<{ id: number }>;
  videos?: { results: TmdbVideo[] };
  credits?: { cast: TmdbCastMember[] };
  recommendations?: TmdbList;
  'watch/providers'?: { results: Record<string, TmdbProviderRegion> };
};

type CacheEntry = { expiresAt: number; value: unknown };
type RateLimitEntry = { count: number; resetAt: number };

const tmdbCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const requestCounts = new Map<string, RateLimitEntry>();

const genreIdsByName = Object.fromEntries(
  Object.entries(genreNames).map(([id, name]) => [name, Number(id)]),
) as Record<string, number>;

function numberFromSeed(seed: string, offset: number, max: number) {
  let hash = offset + 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % max) + 1;
}

function shuffleWithSeed<T>(items: T[], seed: string, offset = 0) {
  const shuffled = [...items];
  let state = numberFromSeed(seed, offset, 2147483646);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 48271) % 2147483647;
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function mapMovie(movie: TmdbMovie, forcedMediaType?: 'movie' | 'tv') {
  const releaseDate = movie.release_date ?? movie.first_air_date ?? '';
  return {
    id: movie.id,
    mediaType: forcedMediaType ?? (movie.media_type === 'tv' ? 'tv' : 'movie'),
    title: movie.title ?? movie.name ?? 'Untitled',
    year: Number(releaseDate.slice(0, 4)) || 0,
    runtime: '',
    rating: Number((movie.vote_average ?? 0).toFixed(1)),
    language: movie.original_language ?? '',
    genres: (movie.genre_ids ?? []).map((id) => genreNames[id]).filter(Boolean),
    moods: [],
    description: movie.overview ?? '',
    poster: movie.poster_path ? `${IMAGE_BASE_URL}/w500${movie.poster_path}` : '',
    backdrop: movie.backdrop_path ? `${IMAGE_BASE_URL}/w1280${movie.backdrop_path}` : '',
  };
}

function mapMovies(list: TmdbMovie[], forcedMediaType?: 'movie' | 'tv') {
  return list
    .filter(
      (movie) =>
        Boolean(movie.poster_path || movie.backdrop_path) &&
        !(movie.genre_ids ?? []).includes(27) &&
        (movie.vote_average ?? 0) >= 7,
    )
    .filter((movie) => movie.media_type !== 'person')
    .map((movie) => mapMovie(movie, forcedMediaType));
}

function mixMovieLists(hollywood: TmdbMovie[], bollywood: TmdbMovie[], seed: string, offset: number, mediaType: 'movie' | 'tv' = 'movie') {
  const english = mapMovies(shuffleWithSeed(hollywood, seed, offset), mediaType);
  const hindi = mapMovies(shuffleWithSeed(bollywood, seed, offset + 1), mediaType);
  const first = numberFromSeed(seed, offset + 2, 2) === 1 ? english : hindi;
  const second = first === english ? hindi : english;
  const mixed: ReturnType<typeof mapMovie>[] = [];
  const seen = new Set<number>();
  const add = (movie: ReturnType<typeof mapMovie> | undefined) => {
    if (movie && !seen.has(movie.id)) {
      seen.add(movie.id);
      mixed.push(movie);
    }
  };
  for (let index = 0; index < Math.max(first.length, second.length) && mixed.length < 20; index += 1) {
    add(first[index]);
    add(second[index]);
  }
  return mixed;
}

function mixMoviesAndSeries(
  movies: ReturnType<typeof mapMovie>[],
  series: ReturnType<typeof mapMovie>[],
  seed: string,
  offset: number,
) {
  const movieList = shuffleWithSeed(movies, seed, offset);
  const seriesList = shuffleWithSeed(series, seed, offset + 1);
  const mixed: ReturnType<typeof mapMovie>[] = [];
  const seen = new Set<string>();
  const add = (item: ReturnType<typeof mapMovie> | undefined) => {
    if (!item) return;
    const key = `${item.mediaType}:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      mixed.push(item);
    }
  };
  for (let index = 0; index < Math.max(movieList.length, seriesList.length) && mixed.length < 20; index += 1) {
    add(movieList[index]);
    add(seriesList[index]);
  }
  return mixed;
}

function cacheKey(path: string, params: Record<string, string>) {
  const normalized = Object.entries(params).sort(([left], [right]) => left.localeCompare(right));
  return `${path}?${new URLSearchParams(normalized).toString()}`;
}

function trimExpiredCache(now: number) {
  for (const [key, entry] of tmdbCache) {
    if (entry.expiresAt <= now) tmdbCache.delete(key);
  }
  while (tmdbCache.size > MAX_CACHE_ENTRIES) {
    const oldest = tmdbCache.keys().next().value;
    if (!oldest) break;
    tmdbCache.delete(oldest);
  }
}

async function fetchTmdb<T>(url: URL, token: string): Promise<T> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      lastStatus = response.status;
      if (response.ok) return response.json() as Promise<T>;
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '0');
        await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter * 1000, 250), 1_000)));
        continue;
      }
      throw new Error(`TMDB_${response.status}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt === 0) continue;
        throw new Error('TMDB_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`TMDB_${lastStatus || 'REQUEST_FAILED'}`);
}

async function tmdb<T>(path: string, params: Record<string, string> = {}, ttlMs = CATALOG_CACHE_MS): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error('TMDB_NOT_CONFIGURED');

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const key = cacheKey(path, params);
  const now = Date.now();
  const cached = tmdbCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value as T;

  const pending = inFlightRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = fetchTmdb<T>(url, token)
    .then((value) => {
      tmdbCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      trimExpiredCache(Date.now());
      return value;
    })
    .finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, request);
  return request;
}

function requestClient(request: NextRequest) {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'anonymous';
}

function applyRateLimit(request: NextRequest) {
  const now = Date.now();
  const client = requestClient(request);
  const current = requestCounts.get(client);
  if (!current || current.resetAt <= now) {
    requestCounts.set(client, { count: 1, resetAt: now + REQUEST_WINDOW_MS });
    return null;
  }
  current.count += 1;
  if (current.count <= REQUEST_LIMIT) return null;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
}

function runtimeParams(value: string | null): Record<string, string> {
  if (value === 'under-90') return { 'with_runtime.lte': '89' };
  if (value === '90-120') return { 'with_runtime.gte': '90', 'with_runtime.lte': '120' };
  if (value === '120-180') return { 'with_runtime.gte': '121', 'with_runtime.lte': '180' };
  if (value === 'over-180') return { 'with_runtime.gte': '181' };
  return {};
}

function tvGenreIdForName(name: string) {
  if (name === 'Action' || name === 'Adventure') return 10759;
  if (name === 'Sci-fi' || name === 'Fantasy') return 10765;
  if (name === 'War') return 10768;
  return genreIdsByName[name];
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get('view') ?? 'home';
  const seed = request.nextUrl.searchParams.get('seed') ?? Date.now().toString();
  const upstreamSeed = String(Math.floor(Date.now() / CATALOG_CACHE_MS));
  const startedAt = Date.now();
  const requestId = request.headers.get('x-vercel-id') ?? crypto.randomUUID();
  const retryAfter = applyRateLimit(request);
  console.log(JSON.stringify({ level: 'info', message: 'TMDb request started', route: '/api/tmdb', view, requestId }));

  if (retryAfter) {
    console.warn(JSON.stringify({ level: 'warn', message: 'TMDb route rate limited', route: '/api/tmdb', view, requestId }));
    return NextResponse.json(
      { error: 'TOO_MANY_REQUESTS' },
      { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } },
    );
  }

  try {
    if (view === 'home') {
      const currentDate = new Date().toISOString().slice(0, 10);
      const recentStart = `${Math.max(new Date().getUTCFullYear() - 1, 2024)}-01-01`;
      const [
        trendingHollywood, trendingBollywood,
        popularHollywood, popularBollywood,
        nowPlayingHollywood, nowPlayingBollywood,
        acclaimedHollywood, acclaimedBollywood,
        newHollywood, newBollywood,
        actionHollywood, actionBollywood,
        comedyHollywood, comedyBollywood,
        scifiHollywood, scifiBollywood,
        seriesPopularEnglish, seriesPopularHindi,
        seriesTopEnglish, seriesTopHindi,
        seriesNewEnglish, seriesNewHindi,
        seriesGenreEnglish, seriesGenreHindi,
      ] = await Promise.all([
        tmdb<TmdbList>('/trending/movie/week', { language: 'en-US' }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '50', page: String(numberFromSeed(upstreamSeed, 1, 8)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '300', page: String(numberFromSeed(upstreamSeed, 2, 14)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '50', page: String(numberFromSeed(upstreamSeed, 3, 8)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'en',
          'primary_release_date.gte': recentStart, 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '75', page: String(numberFromSeed(upstreamSeed, 4, 8)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'hi',
          'primary_release_date.gte': recentStart, 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '20', page: String(numberFromSeed(upstreamSeed, 5, 5)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '1500', page: String(numberFromSeed(upstreamSeed, 6, 10)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '100', page: String(numberFromSeed(upstreamSeed, 7, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'en',
          'primary_release_date.gte': '2024-01-01', 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '100', page: String(numberFromSeed(upstreamSeed, 8, 10)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'hi',
          'primary_release_date.gte': '2024-01-01', 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '20', page: String(numberFromSeed(upstreamSeed, 9, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en', with_genres: '28',
          'vote_average.gte': '7', 'vote_count.gte': '300', page: String(numberFromSeed(upstreamSeed, 10, 16)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi', with_genres: '28',
          'vote_average.gte': '7', 'vote_count.gte': '30', page: String(numberFromSeed(upstreamSeed, 11, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en', with_genres: '35',
          'vote_average.gte': '7', 'vote_count.gte': '250', page: String(numberFromSeed(upstreamSeed, 12, 16)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi', with_genres: '35',
          'vote_average.gte': '7', 'vote_count.gte': '30', page: String(numberFromSeed(upstreamSeed, 13, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en', with_genres: '878',
          'vote_average.gte': '7', 'vote_count.gte': '250', page: String(numberFromSeed(upstreamSeed, 14, 14)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi', with_genres: '878',
          'vote_average.gte': '7', 'vote_count.gte': '5', page: String(numberFromSeed(upstreamSeed, 15, 2)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '100', page: String(numberFromSeed(upstreamSeed, 18, 12)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '10', page: String(numberFromSeed(upstreamSeed, 19, 5)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '500', page: String(numberFromSeed(upstreamSeed, 20, 10)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '20', page: String(numberFromSeed(upstreamSeed, 21, 5)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'first_air_date.desc', with_original_language: 'en',
          'first_air_date.gte': '2024-01-01', 'first_air_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '50', page: String(numberFromSeed(upstreamSeed, 22, 8)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'first_air_date.desc', with_original_language: 'hi',
          'first_air_date.gte': '2024-01-01', 'first_air_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '10', page: String(numberFromSeed(upstreamSeed, 23, 4)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en', with_genres: '10759|35|10765',
          'vote_average.gte': '7', 'vote_count.gte': '80', page: String(numberFromSeed(upstreamSeed, 24, 12)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi', with_genres: '10759|35|10765',
          'vote_average.gte': '7', 'vote_count.gte': '5', page: String(numberFromSeed(upstreamSeed, 25, 4)),
        }),
      ]);

      const popularSeries = mixMovieLists(seriesPopularEnglish.results, seriesPopularHindi.results, seed, 56, 'tv');
      const topSeries = mixMovieLists(seriesTopEnglish.results, seriesTopHindi.results, seed, 58, 'tv');
      const newSeries = mixMovieLists(seriesNewEnglish.results, seriesNewHindi.results, seed, 60, 'tv');
      const genreSeries = mixMovieLists(seriesGenreEnglish.results, seriesGenreHindi.results, seed, 62, 'tv');
      const seriesForGenre = (name: string) => {
        const matches = genreSeries.filter((show) => show.genres.includes(name));
        return matches.length >= 4 ? matches : genreSeries;
      };

      return NextResponse.json(
        {
          trending: mixMoviesAndSeries(mixMovieLists(trendingHollywood.results, trendingBollywood.results, seed, 30), popularSeries, seed, 80),
          popular: mixMoviesAndSeries(mixMovieLists(popularHollywood.results, popularBollywood.results, seed, 33), popularSeries, seed, 82),
          nowPlaying: mixMoviesAndSeries(mixMovieLists(nowPlayingHollywood.results, nowPlayingBollywood.results, seed, 36), newSeries, seed, 84),
          topPicks: mixMoviesAndSeries(mixMovieLists(acclaimedHollywood.results, acclaimedBollywood.results, seed, 39), topSeries, seed, 86),
          newReleases: mixMoviesAndSeries(mixMovieLists(newHollywood.results, newBollywood.results, seed, 42), newSeries, seed, 88),
          actionHits: mixMoviesAndSeries(mixMovieLists(actionHollywood.results, actionBollywood.results, seed, 45), seriesForGenre('Action'), seed, 90),
          comedyFavorites: mixMoviesAndSeries(mixMovieLists(comedyHollywood.results, comedyBollywood.results, seed, 48), seriesForGenre('Comedy'), seed, 92),
          scifiWorlds: mixMoviesAndSeries(mixMovieLists(scifiHollywood.results, scifiBollywood.results, seed, 51), seriesForGenre('Sci-fi'), seed, 94),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (view === 'providers') {
      const [movieProviders, tvProviders] = await Promise.all([
        tmdb<TmdbProviderList>('/watch/providers/movie', { language: 'en-US', watch_region: 'IN' }, PROVIDERS_CACHE_MS),
        tmdb<TmdbProviderList>('/watch/providers/tv', { language: 'en-US', watch_region: 'IN' }, PROVIDERS_CACHE_MS),
      ]);
      const providers = [...movieProviders.results, ...tvProviders.results]
        .filter((provider) => Boolean(provider.logo_path))
        .filter((provider, index, list) => list.findIndex((item) => item.provider_id === provider.provider_id) === index)
        .sort((left, right) => (left.display_priority ?? 999) - (right.display_priority ?? 999))
        .slice(0, 24)
        .map((provider) => ({
          id: provider.provider_id,
          name: provider.provider_name,
          logo: provider.logo_path ? `${IMAGE_BASE_URL}/w92${provider.logo_path}` : '',
        }));
      return NextResponse.json(
        { providers },
        { headers: { 'Cache-Control': 'public, max-age=3600', 'Vercel-CDN-Cache-Control': 'public, max-age=86400' } },
      );
    }

    if (view === 'filter') {
      const industry = request.nextUrl.searchParams.get('industry') ?? 'All';
      const genre = request.nextUrl.searchParams.get('genre') ?? 'All';
      const runtime = request.nextUrl.searchParams.get('runtime');
      const provider = request.nextUrl.searchParams.get('provider') ?? '';
      const requestedRating = Number(request.nextUrl.searchParams.get('minRating') ?? '7');
      const minimumRating = Number.isFinite(requestedRating) ? Math.min(Math.max(requestedRating, 7), 9) : 7;
      const genreId = genre === 'All' ? undefined : genreIdsByName[genre];
      const tvGenreId = genre === 'All' ? undefined : tvGenreIdForName(genre);
      const providerId = /^\d+$/.test(provider) ? provider : '';
      const sharedParams: Record<string, string> = {
        language: 'en-US',
        include_adult: 'false',
        sort_by: 'popularity.desc',
        'vote_average.gte': String(minimumRating),
        'vote_count.gte': industry === 'Bollywood' ? '20' : '100',
        without_genres: '27',
        ...runtimeParams(runtime),
      };
      if (genreId) sharedParams.with_genres = String(genreId);
      if (providerId) {
        sharedParams.watch_region = 'IN';
        sharedParams.with_watch_providers = providerId;
        sharedParams.with_watch_monetization_types = 'flatrate|free|ads|rent|buy';
      }

      if (industry === 'Bollywood' || industry === 'Hollywood') {
        const language = industry === 'Bollywood' ? 'hi' : 'en';
        const maxPage = industry === 'Bollywood' ? 6 : 14;
        const tvParams = { ...sharedParams };
        if (tvGenreId) tvParams.with_genres = String(tvGenreId);
        const [movies, series] = await Promise.all([
          tmdb<TmdbList>('/discover/movie', {
            ...sharedParams,
            with_original_language: language,
            page: String(numberFromSeed(upstreamSeed, 70, maxPage)),
          }),
          tmdb<TmdbList>('/discover/tv', {
            ...tvParams,
            with_original_language: language,
            page: String(numberFromSeed(upstreamSeed, 71, maxPage)),
          }),
        ]);
        return NextResponse.json(
          { results: mixMoviesAndSeries(mapMovies(movies.results, 'movie'), mapMovies(series.results, 'tv'), seed, 72) },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const tvParams = { ...sharedParams };
      if (tvGenreId) tvParams.with_genres = String(tvGenreId);
      const [hollywood, bollywood, englishSeries, hindiSeries] = await Promise.all([
        tmdb<TmdbList>('/discover/movie', {
          ...sharedParams,
          with_original_language: 'en',
          page: String(numberFromSeed(upstreamSeed, 73, 14)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          ...sharedParams,
          'vote_count.gte': '20',
          with_original_language: 'hi',
          page: String(numberFromSeed(upstreamSeed, 74, 6)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          ...tvParams,
          with_original_language: 'en',
          page: String(numberFromSeed(upstreamSeed, 75, 14)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          ...tvParams,
          'vote_count.gte': '10',
          with_original_language: 'hi',
          page: String(numberFromSeed(upstreamSeed, 76, 6)),
        }),
      ]);
      const movies = mixMovieLists(hollywood.results, bollywood.results, seed, 77);
      const series = mixMovieLists(englishSeries.results, hindiSeries.results, seed, 79, 'tv');
      return NextResponse.json(
        { results: mixMoviesAndSeries(movies, series, seed, 81) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (view === 'search') {
      const query = request.nextUrl.searchParams.get('q')?.trim();
      if (!query) return NextResponse.json({ results: [] });
      const data = await tmdb<TmdbList>('/search/multi', {
        query,
        language: 'en-US',
        include_adult: 'false',
      }, SEARCH_CACHE_MS);
      return NextResponse.json(
        { results: mapMovies(data.results) },
        { headers: { 'Cache-Control': 'public, max-age=60', 'Vercel-CDN-Cache-Control': 'public, max-age=300' } },
      );
    }

    if (view === 'discover') {
      const mood = request.nextUrl.searchParams.get('mood') ?? 'Thoughtful';
      const genreIds = moodGenres[mood] ?? moodGenres.Thoughtful;
      const [hollywood, bollywood, englishSeries, hindiSeries] = await Promise.all([
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '250', with_genres: genreIds.join('|'),
          page: String(numberFromSeed(upstreamSeed, 60, 16)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '20', with_genres: genreIds.join('|'),
          page: String(numberFromSeed(upstreamSeed, 61, 6)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '100', with_genres: genreIds.map((id) => id === 28 ? 10759 : id === 878 ? 10765 : id).join('|'),
          page: String(numberFromSeed(upstreamSeed, 62, 14)),
        }),
        tmdb<TmdbList>('/discover/tv', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '10', with_genres: genreIds.map((id) => id === 28 ? 10759 : id === 878 ? 10765 : id).join('|'),
          page: String(numberFromSeed(upstreamSeed, 63, 5)),
        }),
      ]);
      const movies = mixMovieLists(hollywood.results, bollywood.results, seed, 64);
      const series = mixMovieLists(englishSeries.results, hindiSeries.results, seed, 66, 'tv');
      return NextResponse.json(
        { results: mixMoviesAndSeries(movies, series, seed, 68), mood },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (view === 'details') {
      const id = request.nextUrl.searchParams.get('id');
      if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: 'INVALID_MOVIE_ID' }, { status: 400 });
      const mediaType = request.nextUrl.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const region = request.nextUrl.searchParams.get('region') ?? 'IN';
      const data = await tmdb<TmdbDetails>(`/${mediaType}/${id}`, {
        language: 'en-US',
        append_to_response: 'videos,credits,recommendations,watch/providers',
      }, DETAILS_CACHE_MS);
      const trailer = data.videos?.results?.find(
        (video: TmdbVideo) =>
          video.site === 'YouTube' && video.type === 'Trailer' && video.official,
      ) ?? data.videos?.results?.find(
        (video: TmdbVideo) => video.site === 'YouTube' && video.type === 'Trailer',
      );
      const providers = data['watch/providers']?.results?.[region];

      return NextResponse.json({
        movie: {
          ...mapMovie({ ...data, genre_ids: data.genres?.map((genre: { id: number }) => genre.id) }, mediaType),
          runtime: data.runtime ?? data.episode_run_time?.[0] ?? 0,
          tagline: data.tagline ?? '',
          cast: (data.credits?.cast ?? []).slice(0, 8).map((person: TmdbCastMember) => ({
            id: person.id,
            name: person.name,
            character: person.character ?? '',
            photo: person.profile_path ? `${IMAGE_BASE_URL}/w185${person.profile_path}` : '',
          })),
          trailerKey: trailer?.key ?? null,
          recommendations: mapMovies((data.recommendations?.results ?? []).slice(0, 12), mediaType),
          providers: [...(providers?.flatrate ?? []), ...(providers?.free ?? [])]
            .filter((provider, index, list) => list.findIndex((item) => item.provider_id === provider.provider_id) === index)
            .map((provider: TmdbProvider) => ({
              id: provider.provider_id,
              name: provider.provider_name,
              logo: provider.logo_path ? `${IMAGE_BASE_URL}/w92${provider.logo_path}` : '',
            })),
          providerLink: providers?.link ?? null,
        },
      }, { headers: { 'Cache-Control': 'public, max-age=300', 'Vercel-CDN-Cache-Control': 'public, max-age=1800' } });
    }

    return NextResponse.json({ error: 'UNKNOWN_VIEW' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TMDB_REQUEST_FAILED';
    console.error(JSON.stringify({ level: 'error', message: 'TMDb request failed', route: '/api/tmdb', view, requestId, error: message, durationMs: Date.now() - startedAt }));
    const status = message === 'TMDB_NOT_CONFIGURED' ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  } finally {
    console.log(JSON.stringify({ level: 'info', message: 'TMDb request completed', route: '/api/tmdb', view, requestId, durationMs: Date.now() - startedAt }));
  }
}
