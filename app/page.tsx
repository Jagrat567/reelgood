'use client';
/* oxlint-disable next/no-img-element -- TMDb artwork is served directly from its image CDN. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import {
  Bookmark,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  Film,
  Heart,
  LoaderCircle,
  Play,
  Search,
  Shuffle,
  SlidersHorizontal,
  Star,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Movie = {
  id: number;
  mediaType?: 'movie' | 'tv';
  title: string;
  year: number;
  runtime: string;
  rating: number;
  language?: string;
  genres: string[];
  moods: string[];
  description: string;
  poster: string;
  backdrop?: string;
};

type MovieDetails = Omit<Movie, 'runtime'> & {
  runtime: number;
  tagline: string;
  cast: Array<{ id: number; name: string; character: string; photo: string }>;
  trailerKey: string | null;
  recommendations: Movie[];
  providers: Array<{ id: number; name: string; logo: string }>;
  providerLink: string | null;
};

type HomeShelves = {
  trending: Movie[];
  popular: Movie[];
  nowPlaying: Movie[];
  topPicks: Movie[];
  newReleases: Movie[];
  actionHits: Movie[];
  comedyFavorites: Movie[];
  scifiWorlds: Movie[];
};

type StreamingProvider = { id: number; name: string; logo: string };
type FeedbackValue = 'liked' | 'disliked' | 'watched';

const fallbackMovies: Movie[] = [
  {
    id: 693134,
    title: 'Dune: Part Two',
    year: 2024,
    runtime: '2h 46m',
    rating: 8.5,
    genres: ['Sci-fi', 'Adventure'],
    moods: ['Epic', 'Intense', 'Adventurous'],
    description: 'A sweeping desert odyssey about power, prophecy, and the cost of becoming a symbol.',
    poster: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
  },
  {
    id: 666277,
    title: 'Past Lives',
    year: 2023,
    runtime: '1h 46m',
    rating: 8.1,
    genres: ['Drama', 'Romance'],
    moods: ['Tender', 'Thoughtful', 'Romantic'],
    description: 'Two childhood friends reunite in New York for a quietly devastating week of possibility.',
    poster: 'https://image.tmdb.org/t/p/w780/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
  },
  {
    id: 569094,
    title: 'Spider-Man: Across the Spider-Verse',
    year: 2023,
    runtime: '2h 20m',
    rating: 8.6,
    genres: ['Animation', 'Adventure'],
    moods: ['Fun', 'Epic', 'Adventurous', 'Inspiring'],
    description: 'A dazzling leap through dimensions, powered by heart, kinetic art, and impossible choices.',
    poster: 'https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
  },
  {
    id: 120467,
    title: 'The Grand Budapest Hotel',
    year: 2014,
    runtime: '1h 40m',
    rating: 8.1,
    genres: ['Comedy', 'Drama'],
    moods: ['Cozy', 'Fun', 'Relaxed'],
    description: 'A meticulously composed caper full of loyalty, pastries, stolen art, and old-world charm.',
    poster: 'https://image.tmdb.org/t/p/w780/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg',
  },
  {
    id: 329865,
    title: 'Arrival',
    year: 2016,
    runtime: '1h 56m',
    rating: 8.0,
    genres: ['Sci-fi', 'Drama'],
    moods: ['Thoughtful', 'Emotional', 'Mysterious', 'Inspiring'],
    description: 'A linguist races to understand visitors whose language changes how time itself is seen.',
    poster: 'https://image.tmdb.org/t/p/w780/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg',
  },
  {
    id: 792307,
    title: 'Poor Things',
    year: 2023,
    runtime: '2h 21m',
    rating: 8.0,
    genres: ['Fantasy', 'Comedy'],
    moods: ['Bold', 'Surreal', 'Mysterious'],
    description: 'A fearless, lavishly strange journey of discovery through a world of appetites and ideas.',
    poster: 'https://image.tmdb.org/t/p/w780/kCGlIMc9J50w9wxa7iTQlPd8k.jpg',
  },
  {
    id: 840430,
    title: 'The Holdovers',
    year: 2023,
    runtime: '2h 13m',
    rating: 7.9,
    genres: ['Comedy', 'Drama'],
    moods: ['Cozy', 'Emotional', 'Relaxed', 'Inspiring'],
    description: 'A grumpy teacher, a stranded student, and a grieving cook find warmth over winter break.',
    poster: 'https://image.tmdb.org/t/p/w780/VHSzNBTwxV8vh7wylo7O9CLdac.jpg',
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    year: 2023,
    runtime: '3h 00m',
    rating: 8.4,
    genres: ['Drama', 'History'],
    moods: ['Intense', 'Thoughtful', 'Mysterious'],
    description: 'A propulsive portrait of ambition, consequence, and the man at the center of a new age.',
    poster: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  },
];

const moods = [
  'Cozy',
  'Fun',
  'Intense',
  'Thoughtful',
  'Emotional',
  'Surreal',
  'Relaxed',
  'Romantic',
  'Adventurous',
  'Mysterious',
  'Inspiring',
];
const genres = ['All', 'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama', 'Family', 'Fantasy', 'Mystery', 'Romance', 'Sci-fi', 'Thriller'];
const fallbackTrending = [...fallbackMovies].sort((a, b) => b.rating - a.rating);
const watchlistStorageKey = 'reelgood-watchlist:v1';
const feedbackStorageKey = 'reelgood-feedback:v1';

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

function formatRuntime(minutes: number) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours ? `${hours}h ` : ''}${remainder ? `${remainder}m` : ''}`.trim();
}

function createRecommendationSeed() {
  return `${Date.now()}-${Math.random()}`;
}

function pickRandomMovie(items: Movie[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function movieKey(movie: Pick<Movie, 'id' | 'mediaType'>) {
  return `${movie.mediaType ?? 'movie'}:${movie.id}`;
}

function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  try {
    track(name, properties);
  } catch {
    // Analytics must never interrupt movie discovery.
  }
}

export default function Home() {
  const [mood, setMood] = useState('Thoughtful');
  const [genre, setGenre] = useState('All');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [homeShelves, setHomeShelves] = useState<HomeShelves | null>(null);
  const [featuredMovie, setFeaturedMovie] = useState<Movie | null>(null);
  const [featuredPool, setFeaturedPool] = useState<Movie[]>(fallbackMovies);
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isSurprising, setIsSurprising] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [languageFilter, setLanguageFilter] = useState('All');
  const [minimumRating, setMinimumRating] = useState(7);
  const [runtimeFilter, setRuntimeFilter] = useState('Any');
  const [providerFilter, setProviderFilter] = useState('All');
  const [providers, setProviders] = useState<StreamingProvider[]>([]);
  const [remoteFilteredResults, setRemoteFilteredResults] = useState<Movie[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const catalogRef = useRef<Movie[]>(fallbackMovies);
  const featuredRequestRef = useRef(0);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = window.localStorage.getItem(watchlistStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<string | number>;
        timer = window.setTimeout(() => setSaved(parsed.map((item) => typeof item === 'number' ? `movie:${item}` : item)), 0);
      }
    } catch {
      timer = window.setTimeout(() => setSaved([]), 0);
    }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = window.localStorage.getItem(feedbackStorageKey);
      if (stored) timer = window.setTimeout(() => setFeedback(JSON.parse(stored)), 0);
    } catch {
      timer = window.setTimeout(() => setFeedback({}), 0);
    }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tmdb?view=home&seed=${Date.now()}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('TMDB_UNAVAILABLE');
        return response.json() as Promise<HomeShelves>;
      })
      .then((data) => {
        setHomeShelves(data);
        if (featuredRequestRef.current === 0) {
          const initialPool = data.topPicks.length ? data.topPicks : data.trending;
          setFeaturedPool(initialPool);
          setFeaturedMovie(initialPool[0] ?? fallbackMovies[0]);
        }
        setIsLive(true);
      })
      .catch(() => setIsLive(false))
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const preferredPool = featuredPool.filter((movie) => feedback[movieKey(movie)] !== 'disliked' && feedback[movieKey(movie)] !== 'watched');
    const rotationPool = preferredPool.length >= 2
      ? preferredPool
      : featuredPool.filter((movie) => feedback[movieKey(movie)] !== 'disliked');
    if (isSurprising || rotationPool.length < 2) return;

    const timer = window.setInterval(() => {
      setFeaturedMovie((current) => {
        const currentIndex = rotationPool.findIndex((movie) => movie.id === current?.id);
        return rotationPool[(currentIndex + 1 + rotationPool.length) % rotationPool.length];
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [featuredPool, feedback, isSurprising]);

  useEffect(() => {
    if (!filtersOpen || providers.length > 0) return;
    const controller = new AbortController();
    fetch('/api/tmdb?view=providers', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('PROVIDERS_FAILED');
        return response.json() as Promise<{ providers: StreamingProvider[] }>;
      })
      .then((data) => setProviders(data.providers))
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
      });
    return () => controller.abort();
  }, [filtersOpen, providers.length]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      const timer = window.setTimeout(() => {
        setSearchResults(null);
        setSearchError('');
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError('');
      fetch(`/api/tmdb?view=search&q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal, cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('SEARCH_FAILED');
          return response.json() as Promise<{ results: Movie[] }>;
        })
        .then((data) => {
          setSearchResults(data.results);
          setIsLive(true);
        })
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          setSearchResults([]);
          setSearchError('Search is temporarily unavailable. Please try again.');
        })
        .finally(() => setIsSearching(false));
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const fallbackRanked = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return fallbackMovies
      .filter((movie) => {
        const genreMatch = genre === 'All' || movie.genres.includes(genre);
        const searchMatch =
          !normalizedQuery ||
          movie.title.toLowerCase().includes(normalizedQuery) ||
          movie.genres.some((item) => item.toLowerCase().includes(normalizedQuery));
        return genreMatch && searchMatch;
      })
      .sort((a, b) => {
        return b.rating - a.rating;
      });
  }, [genre, query]);

  const unfilteredTopPicks = query.trim().length >= 2
    ? searchResults ?? fallbackRanked
    : homeShelves?.topPicks ?? fallbackRanked;
  const filterMovies = (items: Movie[]) => items
    .filter((movie) => {
      const languageMatch = languageFilter === 'All'
        || (languageFilter === 'Bollywood' && movie.language === 'hi')
        || (languageFilter === 'Hollywood' && (movie.language ?? 'en') === 'en');
      const genreMatch = genre === 'All' || movie.genres.includes(genre);
      return feedback[movieKey(movie)] !== 'disliked' && languageMatch && genreMatch && movie.rating >= minimumRating;
    })
    .sort((left, right) => {
      const score = (movie: Movie) => feedback[movieKey(movie)] === 'liked' ? 2 : feedback[movieKey(movie)] === 'watched' ? -1 : 0;
      return score(right) - score(left);
    });
  const topPicks = filterMovies(unfilteredTopPicks).slice(0, 10);
  const trending = filterMovies(homeShelves?.trending ?? fallbackTrending).slice(0, 10);
  const featured = featuredMovie ?? topPicks[0] ?? trending[0] ?? fallbackMovies[0];
  const activeFilterCount = Number(languageFilter !== 'All')
    + Number(genre !== 'All')
    + Number(minimumRating > 7)
    + Number(runtimeFilter !== 'Any')
    + Number(providerFilter !== 'All');
  const defaultShelves = [
    { title: 'Trending now', items: trending },
    ...(homeShelves ? [
      { title: 'Popular tonight', items: filterMovies(homeShelves.popular).slice(0, 10) },
      { title: 'Now playing in cinemas', items: filterMovies(homeShelves.nowPlaying).slice(0, 10) },
      { title: 'Fresh releases', items: filterMovies(homeShelves.newReleases).slice(0, 10) },
      { title: 'Adrenaline rush', items: filterMovies(homeShelves.actionHits).slice(0, 10) },
      { title: 'Comedy favorites', items: filterMovies(homeShelves.comedyFavorites).slice(0, 10) },
      { title: 'Sci-fi worlds', items: filterMovies(homeShelves.scifiWorlds).slice(0, 10) },
    ] : []),
  ];
  const locallyFilteredMovies = Array.from(
    new Map(defaultShelves.flatMap((shelf) => shelf.items).map((movie) => [movieKey(movie), movie])).values(),
  );
  const combinedFilteredMovies = remoteFilteredResults === null
    ? locallyFilteredMovies
    : filterMovies(remoteFilteredResults);
  const shelves = query.trim().length >= 2
    ? [{ title: `Search results for “${query.trim()}”`, items: topPicks }]
    : activeFilterCount > 0
      ? [{ title: 'Movies matching your filters', items: combinedFilteredMovies }]
      : defaultShelves;
  const isFilteredView = activeFilterCount > 0 && query.trim().length < 2;

  useEffect(() => {
    const hasFilters = languageFilter !== 'All'
      || genre !== 'All'
      || minimumRating > 7
      || runtimeFilter !== 'Any'
      || providerFilter !== 'All';
    if (!hasFilters || query.trim().length >= 2) {
      const timer = window.setTimeout(() => setRemoteFilteredResults(null), 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        view: 'filter',
        industry: languageFilter,
        genre,
        minRating: String(minimumRating),
        runtime: runtimeFilter,
        provider: providerFilter === 'All' ? '' : providerFilter,
        seed: createRecommendationSeed(),
      });
      setIsFiltering(true);
      fetch(`/api/tmdb?${params}`, { signal: controller.signal, cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('FILTER_FAILED');
          return response.json() as Promise<{ results: Movie[] }>;
        })
        .then((data) => setRemoteFilteredResults(data.results))
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          setRemoteFilteredResults([]);
        })
        .finally(() => setIsFiltering(false));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [genre, languageFilter, minimumRating, providerFilter, query, runtimeFilter]);

  useEffect(() => {
    catalogRef.current = [
      ...topPicks,
      ...trending,
      ...(homeShelves?.popular ?? []),
      ...(homeShelves?.nowPlaying ?? []),
      ...(homeShelves?.newReleases ?? []),
      ...(homeShelves?.actionHits ?? []),
      ...(homeShelves?.comedyFavorites ?? []),
      ...(homeShelves?.scifiWorlds ?? []),
    ];
  }, [homeShelves, topPicks, trending]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'configure_movie_recommendations',
          title: 'Configure movie recommendations',
          description: 'Choose a mood and genre to update the visible movie recommendations.',
          inputSchema: {
            type: 'object',
            properties: { mood: { type: 'string', enum: moods }, genre: { type: 'string', enum: genres } },
            required: ['mood', 'genre'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const value = input as { mood?: string; genre?: string };
            if (!value || !moods.includes(value.mood ?? '') || !genres.includes(value.genre ?? '')) {
              throw new Error('Choose a supported mood and genre.');
            }
            setMood(value.mood!);
            setGenre(value.genre!);
            setQuery('');
            return { mood: value.mood, genre: value.genre, status: 'recommendations_updated' };
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'save_movie_to_watchlist',
          title: 'Save movie to watchlist',
          description: 'Save a movie from the current catalog to the device-local watchlist by title.',
          inputSchema: {
            type: 'object',
            properties: { title: { type: 'string' } },
            required: ['title'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const value = input as { title?: string };
            const movie = catalogRef.current.find((item) => item.title.toLowerCase() === value?.title?.trim().toLowerCase());
            if (!movie) throw new Error('Movie title is not in the current catalog.');
            setSaved((current) => {
              const key = movieKey(movie);
              const next = current.includes(key) ? current : [...current, key];
              window.localStorage.setItem(watchlistStorageKey, JSON.stringify(next));
              return next;
            });
            return { title: movie.title, status: 'saved_on_device' };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function toggleSaved(movie: Pick<Movie, 'id' | 'mediaType'>) {
    const key = movieKey(movie);
    setSaved((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      window.localStorage.setItem(watchlistStorageKey, JSON.stringify(next));
      trackEvent('watchlist_toggled', { media_type: movie.mediaType ?? 'movie', action: current.includes(key) ? 'removed' : 'saved' });
      return next;
    });
  }

  function updateFeedback(movie: Pick<Movie, 'id' | 'mediaType'>, value: FeedbackValue) {
    const key = movieKey(movie);
    setFeedback((current) => {
      const next = { ...current };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      window.localStorage.setItem(feedbackStorageKey, JSON.stringify(next));
      trackEvent('movie_feedback', { media_type: movie.mediaType ?? 'movie', feedback: next[key] ?? 'removed' });
      return next;
    });
  }

  async function updateFeaturedForMood(nextMood: string) {
    const requestId = featuredRequestRef.current + 1;
    featuredRequestRef.current = requestId;
    setIsSurprising(true);
    setSearchError('');
    try {
      const response = await fetch(`/api/tmdb?view=discover&mood=${encodeURIComponent(nextMood)}&seed=${createRecommendationSeed()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('SURPRISE_FAILED');
      const data = await response.json() as { results: Movie[] };
      if (requestId !== featuredRequestRef.current) return;
      const eligible = data.results.filter((movie) => feedback[movieKey(movie)] !== 'disliked' && feedback[movieKey(movie)] !== 'watched');
      const candidatePool = eligible.length ? eligible : data.results.filter((movie) => feedback[movieKey(movie)] !== 'disliked');
      const nextMovie = candidatePool.find((movie) => movieKey(movie) !== movieKey(featured)) ?? candidatePool[0];
      if (nextMovie) {
        setFeaturedPool(candidatePool);
        setFeaturedMovie(nextMovie);
      }
      setIsLive(true);
    } catch {
      if (requestId !== featuredRequestRef.current) return;
      const matching = fallbackMovies.filter((movie) => movie.moods.includes(nextMood) && movie.id !== featured.id);
      const pool = matching.length ? matching : fallbackMovies.filter((movie) => movie.id !== featured.id);
      setFeaturedPool(pool);
      setFeaturedMovie(pickRandomMovie(pool) ?? fallbackMovies[0]);
      setSearchError('Live picks were unavailable, so we chose from the curated catalog instead.');
    } finally {
      if (requestId === featuredRequestRef.current) setIsSurprising(false);
    }
  }

  function surpriseMe() {
    trackEvent('surprise_me', { mood });
    void updateFeaturedForMood(mood);
  }

  function chooseMood(nextMood: string) {
    setMood(nextMood);
    trackEvent('mood_selected', { mood: nextMood });
    void updateFeaturedForMood(nextMood);
  }

  function openMovie(movie: Movie) {
    trackEvent('movie_details_opened', { media_type: movie.mediaType ?? 'movie' });
    setSelectedMovie(movie);
    setDetails(null);
    if (!isLive) return;
    setDetailsLoading(true);
    fetch(`/api/tmdb?view=details&id=${movie.id}&type=${movie.mediaType ?? 'movie'}&region=IN`)
      .then((response) => {
        if (!response.ok) throw new Error('DETAILS_FAILED');
        return response.json() as Promise<{ movie: MovieDetails }>;
      })
      .then((data) => setDetails(data.movie))
      .catch(() => undefined)
      .finally(() => setDetailsLoading(false));
  }

  const activeMovie = details ?? selectedMovie;

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="ambient-glow" aria-hidden="true" />
      <header className="netflix-header relative z-20 mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:h-20 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Reelgood home">
          <span className="grid size-9 place-items-center rounded bg-primary text-primary-foreground shadow-[0_0_25px_rgba(229,9,20,.3)]"><Play className="ml-0.5 size-4 fill-current" /></span>
          <span className="text-lg font-black uppercase tracking-[-0.06em] text-primary sm:text-xl">Reelgood</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
          <a className="transition-colors hover:text-foreground" href="#recommendations">Discover</a>
          <a className="transition-colors hover:text-foreground" href="#recommendations">Movies</a>
          <a className="transition-colors hover:text-foreground" href="#watchlist">My list <span className="ml-1 text-primary">{saved.length}</span></a>
        </nav>
      </header>

      <section id="top" className="relative mx-auto grid max-w-[1440px] gap-7 px-4 pb-12 pt-5 sm:gap-10 sm:px-8 sm:pb-16 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.92fr)] lg:px-12 lg:pb-24 lg:pt-14">
        <div className="relative z-10 flex max-w-2xl flex-col justify-center">
          <h1 className="max-w-xl text-balance text-[2.55rem] font-semibold leading-[.96] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
            Less scrolling.<br /><span className="text-primary">More watching.</span>
          </h1>
          <p className="mt-4 max-w-lg text-pretty text-sm leading-6 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-7">
            AI powered Movie recommender
          </p>
          <Button variant="outline" className="mt-5 h-10 self-start rounded-full border-white/10 bg-white/[.04] px-4 text-foreground hover:bg-white/[.08]" onClick={surpriseMe} disabled={isSurprising}>
            {isSurprising ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Shuffle data-icon="inline-start" />} {isSurprising ? 'Finding one…' : 'Surprise me'}
          </Button>
          <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[.045] p-3.5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:rounded-[24px] sm:p-5">
            <div className="flex items-center justify-between gap-4"><p className="text-sm font-medium">What are you in the mood for?</p><span className="text-xs text-muted-foreground">Pick one</span></div>
            <fieldset className="mt-3 flex flex-wrap gap-2" aria-label="Choose a mood">
              {moods.map((item) => (
                <button key={item} className={`rounded-full border px-3 py-1.5 text-xs transition-all sm:px-3.5 sm:py-2 sm:text-sm ${mood === item ? 'border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_rgba(229,9,20,.2)]' : 'border-white/10 bg-black/10 text-muted-foreground hover:border-white/20 hover:text-foreground'}`} onClick={() => chooseMood(item)} aria-pressed={mood === item}>
                  {mood === item && <Check className="mr-1.5 inline size-3.5" />}{item}
                </button>
              ))}
            </fieldset>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); trackEvent('search_submitted'); document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search movies and series" placeholder="Search movies and series" className="h-11 rounded-xl border-white/10 bg-black/15 pl-10" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button type="submit" className="h-11 rounded-xl px-5" disabled={query.trim().length < 2 || isSearching}>
                {isSearching ? <LoaderCircle className="animate-spin" /> : 'Search'} {!isSearching && <ChevronRight data-icon="inline-end" />}
              </Button>
            </form>
            {searchError && <output className="mt-2 block text-xs text-amber-300">{searchError}</output>}
          </div>
        </div>

        <div className="relative min-h-[430px] sm:min-h-[540px] lg:min-h-[620px]">
          <div className="absolute inset-x-5 bottom-3 top-0 rotate-2 rounded-[26px] border border-white/10 bg-white/[.035] sm:inset-x-8 sm:rounded-[34px]" />
          <article key={movieKey(featured)} aria-live="polite" className="featured-card group absolute inset-0 overflow-hidden rounded-[22px] border border-white/10 bg-card shadow-[0_40px_100px_rgba(0,0,0,.42)] sm:rounded-[30px]">
            <img src={featured.backdrop || featured.poster} alt={`${featured.title} artwork`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0d] via-[#090a0d]/38 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <div className="mb-3 flex flex-wrap items-center gap-2"><Badge className="bg-primary text-primary-foreground">#1 match</Badge><Badge variant="outline" className="border-white/20 bg-black/30 text-white backdrop-blur">{featured.mediaType === 'tv' ? 'Series' : 'Movie'}</Badge><Badge variant="outline" className="border-white/20 bg-black/30 text-white backdrop-blur">Because you chose {mood.toLowerCase()}</Badge></div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{featured.title}</h2>
              <div className="mt-2 flex items-center gap-3 text-sm text-white/70"><span>{featured.year}</span><span>•</span>{featured.runtime && <><span>{featured.runtime}</span><span>•</span></>}<span className="flex items-center gap-1 text-amber-300"><Star className="size-3.5 fill-current" /> {featured.rating}</span></div>
              <p className="mt-3 max-w-xl line-clamp-2 text-xs leading-5 text-white/70 sm:mt-4 sm:line-clamp-3 sm:text-sm sm:leading-6">{featured.description}</p>
              <div className="mt-5 flex gap-2">
                <Button className="h-10 rounded-full px-5" onClick={() => openMovie(featured)}><Play className="fill-current" /> View details</Button>
                <Button variant="outline" className="h-10 rounded-full border-white/20 bg-black/20 px-4 text-white hover:bg-white/10" onClick={() => toggleSaved(featured)}>{saved.includes(movieKey(featured)) ? <Check /> : <Bookmark />} {saved.includes(movieKey(featured)) ? 'Saved' : 'My list'}</Button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="recommendations" aria-label="Movie recommendations" className="relative border-t border-white/[.07] bg-[#101010] py-9">
        <div className="mx-auto max-w-[1440px] space-y-8 sm:space-y-9">
          <div className="px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-full border-white/15 bg-white/[.04] px-4 text-white hover:bg-white/10"
                onClick={() => setFiltersOpen((current) => !current)}
                aria-expanded={filtersOpen}
                aria-controls="movie-filters"
              >
                <SlidersHorizontal className="size-4" /> Filters
                {activeFilterCount > 0 && <Badge className="ml-1 min-w-5 justify-center bg-primary px-1.5 text-white">{activeFilterCount}</Badge>}
              </Button>
              <p className="text-xs text-white/45">Movies + series · Bollywood + Hollywood · Rated 7.0 and above</p>
            </div>
            {filtersOpen && (
              <div id="movie-filters" className="mt-4 grid gap-4 rounded-xl border border-white/10 bg-white/[.035] p-4 sm:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1.5 text-xs font-semibold text-white/65">
                  <span>Movie industry</span>
                  <select value={languageFilter} onChange={(event) => { setLanguageFilter(event.target.value); trackEvent('filter_changed', { filter: 'industry', value: event.target.value }); }} className="h-10 w-full rounded-lg border border-white/10 bg-[#181818] px-3 text-sm text-white outline-none focus:border-primary">
                    <option value="All">Bollywood + Hollywood</option>
                    <option value="Bollywood">Bollywood only</option>
                    <option value="Hollywood">Hollywood only</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-white/65">
                  <span>Genre</span>
                  <select value={genre} onChange={(event) => { setGenre(event.target.value); trackEvent('filter_changed', { filter: 'genre', value: event.target.value }); }} className="h-10 w-full rounded-lg border border-white/10 bg-[#181818] px-3 text-sm text-white outline-none focus:border-primary">
                    {genres.map((item) => <option key={item} value={item}>{item === 'All' ? 'All genres' : item}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-white/65">
                  <span>Minimum rating</span>
                  <select value={minimumRating} onChange={(event) => { setMinimumRating(Number(event.target.value)); trackEvent('filter_changed', { filter: 'rating', value: event.target.value }); }} className="h-10 w-full rounded-lg border border-white/10 bg-[#181818] px-3 text-sm text-white outline-none focus:border-primary">
                    <option value={7}>7.0+</option>
                    <option value={7.5}>7.5+</option>
                    <option value={8}>8.0+</option>
                    <option value={8.5}>8.5+</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-white/65">
                  <span>Runtime</span>
                  <select value={runtimeFilter} onChange={(event) => { setRuntimeFilter(event.target.value); trackEvent('filter_changed', { filter: 'runtime', value: event.target.value }); }} className="h-10 w-full rounded-lg border border-white/10 bg-[#181818] px-3 text-sm text-white outline-none focus:border-primary">
                    <option value="Any">Any runtime</option>
                    <option value="under-90">Under 90 min</option>
                    <option value="90-120">90–120 min</option>
                    <option value="120-180">2–3 hours</option>
                    <option value="over-180">Over 3 hours</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-white/65">
                  <span>Streaming service</span>
                  <select value={providerFilter} onChange={(event) => { setProviderFilter(event.target.value); trackEvent('filter_changed', { filter: 'provider', value: event.target.options[event.target.selectedIndex]?.text ?? event.target.value }); }} className="h-10 w-full rounded-lg border border-white/10 bg-[#181818] px-3 text-sm text-white outline-none focus:border-primary">
                    <option value="All">All services</option>
                    {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                  </select>
                </label>
                <Button variant="ghost" className="h-9 justify-self-start px-2 text-xs text-primary sm:col-span-2 lg:col-span-5" onClick={() => { setLanguageFilter('All'); setGenre('All'); setMinimumRating(7); setRuntimeFilter('Any'); setProviderFilter('All'); trackEvent('filters_cleared'); }}>
                  Clear filters
                </Button>
              </div>
            )}
          </div>
          {(isLoading || isFiltering) ? (
            <div className="space-y-3 px-5 sm:px-8 lg:px-12"><Skeleton className="h-5 w-40" /><div className="flex gap-2 overflow-hidden">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[240px] min-w-[158px] sm:h-[200px] sm:min-w-[280px]" />)}</div></div>
          ) : shelves.map((shelf) => (
            <div key={shelf.title} className="mx-5 sm:mx-8 lg:mx-12">
              <h2 className="mb-3 text-base font-bold tracking-[-0.025em] text-white">{shelf.title}</h2>
              <div className={isFilteredView ? 'grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'shelf-scroll flex gap-2 overflow-x-auto pb-2 sm:gap-1.5'}>
                {shelf.items.length === 0 && <p className="py-8 text-sm text-white/55">No movies or series found. Try different filters.</p>}
                {shelf.items.map((movie) => (
                  <button key={`${shelf.title}-${movieKey(movie)}`} className={`movie-card group relative overflow-hidden rounded-md bg-card text-left sm:h-[200px] sm:rounded-sm ${isFilteredView ? 'aspect-[2/3] h-auto w-full sm:aspect-auto' : 'h-[240px] w-[158px] min-w-[158px] shrink-0 sm:w-[280px] sm:min-w-[280px]'}`} onClick={() => openMovie(movie)} aria-label={`View details for ${movie.title}`}>
                    <picture className="block h-full w-full">
                      <source media="(max-width: 639px)" srcSet={movie.poster || movie.backdrop} />
                      <img src={movie.backdrop || movie.poster} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-110" loading="lazy" />
                    </picture>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                    <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/85">{movie.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
                    {feedback[movieKey(movie)] === 'liked' && <span className="pointer-events-none absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-white"><ThumbsUp className="size-3.5" /></span>}
                    {feedback[movieKey(movie)] === 'watched' && <span className="pointer-events-none absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-black"><Eye className="size-3.5" /></span>}
                    <h3 className="pointer-events-none absolute inset-x-2.5 bottom-2.5 line-clamp-2 text-sm font-black leading-tight tracking-[-0.035em] text-white drop-shadow-lg sm:inset-x-3 sm:text-base">{movie.title}</h3>
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5 transition group-hover:ring-white/20" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="watchlist" className="border-t border-white/[.07] px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 rounded-[26px] border border-white/10 bg-white/[.035] p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Heart className="size-5" /></span><div><h2 className="text-xl font-semibold tracking-tight">Your list, minus the login</h2><p className="mt-1 text-sm text-muted-foreground">{saved.length ? `${saved.length} ${saved.length === 1 ? 'film is' : 'films are'} saved on this device.` : 'Save a film from its details to start your watchlist.'}</p></div></div>
          <Button variant="ghost" className="text-primary" onClick={() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })}>Keep exploring <ChevronRight /></Button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 pb-10 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <p>© 2026 Reelgood. Made for movie nights.</p>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </footer>

      {activeMovie && (
        <>
          <button className="fixed inset-0 z-50 cursor-default bg-black/75 backdrop-blur-sm" onClick={() => { setSelectedMovie(null); setDetails(null); }} aria-label="Close movie details" />
          <dialog
            open
            aria-labelledby="movie-detail-title"
            className="scrollbar-hidden fixed left-1/2 top-1/2 z-[60] m-0 max-h-[calc(100dvh-16px)] w-[calc(100%-16px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-white/10 bg-[#181818] p-0 text-white shadow-2xl sm:max-h-[90vh] sm:w-[min(768px,calc(100%-32px))] sm:rounded-xl"
            onCancel={(event) => { event.preventDefault(); setSelectedMovie(null); setDetails(null); }}
          >
            <button className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/65 text-white transition hover:bg-black" onClick={() => { setSelectedMovie(null); setDetails(null); }} aria-label="Close movie details"><X className="size-5" /></button>
              <div className="relative aspect-[16/9] min-h-[220px] overflow-hidden rounded-t-lg sm:aspect-[16/8] sm:min-h-[260px] sm:rounded-t-xl">
                <img src={activeMovie.backdrop || activeMovie.poster} alt={`${activeMovie.title} backdrop`} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-black/20" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                  <h2 id="movie-detail-title" className="text-2xl font-black text-white sm:text-4xl">{activeMovie.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <Badge variant="outline" className="border-white/20 text-white/75">{activeMovie.mediaType === 'tv' ? 'Series' : 'Movie'}</Badge><span>{activeMovie.year}</span><span>•</span><span className="flex items-center gap-1 text-amber-300"><Star className="size-3.5 fill-current" /> {activeMovie.rating}</span>
                    {'runtime' in activeMovie && typeof activeMovie.runtime === 'number' && activeMovie.runtime > 0 && <><span>•</span><span>{formatRuntime(activeMovie.runtime)}</span></>}
                  </div>
                </div>
              </div>
              <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
                {detailsLoading && <div className="flex items-center gap-2 text-sm text-white/60"><LoaderCircle className="size-4 animate-spin" /> Loading cast, trailer, and streaming options…</div>}
                {'tagline' in activeMovie && activeMovie.tagline && <p className="text-sm italic text-white/55">“{activeMovie.tagline}”</p>}
                <p className="text-sm leading-6 text-white/75">{activeMovie.description || 'No synopsis is available yet.'}</p>
                <div className="flex flex-wrap gap-2">{activeMovie.genres.map((item) => <Badge key={item} variant="outline" className="border-white/15 text-white/70">{item}</Badge>)}</div>
                <div className="flex flex-wrap gap-2">
                  {'trailerKey' in activeMovie && activeMovie.trailerKey && <a href={`https://www.youtube.com/watch?v=${activeMovie.trailerKey}`} target="_blank" rel="noreferrer" onClick={() => trackEvent('trailer_opened', { media_type: activeMovie.mediaType ?? 'movie' })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/80"><Play className="size-4 fill-current" /> Play trailer</a>}
                  <Button variant="outline" className="h-10 border-white/15 bg-white/5 text-white" onClick={() => toggleSaved(activeMovie)}>{saved.includes(movieKey(activeMovie)) ? <Check /> : <Bookmark />} {saved.includes(movieKey(activeMovie)) ? 'Saved to my list' : 'Add to my list'}</Button>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4" aria-label="Your feedback">
                  <Button variant="outline" aria-pressed={feedback[movieKey(activeMovie)] === 'liked'} className={`h-9 border-white/15 ${feedback[movieKey(activeMovie)] === 'liked' ? 'bg-primary text-white' : 'bg-white/5 text-white'}`} onClick={() => updateFeedback(activeMovie, 'liked')}><ThumbsUp className="size-4" /> Like</Button>
                  <Button variant="outline" aria-pressed={feedback[movieKey(activeMovie)] === 'disliked'} className={`h-9 border-white/15 ${feedback[movieKey(activeMovie)] === 'disliked' ? 'bg-primary text-white' : 'bg-white/5 text-white'}`} onClick={() => updateFeedback(activeMovie, 'disliked')}><ThumbsDown className="size-4" /> Not for me</Button>
                  <Button variant="outline" aria-pressed={feedback[movieKey(activeMovie)] === 'watched'} className={`h-9 border-white/15 ${feedback[movieKey(activeMovie)] === 'watched' ? 'bg-white text-black' : 'bg-white/5 text-white'}`} onClick={() => updateFeedback(activeMovie, 'watched')}><Eye className="size-4" /> Watched</Button>
                </div>
                {'providers' in activeMovie && activeMovie.providers.length > 0 && (
                  <div><h3 className="text-sm font-bold">Available to stream in India</h3><div className="mt-3 flex flex-wrap items-center gap-3">{activeMovie.providers.map((provider) => <div key={provider.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2 pr-3 text-xs">{provider.logo && <img src={provider.logo} alt="" className="size-7 rounded-md" />}<span>{provider.name}</span></div>)}{activeMovie.providerLink && <a href={activeMovie.providerLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary">View options <ExternalLink className="size-3" /></a>}</div><p className="mt-2 text-[10px] text-white/35">Streaming availability supplied by JustWatch.</p></div>
                )}
                {'cast' in activeMovie && activeMovie.cast.length > 0 && <div><h3 className="text-sm font-bold">Cast</h3><div className="scrollbar-hidden mt-3 flex gap-3 overflow-x-auto pb-2">{activeMovie.cast.map((person) => <div key={person.id} className="w-20 shrink-0 text-center">{person.photo ? <img src={person.photo} alt={person.name} className="mx-auto size-16 rounded-full object-cover" /> : <div className="mx-auto grid size-16 place-items-center rounded-full bg-white/10"><Film className="size-5" /></div>}<p className="mt-2 truncate text-xs font-semibold">{person.name}</p><p className="truncate text-[10px] text-white/45">{person.character}</p></div>)}</div></div>}
                {'recommendations' in activeMovie && activeMovie.recommendations.length > 0 && <div><h3 className="text-sm font-bold">More like this</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{activeMovie.recommendations.slice(0, 6).map((movie) => <button key={movieKey(movie)} className="group relative aspect-[2/3] overflow-hidden rounded-md text-left sm:aspect-video" onClick={() => openMovie(movie)}><picture className="block h-full w-full"><source media="(max-width: 639px)" srcSet={movie.poster || movie.backdrop} /><img src={movie.backdrop || movie.poster} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /></picture><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-6 text-xs font-bold">{movie.title}</span></button>)}</div></div>}
              </div>
          </dialog>
        </>
      )}
    </main>
  );
}
