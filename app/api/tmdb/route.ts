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
  original_language?: string;
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
    language: movie.original_language ?? '',
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

function mixMovieLists(hollywood: TmdbMovie[], bollywood: TmdbMovie[], seed: string, offset: number) {
  const english = mapMovies(shuffleWithSeed(hollywood, seed, offset));
  const hindi = mapMovies(shuffleWithSeed(bollywood, seed, offset + 1));
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
        hiddenHollywood, hiddenBollywood,
      ] = await Promise.all([
        tmdb<TmdbList>('/trending/movie/week', { language: 'en-US' }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '50', page: String(numberFromSeed(seed, 1, 8)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '300', page: String(numberFromSeed(seed, 2, 14)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '50', page: String(numberFromSeed(seed, 3, 8)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'en',
          'primary_release_date.gte': recentStart, 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '75', page: String(numberFromSeed(seed, 4, 8)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'hi',
          'primary_release_date.gte': recentStart, 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '20', page: String(numberFromSeed(seed, 5, 5)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '1500', page: String(numberFromSeed(seed, 6, 10)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '100', page: String(numberFromSeed(seed, 7, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'en',
          'primary_release_date.gte': '2024-01-01', 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '100', page: String(numberFromSeed(seed, 8, 10)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'primary_release_date.desc', with_original_language: 'hi',
          'primary_release_date.gte': '2024-01-01', 'primary_release_date.lte': currentDate,
          'vote_average.gte': '7', 'vote_count.gte': '20', page: String(numberFromSeed(seed, 9, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en', with_genres: '28',
          'vote_average.gte': '7', 'vote_count.gte': '300', page: String(numberFromSeed(seed, 10, 16)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi', with_genres: '28',
          'vote_average.gte': '7', 'vote_count.gte': '30', page: String(numberFromSeed(seed, 11, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en', with_genres: '35',
          'vote_average.gte': '7', 'vote_count.gte': '250', page: String(numberFromSeed(seed, 12, 16)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi', with_genres: '35',
          'vote_average.gte': '7', 'vote_count.gte': '30', page: String(numberFromSeed(seed, 13, 6)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en', with_genres: '878',
          'vote_average.gte': '7', 'vote_count.gte': '250', page: String(numberFromSeed(seed, 14, 14)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi', with_genres: '878',
          'vote_average.gte': '7', 'vote_count.gte': '5', page: String(numberFromSeed(seed, 15, 2)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '150', 'vote_count.lte': '1500', page: String(numberFromSeed(seed, 16, 14)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'vote_average.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '20', 'vote_count.lte': '1000', page: String(numberFromSeed(seed, 17, 8)),
        }),
      ]);

      return NextResponse.json(
        {
          trending: mixMovieLists(trendingHollywood.results, trendingBollywood.results, seed, 30),
          popular: mixMovieLists(popularHollywood.results, popularBollywood.results, seed, 33),
          nowPlaying: mixMovieLists(nowPlayingHollywood.results, nowPlayingBollywood.results, seed, 36),
          topPicks: mixMovieLists(acclaimedHollywood.results, acclaimedBollywood.results, seed, 39),
          newReleases: mixMovieLists(newHollywood.results, newBollywood.results, seed, 42),
          actionHits: mixMovieLists(actionHollywood.results, actionBollywood.results, seed, 45),
          comedyFavorites: mixMovieLists(comedyHollywood.results, comedyBollywood.results, seed, 48),
          scifiWorlds: mixMovieLists(scifiHollywood.results, scifiBollywood.results, seed, 51),
          hiddenGems: mixMovieLists(hiddenHollywood.results, hiddenBollywood.results, seed, 54),
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
      const [hollywood, bollywood] = await Promise.all([
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'en',
          'vote_average.gte': '7', 'vote_count.gte': '250', with_genres: genreIds.join('|'),
          page: String(numberFromSeed(seed, 60, 16)),
        }),
        tmdb<TmdbList>('/discover/movie', {
          language: 'en-US', include_adult: 'false', sort_by: 'popularity.desc', with_original_language: 'hi',
          'vote_average.gte': '7', 'vote_count.gte': '20', with_genres: genreIds.join('|'),
          page: String(numberFromSeed(seed, 61, 6)),
        }),
      ]);
      return NextResponse.json(
        { results: mixMovieLists(hollywood.results, bollywood.results, seed, 63), mood },
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
