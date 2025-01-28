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
      50: '#E6F6EC',
      100: '#C3E9D0',
      200: '#9FDBB3',
      300: '#7BCD96',
      400: '#57C079',
      500: '#33B25C',
      600: '#298E4A',
      700: '#1F6B37',
      800: '#154725',
      900: '#0B2412',
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
      defaultProps: {
        colorScheme: 'brand',
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