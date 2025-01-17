import { Box, Flex, Image, Link as ChakraLink, useBreakpointValue } from '@chakra-ui/react'
import { Link, useLocation } from 'react-router-dom'
import { FaLeaf, FaChartLine, FaCog, FaUser } from 'react-icons/fa'

export const Navigation = () => {
  const location = useLocation()
  const isMobile = useBreakpointValue({ base: true, md: false })

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/botanica', label: 'Botanica', icon: FaLeaf },
    { path: '/tracker', label: 'Tracker', icon: FaChartLine },
    { path: '/profile', label: 'Profile', icon: FaUser },
    { path: '/settings', label: 'Settings', icon: FaCog },
  ]

  return (
    <>
      <Box className="header">
        <Flex className="nav-container">
          <ChakraLink as={Link} to="/">
            <Image
              src="/logo.svg"
              alt="Greenur Logo"
              className="logo"
            />
          </ChakraLink>
          
          {!isMobile && (
            <Flex className="nav-links">
              {navItems.map(({ path, label }) => (
                <ChakraLink
                  key={path}
                  as={Link}
                  to={path}
                  className={`nav-link ${isActive(path) ? 'active' : ''}`}
                >
                  {label}
                </ChakraLink>
              ))}
            </Flex>
          )}
        </Flex>
      </Box>

      {isMobile && (
        <nav className="bottom-nav">
          {navItems.map(({ path, label, icon: Icon }) => (
            <ChakraLink
              key={path}
              as={Link}
              to={path}
              className={`bottom-nav-item ${isActive(path) ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </ChakraLink>
          ))}
        </nav>
      )}
    </>
  )
}
