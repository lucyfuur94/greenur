# Greenur - Plant Care & Discovery Platform

## Overview
Greenur is a modern web application designed to help users discover, learn about, and care for plants. The platform combines data from multiple sources including WikiData, Wikipedia, OpenFarm, and various other APIs to provide comprehensive plant information.

## Tech Stack
- **Frontend Framework**: React with TypeScript
- **UI Library**: Chakra UI
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **State Management**: React Context API
- **Routing**: React Router v6
- **API Integration**: WikiData, Wikipedia, OpenFarm, YouTube API, Bing News API
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

### 2. Plant Search Results
- **Path**: `/botanica/search`
- **Features**:
  - Grid layout of plant cards
  - Image-only results
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
  - Email/Password authentication
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
   - ARIA labels
   - Keyboard navigation
   - Color contrast compliance
   - Screen reader support

## Data Integration
1. **WikiData/Wikipedia**
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
   - Lazy loading
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