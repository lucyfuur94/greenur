# GitHub Actions Deployment to Netlify

This guide explains how to deploy your Greenur webapp to Netlify using GitHub Actions instead of Netlify's automatic Git integration. This approach gives you more control and can resolve deployment hanging issues.

## Why Use GitHub Actions?

- **Better Control**: Full control over the build environment and process
- **Faster Debugging**: Clear logs in GitHub Actions interface
- **Consistent Builds**: Same environment every time
- **Preview Deployments**: Automatic preview deployments for pull requests
- **Reliability**: Avoids Netlify's Git integration hanging issues

## Setup Instructions

### 1. Get Your Netlify Credentials

#### Get Netlify Site ID:
1. Go to your Netlify dashboard
2. Click on your site
3. Go to **Site Settings** → **General**
4. Copy the **Site ID** (looks like: `abc123def-4567-8901-2345-ghijk6789lmn`)

#### Get Netlify Auth Token:
1. Go to [Netlify User Settings](https://app.netlify.com/user/applications)
2. Click **Personal access tokens**
3. Click **New access token**
4. Give it a name like "GitHub Actions Deploy"
5. Copy the generated token (starts with `nfp_`)

### 2. Add Secrets to GitHub Repository

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these two secrets:

   **Secret 1:**
   - Name: `NETLIFY_AUTH_TOKEN`
   - Value: Your Netlify personal access token (from step 1)

   **Secret 2:**
   - Name: `NETLIFY_SITE_ID`
   - Value: Your Netlify site ID (from step 1)

### 3. Disable Netlify Auto-Deploy

To prevent conflicts between GitHub Actions and Netlify's Git integration:

1. Go to your Netlify site dashboard
2. Click **Site Settings** → **Build & deploy**
3. Scroll to **Continuous Deployment**
4. Click **Edit settings** next to "Branch deploys"
5. Set **Production branch** to `None` or disable auto-deploys
6. Click **Save**

Alternatively, you can keep Netlify's Git integration disabled by not connecting your GitHub repository to Netlify.

### 4. How It Works

The GitHub Action workflow (`.github/workflows/netlify-deploy.yml`) will:

1. **On Push to main/master**: Deploy to production
2. **On Pull Requests**: Deploy a preview version
3. **Build Process**: 
   - Checkout code
   - Setup Node.js 18.17.1
   - Install dependencies with `npm ci`
   - Build project with `npm run build`
   - Deploy using Netlify CLI

### 5. Workflow Features

- ✅ **Production Deployments**: Automatic deployment to production on main branch
- ✅ **Preview Deployments**: Preview deployments for pull requests
- ✅ **Build Caching**: Caches npm dependencies for faster builds
- ✅ **Proper Error Handling**: Clear error messages if build fails
- ✅ **Commit Messages**: Deployment messages include commit SHA for tracking

### 6. Testing the Setup

1. Push a change to your main branch
2. Go to **Actions** tab in your GitHub repository
3. Watch the "Deploy to Netlify" workflow run
4. Check your Netlify dashboard for the successful deployment

### 7. Monitoring Deployments

- **GitHub**: Check the Actions tab for build logs and status
- **Netlify**: Check the Deploys tab for deployment status and live site
- **Pull Requests**: Preview deployment URLs will be commented automatically

### 8. Troubleshooting

#### Common Issues:

**Build Fails with "Permission denied":**
- Check that your `NETLIFY_AUTH_TOKEN` is correct
- Ensure the token has the right permissions

**Site not found error:**
- Verify your `NETLIFY_SITE_ID` is correct
- Check that the site exists in your Netlify account

**Build hangs or times out:**
- This workflow should resolve the hanging issues you experienced
- GitHub Actions has clear timeout handling

**Environment variables missing:**
- Add any required environment variables to GitHub Secrets
- Reference them in the workflow file under the `env:` section

### 9. Customization

You can customize the workflow by:

- Adding environment variables for your app
- Including additional build steps
- Adding testing before deployment
- Modifying branch patterns for deployment
- Adding Slack/Discord notifications

### 10. Reverting to Netlify Git Integration

If you want to revert back to Netlify's Git integration:

1. Re-enable auto-deploys in Netlify settings
2. Delete or disable the GitHub Actions workflow
3. Remove the GitHub secrets if desired

## Benefits of This Approach

1. **Reliability**: No more hanging deployments
2. **Visibility**: Clear build logs in GitHub
3. **Control**: Full control over the build process
4. **Speed**: Often faster than Netlify's Git integration
5. **Features**: Preview deployments and better CI/CD integration 