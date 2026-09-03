'use client';
/* oxlint-disable next/no-img-element -- TMDb artwork is served directly from its image CDN. */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronRight,
  ExternalLink,
  Film,
  Heart,
  LoaderCircle,
  Play,
  Search,
  Shuffle,
  Sparkles,
  Star,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Movie = {
  id: number;
  title: string;
  year: number;
  runtime: string;
  rating: number;
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
  hiddenGems: Movie[];
};

const fallbackMovies: Movie[] = [
  {
    id: 693134,
    title: 'Dune: Part Two',
    year: 2024,
    runtime: '2h 46m',
    rating: 8.5,
    genres: ['Sci-fi', 'Adventure'],
    moods: ['Epic', 'Intense'],
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
    moods: ['Tender', 'Thoughtful'],
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
    moods: ['Fun', 'Epic'],
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
    moods: ['Cozy', 'Fun'],
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
    moods: ['Thoughtful', 'Emotional'],
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
    moods: ['Bold', 'Surreal'],
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
    moods: ['Cozy', 'Emotional'],
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
    moods: ['Intense', 'Thoughtful'],
    description: 'A propulsive portrait of ambition, consequence, and the man at the center of a new age.',
    poster: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  },
];

const moods = ['Cozy', 'Fun', 'Intense', 'Thoughtful', 'Emotional', 'Surreal'];
const genres = ['All', 'Drama', 'Sci-fi', 'Comedy', 'Adventure', 'Animation', 'Fantasy'];
const fallbackTrending = [...fallbackMovies].sort((a, b) => b.rating - a.rating);
const watchlistStorageKey = 'reelgood-watchlist:v1';

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

export default function Home() {
  const [mood, setMood] = useState('Thoughtful');
  const [genre, setGenre] = useState('All');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<number[]>([]);
  const [homeShelves, setHomeShelves] = useState<HomeShelves | null>(null);
  const [moodResults, setMoodResults] = useState<Movie[] | null>(null);
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isSurprising, setIsSurprising] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const catalogRef = useRef<Movie[]>(fallbackMovies);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = window.localStorage.getItem(watchlistStorageKey);
      if (stored) timer = window.setTimeout(() => setSaved(JSON.parse(stored)), 0);
    } catch {
      timer = window.setTimeout(() => setSaved([]), 0);
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
        setIsLive(true);
      })
      .catch(() => setIsLive(false))
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isLive || query.trim()) return;
    const controller = new AbortController();
    fetch(`/api/tmdb?view=discover&mood=${encodeURIComponent(mood)}&seed=${Date.now()}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('DISCOVER_FAILED');
        return response.json() as Promise<{ results: Movie[] }>;
      })
      .then((data) => setMoodResults(data.results))
      .catch(() => undefined);
    return () => controller.abort();
  }, [isLive, mood, query]);

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
        const score = (movie: Movie) => (movie.moods.includes(mood) ? 3 : 0) + movie.rating / 10;
        return score(b) - score(a);
      });
  }, [genre, mood, query]);

  const topPicks = query.trim().length >= 2
    ? searchResults ?? fallbackRanked
    : moodResults ?? homeShelves?.topPicks ?? fallbackRanked;
  const trending = homeShelves?.trending ?? fallbackTrending;
  const featured = topPicks[0] ?? trending[0] ?? fallbackMovies[0];
  const shelves = query.trim().length >= 2
    ? [{ title: `Search results for “${query.trim()}”`, items: topPicks }]
    : [
        { title: `Top picks for a ${mood.toLowerCase()} mood`, items: topPicks },
        { title: 'Trending now', items: trending },
        ...(homeShelves ? [
          { title: 'Popular tonight', items: homeShelves.popular },
          { title: 'Now playing in cinemas', items: homeShelves.nowPlaying },
          { title: 'Fresh releases', items: homeShelves.newReleases },
          { title: 'Adrenaline rush', items: homeShelves.actionHits },
          { title: 'Comedy favorites', items: homeShelves.comedyFavorites },
          { title: 'Sci-fi worlds', items: homeShelves.scifiWorlds },
          { title: 'Hidden gems', items: homeShelves.hiddenGems },
        ] : []),
      ];

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
      ...(homeShelves?.hiddenGems ?? []),
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
              const next = current.includes(movie.id) ? current : [...current, movie.id];
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

  function toggleSaved(id: number) {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((movieId) => movieId !== id) : [...current, id];
      window.localStorage.setItem(watchlistStorageKey, JSON.stringify(next));
      return next;
    });
  }

  async function surpriseMe() {
    setIsSurprising(true);
    setQuery('');
    setSearchResults(null);
    setSearchError('');
    try {
      const response = await fetch(`/api/tmdb?view=discover&mood=${encodeURIComponent(mood)}&seed=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('SURPRISE_FAILED');
      const data = await response.json() as { results: Movie[] };
      setMoodResults(data.results);
      setIsLive(true);
    } catch {
      const matching = fallbackMovies.filter((movie) => movie.moods.includes(mood));
      setMoodResults((matching.length ? matching : fallbackMovies).sort(() => Math.random() - 0.5));
      setSearchError('Live picks were unavailable, so we shuffled the curated catalog instead.');
    } finally {
      setIsSurprising(false);
      window.setTimeout(() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  }

  function openMovie(movie: Movie) {
    setSelectedMovie(movie);
    setDetails(null);
    if (!isLive) return;
    setDetailsLoading(true);
    fetch(`/api/tmdb?view=details&id=${movie.id}&region=IN`)
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
      <header className="netflix-header relative z-20 mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Reelgood home">
          <span className="grid size-9 place-items-center rounded bg-primary text-primary-foreground shadow-[0_0_25px_rgba(229,9,20,.3)]"><Play className="ml-0.5 size-4 fill-current" /></span>
          <span className="text-xl font-black uppercase tracking-[-0.06em] text-primary">Reelgood</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
          <a className="transition-colors hover:text-foreground" href="#recommendations">Discover</a>
          <a className="transition-colors hover:text-foreground" href="#recommendations">Movies</a>
          <a className="transition-colors hover:text-foreground" href="#watchlist">My list <span className="ml-1 text-primary">{saved.length}</span></a>
        </nav>
        <Button variant="outline" className="h-10 rounded-full border-white/10 bg-white/[.04] px-4 text-foreground hover:bg-white/[.08]" onClick={surpriseMe} disabled={isSurprising}>
          {isSurprising ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Shuffle data-icon="inline-start" />} {isSurprising ? 'Finding one…' : 'Surprise me'}
        </Button>
      </header>

      <section id="top" className="relative mx-auto grid max-w-[1440px] gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.92fr)] lg:px-12 lg:pb-24 lg:pt-14">
        <div className="relative z-10 flex max-w-2xl flex-col justify-center">
          <Badge className="mb-6 h-7 rounded-full border border-primary/20 bg-primary/10 px-3 text-primary" variant="outline">
            <Sparkles className="size-3.5" /> {isLive ? 'Live picks powered by TMDb' : 'Curated preview catalog'}
          </Badge>
          <h1 className="max-w-xl text-balance text-5xl font-semibold leading-[.96] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
            Less scrolling.<br /><span className="text-primary">More watching.</span>
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Tell us the vibe. We’ll find films that feel right—and explain why each one belongs on your screen tonight.
          </p>
          <div className="mt-9 rounded-[24px] border border-white/10 bg-white/[.045] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-4"><p className="text-sm font-medium">What are you in the mood for?</p><span className="text-xs text-muted-foreground">Pick one</span></div>
            <fieldset className="mt-3 flex flex-wrap gap-2" aria-label="Choose a mood">
              {moods.map((item) => (
                <button key={item} className={`rounded-full border px-3.5 py-2 text-sm transition-all ${mood === item ? 'border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_rgba(229,9,20,.2)]' : 'border-white/10 bg-black/10 text-muted-foreground hover:border-white/20 hover:text-foreground'}`} onClick={() => { setMood(item); setQuery(''); }} aria-pressed={mood === item}>
                  {mood === item && <Check className="mr-1.5 inline size-3.5" />}{item}
                </button>
              ))}
            </fieldset>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search movies" placeholder="Search thousands of movies" className="h-11 rounded-xl border-white/10 bg-black/15 pl-10" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button type="submit" className="h-11 rounded-xl px-5" disabled={query.trim().length < 2 || isSearching}>
                {isSearching ? <LoaderCircle className="animate-spin" /> : 'Search'} {!isSearching && <ChevronRight data-icon="inline-end" />}
              </Button>
            </form>
            {searchError && <output className="mt-2 block text-xs text-amber-300">{searchError}</output>}
          </div>
          <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Film className="size-3.5 text-primary" /> {isLive ? 'Live movie catalog' : `${fallbackMovies.length} preview films`}</span>
            <span className="flex items-center gap-1.5"><Bookmark className="size-3.5 text-primary" /> Saves on this device</span>
          </div>
        </div>

        <div className="relative min-h-[540px] lg:min-h-[620px]">
          <div className="absolute inset-x-8 bottom-3 top-0 rotate-2 rounded-[34px] border border-white/10 bg-white/[.035]" />
          <article className="group absolute inset-0 overflow-hidden rounded-[30px] border border-white/10 bg-card shadow-[0_40px_100px_rgba(0,0,0,.42)]">
            <img src={featured.backdrop || featured.poster} alt={`${featured.title} artwork`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0d] via-[#090a0d]/38 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="mb-3 flex flex-wrap items-center gap-2"><Badge className="bg-primary text-primary-foreground">#1 match</Badge><Badge variant="outline" className="border-white/20 bg-black/30 text-white backdrop-blur">Because you chose {mood.toLowerCase()}</Badge></div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{featured.title}</h2>
              <div className="mt-2 flex items-center gap-3 text-sm text-white/70"><span>{featured.year}</span><span>•</span>{featured.runtime && <><span>{featured.runtime}</span><span>•</span></>}<span className="flex items-center gap-1 text-amber-300"><Star className="size-3.5 fill-current" /> {featured.rating}</span></div>
              <p className="mt-4 max-w-xl line-clamp-3 text-sm leading-6 text-white/70">{featured.description}</p>
              <div className="mt-5 flex gap-2">
                <Button className="h-10 rounded-full px-5" onClick={() => openMovie(featured)}><Play className="fill-current" /> View details</Button>
                <Button variant="outline" className="h-10 rounded-full border-white/20 bg-black/20 px-4 text-white hover:bg-white/10" onClick={() => toggleSaved(featured.id)}>{saved.includes(featured.id) ? <Check /> : <Bookmark />} {saved.includes(featured.id) ? 'Saved' : 'My list'}</Button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="recommendations" aria-label="Movie recommendations" className="relative border-t border-white/[.07] bg-[#101010] py-9">
        <div className="mx-auto max-w-[1440px] space-y-9">
          {isLoading ? (
            <div className="space-y-3 px-5 sm:px-8 lg:px-12"><Skeleton className="h-5 w-40" /><div className="flex gap-2 overflow-hidden">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="aspect-video min-w-[230px]" />)}</div></div>
          ) : shelves.map((shelf) => (
            <div key={shelf.title}>
              <h2 className="mb-3 px-5 text-base font-bold tracking-[-0.025em] text-white sm:px-8 lg:px-12">{shelf.title}</h2>
              <div className="shelf-scroll flex gap-1.5 overflow-x-auto px-5 pb-2 sm:px-8 lg:px-12">
                {shelf.items.length === 0 && <p className="py-8 text-sm text-white/55">No movies found. Try another title.</p>}
                {shelf.items.map((movie) => (
                  <button key={`${shelf.title}-${movie.id}`} className="movie-card group relative h-[200px] w-[48vw] max-w-[320px] min-w-[230px] shrink-0 overflow-hidden rounded-sm bg-card text-left sm:min-w-[280px]" onClick={() => openMovie(movie)} aria-label={`View details for ${movie.title}`}>
                    <img src={movie.backdrop || movie.poster} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-110" loading="lazy" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                    <h3 className="pointer-events-none absolute inset-x-3 bottom-2.5 line-clamp-2 text-sm font-black leading-tight tracking-[-0.035em] text-white drop-shadow-lg sm:text-base">{movie.title}</h3>
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
            className="scrollbar-hidden fixed left-1/2 top-1/2 z-[60] m-0 max-h-[90vh] w-[min(768px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-white/10 bg-[#181818] p-0 text-white shadow-2xl"
            onCancel={(event) => { event.preventDefault(); setSelectedMovie(null); setDetails(null); }}
          >
            <button className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/65 text-white transition hover:bg-black" onClick={() => { setSelectedMovie(null); setDetails(null); }} aria-label="Close movie details"><X className="size-5" /></button>
              <div className="relative aspect-[16/8] min-h-[260px] overflow-hidden rounded-t-xl">
                <img src={activeMovie.backdrop || activeMovie.poster} alt={`${activeMovie.title} backdrop`} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-black/20" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <h2 id="movie-detail-title" className="text-3xl font-black text-white sm:text-4xl">{activeMovie.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <span>{activeMovie.year}</span><span>•</span><span className="flex items-center gap-1 text-amber-300"><Star className="size-3.5 fill-current" /> {activeMovie.rating}</span>
                    {'runtime' in activeMovie && typeof activeMovie.runtime === 'number' && activeMovie.runtime > 0 && <><span>•</span><span>{formatRuntime(activeMovie.runtime)}</span></>}
                  </div>
                </div>
              </div>
              <div className="space-y-6 p-6">
                {detailsLoading && <div className="flex items-center gap-2 text-sm text-white/60"><LoaderCircle className="size-4 animate-spin" /> Loading cast, trailer, and streaming options…</div>}
                {'tagline' in activeMovie && activeMovie.tagline && <p className="text-sm italic text-white/55">“{activeMovie.tagline}”</p>}
                <p className="text-sm leading-6 text-white/75">{activeMovie.description || 'No synopsis is available yet.'}</p>
                <div className="flex flex-wrap gap-2">{activeMovie.genres.map((item) => <Badge key={item} variant="outline" className="border-white/15 text-white/70">{item}</Badge>)}</div>
                <div className="flex flex-wrap gap-2">
                  {'trailerKey' in activeMovie && activeMovie.trailerKey && <a href={`https://www.youtube.com/watch?v=${activeMovie.trailerKey}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/80"><Play className="size-4 fill-current" /> Play trailer</a>}
                  <Button variant="outline" className="h-10 border-white/15 bg-white/5 text-white" onClick={() => toggleSaved(activeMovie.id)}>{saved.includes(activeMovie.id) ? <Check /> : <Bookmark />} {saved.includes(activeMovie.id) ? 'Saved to my list' : 'Add to my list'}</Button>
                </div>
                {'providers' in activeMovie && activeMovie.providers.length > 0 && (
                  <div><h3 className="text-sm font-bold">Available to stream in India</h3><div className="mt-3 flex flex-wrap items-center gap-3">{activeMovie.providers.map((provider) => <div key={provider.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2 pr-3 text-xs">{provider.logo && <img src={provider.logo} alt="" className="size-7 rounded-md" />}<span>{provider.name}</span></div>)}{activeMovie.providerLink && <a href={activeMovie.providerLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary">View options <ExternalLink className="size-3" /></a>}</div><p className="mt-2 text-[10px] text-white/35">Streaming availability supplied by JustWatch.</p></div>
                )}
                {'cast' in activeMovie && activeMovie.cast.length > 0 && <div><h3 className="text-sm font-bold">Cast</h3><div className="scrollbar-hidden mt-3 flex gap-3 overflow-x-auto pb-2">{activeMovie.cast.map((person) => <div key={person.id} className="w-20 shrink-0 text-center">{person.photo ? <img src={person.photo} alt={person.name} className="mx-auto size-16 rounded-full object-cover" /> : <div className="mx-auto grid size-16 place-items-center rounded-full bg-white/10"><Film className="size-5" /></div>}<p className="mt-2 truncate text-xs font-semibold">{person.name}</p><p className="truncate text-[10px] text-white/45">{person.character}</p></div>)}</div></div>}
                {'recommendations' in activeMovie && activeMovie.recommendations.length > 0 && <div><h3 className="text-sm font-bold">More like this</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{activeMovie.recommendations.slice(0, 6).map((movie) => <button key={movie.id} className="group relative aspect-video overflow-hidden rounded-md text-left" onClick={() => openMovie(movie)}><img src={movie.backdrop || movie.poster} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-6 text-xs font-bold">{movie.title}</span></button>)}</div></div>}
              </div>
          </dialog>
        </>
      )}
    </main>
  );
}
