import { Box } from '@chakra-ui/react'
import { Navigation } from '../Navigation'
import { Assistant } from '../Assistant'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <Box>
      <Navigation />
      <Box pt={16}>
        {children}
      </Box>
      <Assistant />
    </Box>
  )
} 