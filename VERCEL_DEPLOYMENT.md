# Vercel deployment

This project keeps its existing OpenAI Sites/Cloudflare build and automatically
uses Vinext's Nitro adapter when Vercel builds it.

## Vercel project settings

- Root Directory: `movie-recommender` when importing the parent repository, or
  leave it at the repository root when this folder is the repository.
- Node.js Version: `22.x`
- Build Command: `npm run build:vercel`
- Output Directory: leave this blank/default. Nitro writes Vercel's native Build
  Output API files to `.vercel/output`.

The build and output settings are also committed in `vercel.json`.

## Required environment variable

Add `TMDB_READ_TOKEN` to the Production and Preview environments in the Vercel
dashboard. It is a server-only secret and must not use a `NEXT_PUBLIC_` prefix.

Because a token was previously shared in chat, create a replacement TMDb read
access token before adding it to Vercel.

## Deploy

Import the Git repository from the Vercel dashboard, configure the environment
variable, and deploy. No user-account or database configuration is required.

After deployment, verify the home page, search, Surprise Me, and one movie detail
dialog. These flows all use the server-side `/api/tmdb` route.
