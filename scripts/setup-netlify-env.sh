#!/bin/bash
# Set Netlify environment variables using CLI

# Load environment variables
set -a
source .env
source .env.local
set +a

# Install latest CLI
npm install -g netlify-cli@latest

# Login
netlify login

# Set variables using environment values
netlify env:set VITE_OPENAI_API_KEY "$VITE_OPENAI_API_KEY" --context production
netlify env:set VITE_WEATHER_API_KEY "$VITE_WEATHER_API_KEY" --context production
netlify env:set VITE_FIREBASE_API_KEY "$VITE_FIREBASE_API_KEY" --context production
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "$VITE_FIREBASE_AUTH_DOMAIN" --context production
netlify env:set VITE_FIREBASE_PROJECT_ID "$VITE_FIREBASE_PROJECT_ID" --context production
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "$VITE_FIREBASE_STORAGE_BUCKET" --context production
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "$VITE_FIREBASE_MESSAGING_SENDER_ID" --context production
netlify env:set VITE_FIREBASE_APP_ID "$VITE_FIREBASE_APP_ID" --context production

echo "Environment variables set successfully" 