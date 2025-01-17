import { Box, Flex, Link, useColorModeValue, Menu, MenuButton, MenuList, MenuItem, Avatar, Button, IconButton, Drawer, DrawerBody, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton, useDisclosure, HStack } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { auth } from '../../config/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { FaRobot } from 'react-icons/fa'

const Navigation = () => {
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
          <HStack spacing={8} flex={1}>
            <Link 
              as={RouterLink} 
              to="/" 
              fontWeight="bold" 
              fontSize="2xl" 
              color="brand.500"
              _hover={{ textDecoration: 'none' }}
            >
              Greenur
            </Link>

            <HStack spacing={4}>
              <Link
                as={RouterLink}
                to="/botanica"
                color={isActive('/botanica') ? 'brand.500' : undefined}
                fontWeight={isActive('/botanica') ? 'bold' : 'normal'}
                fontSize="md"
              >
                Botanica
              </Link>
              
              <Link
                as={RouterLink}
                to="/tracker"
                color={isActive('/tracker') ? 'brand.500' : undefined}
                fontWeight={isActive('/tracker') ? 'bold' : 'normal'}
                fontSize="md"
              >
                Tracker
              </Link>

              <Link
                as={RouterLink}
                to="/connect"
                color={isActive('/connect') ? 'brand.500' : undefined}
                fontWeight={isActive('/connect') ? 'bold' : 'normal'}
                fontSize="md"
              >
                Connect
              </Link>

              <Link
                as={RouterLink}
                to="/marketplace"
                color={isActive('/marketplace') ? 'brand.500' : undefined}
                fontWeight={isActive('/marketplace') ? 'bold' : 'normal'}
                fontSize="md"
              >
                Marketplace
              </Link>
            </HStack>
          </HStack>
          
          {currentUser && (
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
          )}
        </Flex>
      </Box>
    </Box>
  )
}

const Assistant = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <IconButton
        aria-label="Open AI Assistant"
        icon={<FaRobot size="20" />}
        position="fixed"
        bottom="4"
        right="4"
        size="lg"
        colorScheme="brand"
        rounded="full"
        shadow="lg"
        onClick={onOpen}
      />
      <Drawer
        isOpen={isOpen}
        placement="right"
        onClose={onClose}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">Plant Care Assistant</DrawerHeader>
          <DrawerBody>
            {/* Assistant content will go here */}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}

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