# Greenur Web App

A modern web application for plant care and management, built with React, TypeScript, and Tailwind CSS.

## Features

- Plant health monitoring
- Daily care tasks
- Plant identification
- Care recommendations
- Weather integration
- AI-powered assistance

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Radix UI
- Vite
- Netlify Functions

## Getting Started

### Prerequisites

- Node.js 18.17.1 or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/greenur-webapp.git
cd greenur-webapp
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Project Structure

```
greenur-webapp/
├── src/
│   ├── components/
│   │   └── ui/         # UI components
│   ├── lib/            # Utility functions
│   ├── App.tsx         # Main application component
│   └── main.tsx        # Application entry point
├── public/             # Static assets
├── netlify/            # Netlify functions
│   ├── functions/      # Serverless functions
│   └── edge-functions/ # Edge functions
└── package.json        # Project dependencies
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## MongoDB Integration

This application uses MongoDB for data storage while Firebase is only used for authentication. Here's how data management is handled:

### User Preferences

User preferences collected during onboarding are stored in MongoDB via Netlify serverless functions:

1. The `update-user-preferences` function is used to:
   - GET user preferences data from MongoDB
   - POST updates to user preferences

2. Data Flow:
   - User authentication is handled by Firebase Auth
   - User data is stored in MongoDB
   - The UI components interact with MongoDB through Netlify functions

### Service Layer

The application uses a service layer pattern to abstract database operations:

- Services are located in `src/lib/services/`
- Each service provides methods for data operations (fetch, update, etc.)
- Services handle data transformation between UI and database formats
