# Greenur - Your Personal Plant Care Assistant

Greenur is a web application that helps you track and manage your plants' growth, find plant care essentials in the marketplace, and get AI-powered assistance for plant care.

## Features

- 🌱 Plant Growth Tracker
- 🛍️ Marketplace for Plant Essentials
- 🤖 AI-powered Plant Care Assistant
- 📸 Image-based Plant Growth Analysis
- 📅 Care Schedule & Reminders

## Tech Stack

- React with TypeScript
- Vite for build tooling
- Firebase (Authentication, Firestore, Storage)
- Chakra UI for components
- React Router for navigation
- Storybook for UI development

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/greenur.git
   cd greenur
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Firebase:
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication with Google sign-in
   - Enable Firestore Database
   - Enable Storage
   - Copy your Firebase config values

4. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase configuration values

5. Start the development server:
   ```bash
   npm run dev
   ```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run storybook` - Start Storybook
- `npm run build-storybook` - Build static Storybook

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Mobile Compatibility

### Responsive Design
- Implemented mobile-first CSS media queries
- Touch-friendly interactive elements
- Responsive typography and layout
- Optimized for screens from 320px to 768px

### Performance Optimization
- Reduced asset sizes for mobile networks
- Implemented lazy loading
- Minimized render-blocking resources

### Testing
- Tested on major mobile browsers (Chrome, Safari, Firefox)
- Responsive across device sizes (iPhone, Android, tablets)

### Deployment
- Netlify configuration optimized for mobile performance
- Strict security headers implemented
- Caching strategies for faster mobile loading

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## UI Development with Storybook

We use Storybook for UI development and documentation. All UI components must have corresponding stories.

### Guidelines

1. **Component Development**
   - Create component in appropriate directory
   - Add TypeScript types and documentation
   - Create story file in `src/stories`
   - Test all states and variations

2. **Story Requirements**
   - Document all props and variants
   - Include examples of different states
   - Test responsive behavior
   - Add to component categories

3. **Categories**
   - Pages (Botanica, Search, Plant Details, etc.)
   - Components (Navigation, Assistant, etc.)
   - Auth Components
   - Layout Components

4. **Testing**
   - Use Storybook Controls
   - Test responsive design
   - Verify interactions
   - Check accessibility

### Running Storybook

1. Start Storybook server:
   ```bash
   npm run storybook
   ```

2. Open browser at `http://localhost:6006`

3. Navigate components:
   - Use sidebar for navigation
   - Controls panel for props
   - Docs tab for documentation
   - Canvas for testing

## Project Structure

```
src/
├── components/     # Reusable components
├── pages/         # Page components
├── stories/       # Storybook stories
├── theme/         # Theme configuration
├── contexts/      # React contexts
├── services/      # API services
└── config/        # Configuration files
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production version
- `npm run storybook` - Start Storybook
- `npm run build-storybook` - Build static Storybook
- `npm run test` - Run tests
- `npm run lint` - Run linter
