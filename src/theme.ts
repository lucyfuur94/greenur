import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: true,
  },
  styles: {
    global: {
      // Global mobile-first styles
      html: {
        fontSize: { base: '14px', md: '16px' },
        overflowX: 'hidden',
      },
      body: {
        minHeight: '100vh',
        overflowX: 'hidden',
        WebkitTextSizeAdjust: '100%', // Prevent font scaling in landscape mode
      },
    },
  },
  breakpoints: {
    base: '0px',
    sm: '320px',
    md: '768px',
    lg: '960px',
    xl: '1200px',
    '2xl': '1536px',
  },
  colors: {
    brand: {
      50: '#e8f5e9',
      100: '#c8e6c9',
      200: '#a5d6a7',
      300: '#81c784',
      400: '#66bb6a',
      500: '#4caf50',
      600: '#43a047',
      700: '#388e3c',
      800: '#2e7d32',
      900: '#1b5e20',
    },
  },
  fonts: {
    heading: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    body: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  components: {
    Container: {
      baseStyle: {
        maxWidth: { 
          base: '100%', 
          md: 'container.xl' 
        },
        px: { base: 2, md: 6 },
        centerContent: true,
      },
    },
    Button: {
      baseStyle: {
        minWidth: '44px',
        minHeight: '44px',
        borderRadius: 'md',
      },
      sizes: {
        md: {
          h: { base: '48px', md: '40px' },
          fontSize: { base: 'sm', md: 'md' },
          px: { base: 3, md: 4 },
        },
      },
    },
    Input: {
      baseStyle: {
        field: {
          height: { base: '48px', md: 'auto' },
          fontSize: { base: 'sm', md: 'md' },
          px: { base: 3, md: 4 },
        },
      },
    },
    Text: {
      baseStyle: {
        fontSize: { base: 'sm', md: 'md' },
      },
    },
    Heading: {
      baseStyle: {
        fontSize: {
          base: 'xl',
          md: '2xl',
          lg: '3xl',
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          width: '100%',
          borderRadius: 'md',
          overflow: 'hidden',
        },
      },
      sizes: {
        md: {
          container: {
            p: { base: 2, md: 4 },
          },
        },
      },
    },
    Grid: {
      baseStyle: {
        width: '100%',
        gap: { base: 2, md: 4 },
      },
    },
  },
})

export default theme