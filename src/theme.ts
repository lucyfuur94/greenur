import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  colors: {
    brand: {
      50: '#e8f5e9',
      100: '#c8e6c9',
      200: '#a5d6a7',
      300: '#81c784',
      400: '#66bb6a',
      500: '#4caf50',  // Primary brand color
      600: '#43a047',
      700: '#388e3c',
      800: '#2e7d32',
      900: '#1b5e20',
    },
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
  },
  config: {
    initialColorMode: 'light',
    useSystemColorMode: true,
  },
  // Mobile-first responsive breakpoints
  breakpoints: {
    base: '0px',
    sm: '320px',
    md: '768px',
    lg: '960px',
    xl: '1200px',
    '2xl': '1536px',
  },
  components: {
    // Global component styles for mobile responsiveness
    Container: {
      baseStyle: {
        maxWidth: {
          base: '100%',
          md: '720px',
          lg: '960px',
          xl: '1200px',
        },
        px: { base: 4, md: 6 },
      },
    },
    Button: {
      baseStyle: {
        // Touch-friendly sizes
        minWidth: '44px',
        minHeight: '44px',
      },
      sizes: {
        // Responsive button sizes
        md: {
          h: { base: '48px', md: '40px' },
          fontSize: { base: 'sm', md: 'md' },
        },
      },
    },
    Text: {
      baseStyle: {
        // Responsive typography
        fontSize: { base: 'sm', md: 'md' },
      },
    },
    Heading: {
      baseStyle: {
        // Responsive heading sizes
        fontSize: {
          base: 'xl',
          md: '2xl',
          lg: '3xl',
        },
      },
    },
  },
})

export default theme