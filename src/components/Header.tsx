import { Box, Container, HStack, Link, Text } from '@chakra-ui/react'
import { Link as RouterLink, useLocation } from 'react-router-dom'

export const Header = () => {
  const location = useLocation();
  const isBotanicaActive = location.pathname.startsWith('/botanica');

  return (
    <Box bg="white" borderBottom="1px" borderColor="gray.200" py={4}>
      <Container maxW="container.xl">
        <HStack spacing={8} justify="space-between">
          <RouterLink to="/">
            <Text fontSize="2xl" fontWeight="bold" color="green.500">
              Greenur
            </Text>
          </RouterLink>
          <HStack spacing={8}>
            <Link
              as={RouterLink}
              to="/botanica"
              color={isBotanicaActive ? "green.500" : "gray.600"}
              fontWeight={isBotanicaActive ? "semibold" : "normal"}
              _hover={{ color: "green.600" }}
            >
              Botanica
            </Link>
            <Link as={RouterLink} to="/tracker" color="gray.600" _hover={{ color: "green.600" }}>
              Tracker
            </Link>
            <Link as={RouterLink} to="/connect" color="gray.600" _hover={{ color: "green.600" }}>
              Connect
            </Link>
            <Link as={RouterLink} to="/marketplace" color="gray.600" _hover={{ color: "green.600" }}>
              Marketplace
            </Link>
          </HStack>
        </HStack>
      </Container>
    </Box>
  )
} 