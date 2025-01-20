import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  VStack,
  Text,
  Input,
  Button,
  Image,
  Spinner,
  Flex,
  Badge,
  useBreakpointValue,
  useToast
} from '@chakra-ui/react'
import { FaCamera, FaSearch } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'

export const Botanica: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const toast = useToast()

  // Responsive grid columns
  const gridColumns = useBreakpointValue({ 
    base: 2, 
    md: 3, 
    lg: 4 
  })

  // Search handler with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    if (searchQuery.trim()) {
      setIsLoading(true)
      timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(
            `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(searchQuery.trim())}&per_page=20&iconic_taxa=Plantae`
          )
          
          if (!response.ok) {
            throw new Error('Failed to search plants')
          }

          const data = await response.json()
          setSuggestions(data.results.slice(0, 10))
        } catch (error) {
          toast({
            title: 'Search Error',
            description: 'Unable to fetch plant suggestions',
            status: 'error',
            duration: 3000,
            isClosable: true
          })
        } finally {
          setIsLoading(false)
        }
      }, 500)
    } else {
      setSuggestions([])
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [searchQuery, toast])

  // Image upload handler
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Implement image upload logic
      toast({
        title: 'Image Upload',
        description: 'Image upload feature coming soon!',
        status: 'info',
        duration: 3000,
        isClosable: true
      })
    }
  }

  return (
    <Box 
      width="100%" 
      maxWidth="600px" 
      margin="0 auto" 
      padding="16px"
      transform="translateY(-20px)"
    >
      {/* Hero Section */}
      <VStack 
        spacing={3} 
        width="100%" 
        marginBottom={4}
        textAlign="center"
      >
        <Image 
          src="/plant-hero.svg" 
          alt="Plant Discovery" 
          maxHeight="180px" 
          objectFit="contain" 
          mb={2}
        />
        <Text 
          fontSize={["lg", "xl"]} 
          fontWeight="bold" 
          color="green.600"
          lineHeight="shorter"
        >
          Discover Your Green World
        </Text>
      </VStack>

      {/* Search Section */}
      <Flex 
        width="100%" 
        marginBottom={4}
        position="relative"
      >
        <Input 
          placeholder="Search plants..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          width="100%"
          paddingRight="50px"
          borderColor="green.300"
          height="44px"
          _focus={{ 
            borderColor: "green.500", 
            boxShadow: "0 0 0 1px green.500" 
          }}
        />
        <Button 
          position="absolute" 
          right="0" 
          top="0" 
          height="100%" 
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          <FaCamera />
        </Button>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />
      </Flex>

      {/* Suggestions Section */}
      {isLoading ? (
        <Flex justify="center" width="100%">
          <Spinner color="green.500" />
        </Flex>
      ) : (
        <Box 
          display="grid" 
          gridTemplateColumns={`repeat(${gridColumns}, 1fr)`}
          gap={3}
        >
          {suggestions.map((plant) => (
            <Box 
              key={plant.id}
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              cursor="pointer"
              transition="all 0.2s"
              _hover={{ 
                transform: "scale(1.05)", 
                boxShadow: "md" 
              }}
              onClick={() => navigate(`/botanica/plant/${plant.id}`)}
            >
              <Image 
                src={plant.default_photo?.medium_url || '/default-plant.png'} 
                alt={plant.name} 
                height="130px" 
                width="100%" 
                objectFit="cover" 
              />
              <Box p={2}>
                <Text 
                  fontWeight="bold" 
                  fontSize="xs" 
                  noOfLines={1}
                >
                  {plant.name}
                </Text>
                <Text 
                  fontSize="2xs" 
                  color="gray.500" 
                  noOfLines={1}
                >
                  {plant.rank}
                </Text>
                {plant.iconic_taxon_name && (
                  <Badge 
                    colorScheme="green" 
                    size="xs" 
                    mt={1}
                  >
                    {plant.iconic_taxon_name}
                  </Badge>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}