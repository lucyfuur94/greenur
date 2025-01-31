# Greenur Project Details

## 1. Core Features
### 1.1 Plant Analysis System
- Image-based plant identification (iNaturalist integration)
- Plant care recommendations (GPT-4 integration)
- Disease diagnosis system
- Multi-language support (Translation API)

### 1.2 Botanical Knowledge Base
- Plant encyclopedia with search (BotanicaSearch)
- Detailed plant profiles (BotanicaPlant)
- Gardening video library (YouTube API integration)
- Weather integration (OpenWeatherMap API)

### 1.3 User Management
- Firebase authentication system
- User profiles with plant collections
- Progress tracking (Tracker page)
- Personalized recommendations

### 1.4 Assistant System
- AI-powered gardening assistant
- Location-based suggestions
- Seasonal planting guide
- Overflow prevention hooks

## 2. Technical Architecture
### 2.1 Frontend
- React-based SPA with Vite
- Component structure:
  - Authentication system
  - Location picker
  - Weather widget
  - Search suggestions
- Context API for state management

### 2.2 Backend Services
- Netlify Functions handling:
  - Plant analysis
  - Weather data
  - Video retrieval
  - Translation services
- Firebase integration:
  - Realtime Database
  - Authentication
  - Cloud Functions

## 3. External Services Integration
- iNaturalist API (plant identification)
- OpenWeatherMap API (weather data)
- YouTube Data API (gardening videos)
- OpenAI GPT-4 (recommendations)
- Google Cloud Translation API

## 4. Development Practices
### 4.1 Version Management
- **Semantic Versioning**:
  - MAJOR version for breaking changes
  - MINOR version for new features
  - PATCH version for bug fixes
- **Merge Operations**:
  - Merges to `main` from `test` increment minor version (1.0.0 → 1.1.0)
  - Hotfix merges to `main` increment patch version (1.0.1 → 1.0.2)
  - Use `scripts/merge-test-to-main.sh` for production merges
- **Release Process**:
  - Major versions require:
    - Update to `PROJECT_DETAILS.md`
    - Migration guide for breaking changes
    - Approval via `!release major` comment

### 4.2 Logging Standards
- All new code must include appropriate logging:
  - Debug logs for complex operations
  - Info logs for user-initiated actions
  - Error logs with context for failures
- Use structured logging format: `[Category] Message {metadata}`
- Log to both console and terminal in development
- Never log sensitive user data (emails, passwords, location coordinates)
- Use the centralized logger utility for production logging

## Overview
Greenur is a modern web application designed to help users discover, learn about, and care for plants. The platform combines data from multiple sources including Wikidata, Wikipedia, OpenFarm, and various other APIs to provide comprehensive plant information.

## Tech Stack
- **Frontend Framework**: React with TypeScript
- **UI Library**: Chakra UI
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **State Management**: React Context API
- **Routing**: React Router v6
- **API Integration**: Wikidata, Wikipedia, OpenFarm, YouTube API, Bing News API
- **Build Tool**: Vite

## Pages & Features

### 1. Botanica (Main Plant Discovery)
- **Path**: `/botanica`
- **Features**:
  - Smart plant search with debounced API calls
  - Image-based plant identification
  - Real-time search suggestions
  - Weather-based care recommendations
  - Unique plant results with scientific names and Hindi translations
  - Added default location fallback (New Delhi, India) when geolocation access is denied
  - Implemented toast notifications for location-related messages

### 2. Plant Search Results
- **Path**: `/botanica/search`
- **Features**:
  - Grid layout of plant cards
  - Image-only results display
  - Unique plant entries with proper casing
  - Type and scientific name display
  - Loading skeletons for better UX

### 3. Plant Details
- **Path**: `/botanica/plant/:id`
- **Features**:
  - Comprehensive plant information
  - Care instructions
  - Recent news section using Bing News API
  - Categorized video section using YouTube API
  - Dynamic loading states for different data sources

### 4. Plant Tracker
- **Path**: `/tracker`
- **Features**:
  - Personal plant collection management
  - Care schedule tracking
  - Growth progress monitoring

### 5. Profile
- **Path**: `/profile`
- **Features**:
  - User profile management
  - Plant collection overview
  - Achievement tracking

### 6. Settings
- **Path**: `/settings`
- **Features**:
  - Account settings
  - Notification preferences
  - Theme customization
  - Language settings

### 7. Authentication
- **Paths**: `/login`, `/signup`
- **Features**:
  - Email/password authentication
  - Google Sign-in
  - Protected routes
  - Onboarding flow

## UI/UX Design Principles
1. **Modern & Clean Interface**
   - Consistent spacing and typography
   - Responsive design for all screen sizes
   - Smooth transitions and animations

2. **User Experience**
   - Progressive loading with skeletons
   - Debounced search for performance
   - Clear error handling
   - Informative loading states

3. **Accessibility**
   - ARIA labels implementation
   - Keyboard navigation support
   - Color contrast compliance
   - Screen reader compatibility

## Data Integration
1. **Wikidata/Wikipedia**
   - Primary source for plant information
   - Scientific names and classifications
   - Basic plant descriptions

2. **OpenFarm**
   - Detailed growing information
   - Care guides
   - Growing requirements

3. **YouTube API**
   - Categorized plant videos
   - Care tutorials
   - Growing guides

4. **Bing News API**
   - Recent plant-related news
   - Research updates
   - Gardening trends

## Performance Optimizations
1. **Search**
   - Debounced API calls (100ms threshold)
   - Result caching
   - Unique result filtering

2. **Image Loading**
   - Lazy loading implementation
   - Progressive image loading
   - Optimized image formats

3. **API Calls**
   - Parallel data fetching
   - Request cancellation for outdated searches
   - Error boundary implementation

## Future Enhancements
1. Offline support with Service Workers
2. Push notifications for plant care reminders
3. Social features for plant enthusiasts
4. AI-powered plant disease detection
5. Integration with smart garden devices

## Versioning
- Current production version: 0.1.2
- Current development version: 0.1.7 (unreleased) 