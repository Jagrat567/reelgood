import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

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
};

const moodGenres: Record<string, number[]> = {
  Cozy: [35, 10751, 16],
  Fun: [35, 12, 16],
  Intense: [53, 80, 28],
  Thoughtful: [18, 878, 36],
  Emotional: [18, 10749],
  Surreal: [14, 9648, 878],
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
};

type TmdbList = { results: TmdbMovie[] };
type TmdbVideo = { site?: string; type?: string; official?: boolean; key?: string };
type TmdbCastMember = { id: number; name: string; character?: string; profile_path?: string | null };
type TmdbProvider = { provider_id: number; provider_name: string; logo_path?: string | null };
type TmdbProviderRegion = { flatrate?: TmdbProvider[]; free?: TmdbProvider[]; link?: string };
type TmdbDetails = TmdbMovie & {
  runtime?: number;
  tagline?: string;
  genres?: Array<{ id: number }>;
  videos?: { results: TmdbVideo[] };
  credits?: { cast: TmdbCastMember[] };
  recommendations?: TmdbList;
  'watch/providers'?: { results: Record<string, TmdbProviderRegion> };
};

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

function mapMovie(movie: TmdbMovie) {
  const releaseDate = movie.release_date ?? movie.first_air_date ?? '';
  return {
    id: movie.id,
    title: movie.title ?? movie.name ?? 'Untitled',
    year: Number(releaseDate.slice(0, 4)) || 0,
    runtime: '',
    rating: Number((movie.vote_average ?? 0).toFixed(1)),
    genres: (movie.genre_ids ?? []).map((id) => genreNames[id]).filter(Boolean),
    moods: [],
    description: movie.overview ?? '',
    poster: movie.poster_path ? `${IMAGE_BASE_URL}/w500${movie.poster_path}` : '',
    backdrop: movie.backdrop_path ? `${IMAGE_BASE_URL}/w1280${movie.backdrop_path}` : '',
  };
}

function mapMovies(list: TmdbMovie[]) {
  return list
    .filter(
      (movie) =>
        Boolean(movie.poster_path || movie.backdrop_path) &&
        !(movie.genre_ids ?? []).includes(27) &&
        (movie.vote_average ?? 0) >= 7,
    )
    .map(mapMovie);
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error('TMDB_NOT_CONFIGURED');

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`TMDB_${response.status}`);
  return response.json() as Promise<T>;
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get('view') ?? 'home';
  const seed = request.nextUrl.searchParams.get('seed') ?? Date.now().toString();

  try {
    if (view === 'home') {
      const currentDate = new Date().toISOString().slice(0, 10);
      const [trendingDay, trendingWeek, popular, nowPlaying, acclaimed, newReleases, actionHits, comedyFavorites, scifiWorlds, hiddenGems] = await Promise.all([
        tmdb<TmdbList>('/trending/movie/day', { language: 'en-US' }),
        tmdb<TmdbList>('/trending/movie/week', { language: 'en-US' }),
        tmdb<TmdbList>('/movie/popular', { language: 'en-US', region: 'IN', page: String(numberFromSeed(seed, 1, 12)) }),
        tmdb<TmdbList>('/movie/now_playing', { language: 'en-US', region: 'IN', page: String(numberFromSeed(seed, 2, 3)) }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US',
          include_adult: 'false',
          sort_by: 'vote_average.desc',
          'vote_count.gte': '1500',
          page: String(numberFromSeed(seed, 3, 10)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc',
          'primary_release_date.gte': '2024-01-01', 'primary_release_date.lte': currentDate,
          'vote_count.gte': '100', page: String(numberFromSeed(seed, 4, 12)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_genres: '28',
          'vote_count.gte': '300', page: String(numberFromSeed(seed, 5, 18)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_genres: '35',
          'vote_count.gte': '250', page: String(numberFromSeed(seed, 6, 18)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_genres: '878',
          'vote_count.gte': '250', page: String(numberFromSeed(seed, 7, 16)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc',
          'vote_count.gte': '150', 'vote_count.lte': '1500', page: String(numberFromSeed(seed, 8, 16)),
        }),
      ]);

      return NextResponse.json(
        {
          trending: mapMovies(shuffleWithSeed([...trendingDay.results, ...trendingWeek.results], seed, 10)).slice(0, 20),
          popular: mapMovies(shuffleWithSeed(popular.results, seed, 11)),
          nowPlaying: mapMovies(shuffleWithSeed(nowPlaying.results, seed, 12)),
          topPicks: mapMovies(shuffleWithSeed(acclaimed.results, seed, 13)),
          newReleases: mapMovies(shuffleWithSeed(newReleases.results, seed, 14)),
          actionHits: mapMovies(shuffleWithSeed(actionHits.results, seed, 15)),
          comedyFavorites: mapMovies(shuffleWithSeed(comedyFavorites.results, seed, 16)),
          scifiWorlds: mapMovies(shuffleWithSeed(scifiWorlds.results, seed, 17)),
          hiddenGems: mapMovies(shuffleWithSeed(hiddenGems.results, seed, 18)),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (view === 'search') {
      const query = request.nextUrl.searchParams.get('q')?.trim();
      if (!query) return NextResponse.json({ results: [] });
      const data = await tmdb<TmdbList>('/search/movie', {
        query,
        language: 'en-US',
        include_adult: 'false',
      });
      return NextResponse.json({ results: mapMovies(data.results) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (view === 'discover') {
      const mood = request.nextUrl.searchParams.get('mood') ?? 'Thoughtful';
      const genreIds = moodGenres[mood] ?? moodGenres.Thoughtful;
      const data = await tmdb<TmdbList>('/discover/movie', {
        language: 'en-US',
        include_adult: 'false',
        sort_by: 'popularity.desc',
        'vote_count.gte': '250',
        with_genres: genreIds.join('|'),
        page: String(numberFromSeed(seed, 20, 18)),
      });
      return NextResponse.json(
        { results: mapMovies(shuffleWithSeed(data.results, seed, 21)), mood },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (view === 'details') {
      const id = request.nextUrl.searchParams.get('id');
      if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: 'INVALID_MOVIE_ID' }, { status: 400 });
      const region = request.nextUrl.searchParams.get('region') ?? 'IN';
      const data = await tmdb<TmdbDetails>(`/movie/${id}`, {
        language: 'en-US',
        append_to_response: 'videos,credits,recommendations,watch/providers',
      });
      const trailer = data.videos?.results?.find(
        (video: TmdbVideo) =>
          video.site === 'YouTube' && video.type === 'Trailer' && video.official,
      ) ?? data.videos?.results?.find(
        (video: TmdbVideo) => video.site === 'YouTube' && video.type === 'Trailer',
      );
      const providers = data['watch/providers']?.results?.[region];

      return NextResponse.json({
        movie: {
          ...mapMovie({ ...data, genre_ids: data.genres?.map((genre: { id: number }) => genre.id) }),
          runtime: data.runtime ?? 0,
          tagline: data.tagline ?? '',
          cast: (data.credits?.cast ?? []).slice(0, 8).map((person: TmdbCastMember) => ({
            id: person.id,
            name: person.name,
            character: person.character ?? '',
            photo: person.profile_path ? `${IMAGE_BASE_URL}/w185${person.profile_path}` : '',
          })),
          trailerKey: trailer?.key ?? null,
          recommendations: mapMovies((data.recommendations?.results ?? []).slice(0, 12)),
          providers: [...(providers?.flatrate ?? []), ...(providers?.free ?? [])]
            .filter((provider, index, list) => list.findIndex((item) => item.provider_id === provider.provider_id) === index)
            .map((provider: TmdbProvider) => ({
              id: provider.provider_id,
              name: provider.provider_name,
              logo: provider.logo_path ? `${IMAGE_BASE_URL}/w92${provider.logo_path}` : '',
            })),
          providerLink: providers?.link ?? null,
        },
      });
    }

    return NextResponse.json({ error: 'UNKNOWN_VIEW' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TMDB_REQUEST_FAILED';
    console.error('[api/tmdb] request failed', { view, message });
    const status = message === 'TMDB_NOT_CONFIGURED' ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
