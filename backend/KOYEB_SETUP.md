# Setting Up the Botanist Voice Service on Koyeb

This document outlines the steps needed to deploy the Botanist Voice Service to Koyeb.

## Prerequisites

1. A Koyeb account
2. Your Google Cloud service account JSON key file (`botanist-call-assistant@aegisg-494e1.iam.gserviceaccount.com`)
3. Your OpenAI API key

## Deployment Options

### Option 1: Manual Deployment via Koyeb Dashboard

1. Log in to the [Koyeb dashboard](https://app.koyeb.com/)

2. Navigate to your existing service `olympic-perry/greenur`

3. Go to "Settings" tab for the service

4. Update environment variables with:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GOOGLE_CREDENTIALS_JSON`: Paste the entire content of your Google Cloud service account JSON key file

   Make sure to set both as "Secret" type variables.

5. Click "Save" to apply the changes

6. Redeploy the service from the "Overview" tab by clicking "Redeploy" button

### Option 2: GitHub Actions Automated Deployment

1. In your GitHub repository, go to "Settings" > "Secrets and variables" > "Actions"

2. Add the following secrets:
   - `KOYEB_API_TOKEN`: Your Koyeb API token (create one in Koyeb dashboard under Account settings)
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GOOGLE_CREDENTIALS_JSON`: The entire content of your Google Cloud service account JSON key file

3. The GitHub workflow in `.github/workflows/deploy-koyeb.yml` will automatically deploy any changes to the backend directory to Koyeb

## Verifying Deployment

1. After deployment, check the service logs in the Koyeb dashboard

2. You should see messages indicating:
   - "Using Google credentials from environment variable JSON"
   - "Server running on port 8080"

3. Your WebRTC signaling service will be available at `wss://olympic-perry-greenur.koyeb.app/ws`

## Updating Frontend Configuration

Update your frontend configuration to use the new WebSocket URL:

```typescript
// In src/services/webRTCService.ts
const wsUrl = import.meta.env.VITE_NETLIFY_WS_PORT 
  ? `ws://localhost:${import.meta.env.VITE_NETLIFY_WS_PORT}` 
  : 'wss://olympic-perry-greenur.koyeb.app/ws';
```

## Troubleshooting

### Google Cloud Authentication Issues

If you encounter issues with Google Cloud authentication:

1. Check the logs in Koyeb dashboard
2. Verify that your Google service account has the necessary permissions:
   - Speech-to-Text API access
   - Text-to-Speech API access

### WebRTC Connection Issues

If the WebRTC connection fails:

1. Check browser console for errors
2. Ensure your Koyeb service allows WebSocket connections
3. Verify that your service is running properly by checking the logs

## Maintenance

- Periodically check for expired credentials
- Monitor service performance in Koyeb dashboard
- Update dependencies as necessary 