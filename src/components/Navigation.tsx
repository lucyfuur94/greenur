import { Box, Flex, Link, useColorModeValue, Menu, MenuButton, MenuList, MenuItem, Avatar, Button, HStack } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

export const Navigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const bg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const isActive = (path: string) => {
    if (path === '/botanica') {
      return location.pathname.startsWith('/botanica')
    }
    return location.pathname === path
  }

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <Box bg={bg} borderBottom="1px" borderColor={borderColor} position="fixed" w="100%" zIndex={1}>
      <Box maxW="60%" mx="auto">
        <Flex h={16} alignItems="center" justifyContent="space-between">
          <HStack spacing={8} flex={1} alignItems="center">
            <Link 
              as={RouterLink} 
              to="/" 
              fontWeight="bold" 
              fontSize="2xl" 
              color="brand.500"
              _hover={{ textDecoration: 'none' }}
              display="flex"
              alignItems="center"
              height="100%"
            >
              Greenur
            </Link>

            <HStack spacing={4} height="100%" alignItems="center">
              {[
                { path: '/botanica', label: 'Botanica' },
                { path: '/tracker', label: 'Tracker' },
                { path: '/connect', label: 'Connect' },
                { path: '/marketplace', label: 'Marketplace' },
              ].map(({ path, label }) => (
                <Link
                  key={path}
                  as={RouterLink}
                  to={path}
                  color={isActive(path) ? 'brand.500' : undefined}
                  fontWeight={isActive(path) ? 'bold' : 'normal'}
                  fontSize="md"
                  display="flex"
                  alignItems="center"
                  height="100%"
                  _hover={{
                    color: 'brand.500',
                    textDecoration: 'none',
                  }}
                >
                  {label}
                </Link>
              ))}
            </HStack>
          </HStack>
          
          {currentUser ? (
            <Menu>
              <MenuButton
                as={Button}
                rounded="full"
                variant="link"
                cursor="pointer"
                minW={10}
              >
                <Avatar 
                  size="sm" 
                  src={currentUser.photoURL || undefined}
                  name={currentUser.displayName || undefined}
                  bg="brand.500"
                  color="white"
                />
              </MenuButton>
              <MenuList>
                <MenuItem as={RouterLink} to="/profile">Profile</MenuItem>
                <MenuItem as={RouterLink} to="/settings">Settings</MenuItem>
                <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <HStack spacing={4}>
              <Button as={RouterLink} to="/login" variant="ghost">
                Login
              </Button>
              <Button as={RouterLink} to="/signup">
                Sign Up
              </Button>
            </HStack>
          )}
        </Flex>
      </Box>
    </Box>
  )
}
