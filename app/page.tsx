'use client';
/* oxlint-disable next/no-img-element -- Curated remote poster art is intentionally rendered without a proxy. */

import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronRight,
  Film,
  Heart,
  Play,
  Search,
  Shuffle,
  Sparkles,
  Star,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
};

const movies: Movie[] = [
  {
    id: 1,
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
    id: 2,
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
    id: 3,
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
    id: 4,
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
    id: 5,
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
    id: 6,
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
    id: 7,
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
    id: 8,
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

export default function Home() {
  const [mood, setMood] = useState('Thoughtful');
  const [genre, setGenre] = useState('All');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<number[]>([]);

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
            properties: {
              mood: { type: 'string', enum: moods },
              genre: { type: 'string', enum: genres },
            },
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
          description: 'Save a known movie to the device-local watchlist by title.',
          inputSchema: {
            type: 'object',
            properties: { title: { type: 'string' } },
            required: ['title'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const value = input as { title?: string };
            const movie = movies.find((item) => item.title.toLowerCase() === value?.title?.trim().toLowerCase());
            if (!movie) throw new Error('Movie title is not in the current curated catalog.');
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

  const ranked = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return movies
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

  const featured = ranked[0] ?? movies[0];

  function toggleSaved(id: number) {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((movieId) => movieId !== id) : [...current, id];
      window.localStorage.setItem(watchlistStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function surpriseMe() {
    const nextMood = moods[Math.floor(Math.random() * moods.length)];
    setMood(nextMood);
    setGenre('All');
    setQuery('');
    document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="ambient-glow" aria-hidden="true" />
      <header className="netflix-header relative z-20 mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Reelgood home">
          <span className="grid size-9 place-items-center rounded bg-primary text-primary-foreground shadow-[0_0_25px_rgba(229,9,20,.3)]">
            <Play className="ml-0.5 size-4 fill-current" />
          </span>
          <span className="text-xl font-black uppercase tracking-[-0.06em] text-primary">Reelgood</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
          <a className="transition-colors hover:text-foreground" href="#recommendations">Discover</a>
          <a className="transition-colors hover:text-foreground" href="#recommendations">Movies</a>
          <a className="transition-colors hover:text-foreground" href="#watchlist">My list <span className="ml-1 text-primary">{saved.length}</span></a>
        </nav>
        <Button variant="outline" className="h-10 rounded-full border-white/10 bg-white/[.04] px-4 text-foreground hover:bg-white/[.08]" onClick={surpriseMe}>
          <Shuffle data-icon="inline-start" /> Surprise me
        </Button>
      </header>

      <section id="top" className="relative mx-auto grid max-w-[1440px] gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.92fr)] lg:px-12 lg:pb-24 lg:pt-14">
        <div className="relative z-10 flex max-w-2xl flex-col justify-center">
          <Badge className="mb-6 h-7 rounded-full border border-primary/20 bg-primary/10 px-3 text-primary" variant="outline">
            <Sparkles className="size-3.5" /> Picks that fit your moment
          </Badge>
          <h1 className="max-w-xl text-balance text-5xl font-semibold leading-[.96] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
            Less scrolling.<br /><span className="text-primary">More watching.</span>
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Tell us the vibe. We’ll find films that feel right—and explain why each one belongs on your screen tonight.
          </p>

          <div className="mt-9 rounded-[24px] border border-white/10 bg-white/[.045] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">What are you in the mood for?</p>
              <span className="text-xs text-muted-foreground">Pick one</span>
            </div>
            <fieldset className="mt-3 flex flex-wrap gap-2" aria-label="Choose a mood">
              {moods.map((item) => (
                <button
                  key={item}
                  className={`rounded-full border px-3.5 py-2 text-sm transition-all ${mood === item ? 'border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_rgba(229,9,20,.2)]' : 'border-white/10 bg-black/10 text-muted-foreground hover:border-white/20 hover:text-foreground'}`}
                  onClick={() => setMood(item)}
                  aria-pressed={mood === item}
                >
                  {mood === item && <Check className="mr-1.5 inline size-3.5" />}{item}
                </button>
              ))}
            </fieldset>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search movies"
                  placeholder="Search a title or genre"
                  className="h-11 rounded-xl border-white/10 bg-black/15 pl-10"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button className="h-11 rounded-xl px-5" onClick={() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })}>
                Find my movie <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Film className="size-3.5 text-primary" /> 8 handpicked films</span>
            <span className="flex items-center gap-1.5"><Bookmark className="size-3.5 text-primary" /> Saves on this device</span>
          </div>
        </div>

        <div className="relative min-h-[540px] lg:min-h-[620px]">
          <div className="absolute inset-x-8 bottom-3 top-0 rotate-2 rounded-[34px] border border-white/10 bg-white/[.035]" />
          <article className="group absolute inset-0 overflow-hidden rounded-[30px] border border-white/10 bg-card shadow-[0_40px_100px_rgba(0,0,0,.42)]">
            <img src={featured.poster} alt={`${featured.title} poster`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0d] via-[#090a0d]/38 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">#1 match</Badge>
                <Badge variant="outline" className="border-white/20 bg-black/30 text-white backdrop-blur">Because you chose {mood.toLowerCase()}</Badge>
              </div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{featured.title}</h2>
              <div className="mt-2 flex items-center gap-3 text-sm text-white/70">
                <span>{featured.year}</span><span>•</span><span>{featured.runtime}</span><span>•</span>
                <span className="flex items-center gap-1 text-amber-300"><Star className="size-3.5 fill-current" /> {featured.rating}</span>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">{featured.description}</p>
              <div className="mt-5 flex gap-2">
                <Button className="h-10 rounded-full px-5"><Play className="fill-current" /> Watch trailer</Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-white/20 bg-black/20 px-4 text-white hover:bg-white/10"
                  onClick={() => toggleSaved(featured.id)}
                >
                  {saved.includes(featured.id) ? <Check /> : <Bookmark />} {saved.includes(featured.id) ? 'Saved' : 'My list'}
                </Button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="recommendations" aria-label="Tonight's best matches" className="relative border-t border-white/[.07] bg-black/10 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:gap-5">
          {ranked.map((movie) => (
            <div key={movie.id} className="movie-card group relative aspect-[4/3] overflow-hidden rounded-lg bg-card">
              <img
                src={movie.poster}
                alt={`${movie.title} poster`}
                className="h-full w-full object-cover object-[center_28%] transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>

      <section id="watchlist" className="border-t border-white/[.07] px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 rounded-[26px] border border-white/10 bg-white/[.035] p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Heart className="size-5" /></span>
            <div><h2 className="text-xl font-semibold tracking-tight">Your list, minus the login</h2><p className="mt-1 text-sm text-muted-foreground">{saved.length ? `${saved.length} ${saved.length === 1 ? 'film is' : 'films are'} saved on this device.` : 'Tap the bookmark on any film to start a watchlist.'}</p></div>
          </div>
          <Button variant="ghost" className="text-primary" onClick={() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })}>Keep exploring <ChevronRight /></Button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 pb-10 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <p>© 2026 Reelgood. Made for movie nights.</p>
        <p>Your preferences never leave this device.</p>
      </footer>
    </main>
  );
}
