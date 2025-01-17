# Instructions for Cursor Agent

## Code Style & Standards

1. **TypeScript Usage**
   - Always use TypeScript for type safety
   - Maintain proper interfaces for all data structures
   - Use proper type annotations for function parameters and returns

2. **Component Structure**
   - Follow functional component pattern
   - Use hooks for state management
   - Implement proper error boundaries
   - Break down complex components into smaller, reusable ones

3. **API Integration**
   - Implement proper error handling for all API calls
   - Use AbortController for cancellable requests
   - Implement request debouncing where appropriate
   - Cache API responses when possible

4. **Performance Considerations**
   - Implement proper loading states
   - Use React.memo for expensive renders
   - Implement proper cleanup in useEffect hooks
   - Use proper image optimization techniques

## Specific Guidelines

1. **Search Implementation**
   ```typescript
   // Example of proper debounced search
   useEffect(() => {
     const delayDebounceFn = setTimeout(() => {
       if (searchQuery.trim()) {
         handleSearch();
       }
     }, 100);
     return () => clearTimeout(delayDebounceFn);
   }, [searchQuery]);
   ```

2. **Loading States**
   ```typescript
   // Example of proper loading state implementation
   {isLoading ? (
     <LoadingSkeleton />
   ) : error ? (
     <ErrorMessage error={error} />
   ) : (
     <ActualContent data={data} />
   )}
   ```

3. **API Error Handling**
   ```typescript
   try {
     const response = await api.call();
     handleSuccess(response);
   } catch (error) {
     handleError(error);
     showToast({
       title: 'Error',
       description: getErrorMessage(error),
       status: 'error'
     });
   }
   ```

## File Organization

1. **Component Files**
   - Place in appropriate feature directories

   - Include related types and hooks
   - Export as named exports

2. **Service Files**
   - Separate API calls into service files
   - Implement proper typing for API responses
   - Include proper error handling

3. **Utility Files**
   - Create shared utilities in utils directory
   - Document complex utility functions
   - Make utilities type-safe

## Testing Guidelines

1. **Component Tests**
   - Test component rendering
   - Test user interactions
   - Test error states
   - Test loading states

2. **Integration Tests**
   - Test API integration
   - Test routing
   - Test state management

## Documentation

1. **Code Comments**
   - Document complex logic
   - Explain non-obvious implementations
   - Include examples for reusable components

2. **Type Documentation**
   - Document complex types
   - Include examples where necessary
   - Document API response types

## Accessibility

1. **ARIA Labels**
   - Include proper aria-labels
   - Implement proper keyboard navigation
   - Follow WCAG guidelines

2. **Color Contrast**
   - Maintain proper color contrast
   - Test with screen readers
   - Implement proper focus states

## Error Handling

1. **User Errors**
   - Show clear error messages
   - Provide recovery options
   - Log errors appropriately

2. **API Errors**
   - Handle network errors
   - Handle validation errors
   - Implement proper fallbacks

## State Management

1. **Local State**
   - Use useState for component state
   - Use useReducer for complex state
   - Implement proper state updates

2. **Global State**
   - Use Context API appropriately
   - Implement proper state updates
   - Handle loading and error states

## Performance

1. **Code Splitting**
   - Implement lazy loading
   - Use proper chunking
   - Optimize bundle size

2. **Rendering**
   - Avoid unnecessary renders
   - Use proper memoization
   - Implement virtual scrolling for large lists

## Security

1. **Authentication**
   - Implement proper token handling
   - Secure sensitive routes
   - Handle session expiry

2. **Data Handling**
   - Sanitize user input
   - Implement proper validation
   - Handle sensitive data appropriately

## Deployment

1. **Git Workflow**
   ```bash
   # Before making changes
   git pull origin main

   # After making changes
   git add .
   git commit -m "descriptive commit message"
   git push origin main
   ```

2. **Netlify Deployment**
   - All pushes to main branch trigger automatic deployment
   - Environment variables must be configured in Netlify:
     - `YOUTUBE_API_KEY`
     - `FIREBASE_CONFIG`

3. **Environment Setup**
   - Create `.env` file for local development
   - Add all required API keys
   - Never commit `.env` file

4. **Build Process**
   ```bash
   # Local build test
   npm run build

   # Serve locally
   npm run preview
   ```

5. **Deployment Checks**
   - Run build locally before pushing
   - Check for linting errors
   - Verify all API keys are configured
   - Test Netlify functions locally using Netlify CLI

6. **Monitoring**
   - Check Netlify deploy logs
   - Monitor function execution in Netlify dashboard
   - Set up alerts for build failures 

⚠️ IMPORTANT: When modifying environment files (.env, .env.local), always preserve existing API keys and configurations. Never remove or overwrite existing keys when adding new ones. 