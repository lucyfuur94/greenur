# Environment Variables Setup

This document explains how to set up environment variables for the Greenur webapp.

## Netlify Environment Variables

For the location search functionality, you need to set the following environment variable in Netlify:

### Setting up in Netlify Dashboard

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add variable**
4. Add the following variable:

```
GOOGLE_API_KEY=your-google-api-key-here
```

### Local Development

For local development with Netlify Dev, add the following to your existing `.env` file in the root directory:

```bash
# .env (root directory - already exists)
GOOGLE_API_KEY=your-google-api-key-here
```

## Backend Environment Variables

The backend server (if used) requires different environment variables. See `backend/env.example` for the complete list.

## Security Note

- Never commit `.env` files to version control
- The `.env` file is already included in `.gitignore`
- For production, always use the platform's environment variable system (Netlify Dashboard, Render Dashboard, etc.)
- **NEVER include actual API keys or secrets in documentation files**

## Functions that use Environment Variables

- `netlify/functions/search-locations.ts` - Uses `GOOGLE_API_KEY` for location search
- Other functions may be added in the future that use the same `GOOGLE_API_KEY` for various Google services

## Troubleshooting

If location search is not working:

1. Verify the environment variable `GOOGLE_API_KEY` is set in Netlify Dashboard
2. Check the Netlify function logs for any API key errors
3. Ensure the Google Places API is enabled in your Google Cloud Console
4. Verify API key permissions and quotas 