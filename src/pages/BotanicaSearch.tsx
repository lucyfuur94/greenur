import {
  Box,
  Container,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  Text,
  Grid,
  GridItem,
  Button,
  Image,
  useToast,
  Heading,
  Card,
  CardBody,
  Skeleton,
  HStack,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchPlants } from '../services/wikiService'
import { FaSearch, FaExclamationTriangle } from 'react-icons/fa'

interface SearchResult {
  id: string
  name: string
  type: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  image?: string
}

export const BotanicaSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (searchQuery) {
      performSearch()
    }
  }, [searchQuery])

  const performSearch = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const searchResults = await searchPlants(searchQuery)
      setResults(searchResults.map(r => ({
        id: r.wikiDataId,
        name: r.name,
        type: r.type,
        difficulty: 'medium',
        tags: [],
        image: r.image
      })))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search plants'
      console.error('Error searching plants:', error)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery })
      performSearch()
    }
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Search Bar */}
        <Box>
          <form onSubmit={handleSearch}>
            <InputGroup size="lg">
              <Input
                placeholder="Search plants by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                isDisabled={isLoading}
              />
              <InputRightElement width="4.5rem">
                <Button
                  h="1.75rem"
                  size="sm"
                  type="submit"
                  isLoading={isLoading}
                >
                  <FaSearch />
                </Button>
              </InputRightElement>
            </InputGroup>
          </form>
        </Box>

        {/* Error Message */}
        {error && (
          <Box
            p={4}
            bg="red.50"
            color="red.600"
            borderRadius="md"
            display="flex"
            alignItems="center"
            gap={2}
          >
            <FaExclamationTriangle />
            <Text>{error}</Text>
          </Box>
        )}

        {/* Search Results */}
        {isLoading ? (
          <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={6}>
            {[...Array(6)].map((_, i) => (
              <GridItem key={i}>
                <Card>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Skeleton height="200px" />
                      <Skeleton height="24px" width="70%" />
                      <Skeleton height="20px" width="40%" />
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>
            ))}
          </Grid>
        ) : results.length > 0 ? (
          <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={6}>
            {results.map((result) => (
              <GridItem key={result.id}>
                <Card
                  cursor="pointer"
                  onClick={() => navigate(`/botanica/plant/${result.id}`)}
                  sx={{
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 'md'
                    },
                    transition: 'all 0.2s'
                  }}
                >
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Box
                        height="200px"
                        bg="gray.100"
                        borderRadius="md"
                        overflow="hidden"
                      >
                        {result.image ? (
                          <Image
                            src={result.image}
                            alt={result.name}
                            objectFit="cover"
                            width="100%"
                            height="100%"
                          />
                        ) : (
                          <Box
                            width="100%"
                            height="100%"
                            bg="gray.100"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Text color="gray.500">No image available</Text>
                          </Box>
                        )}
                      </Box>
                      <Heading size="md">{result.name}</Heading>
                      <HStack spacing={2}>
                        <Text color="gray.600">Type: {result.type}</Text>
                        <Text color="gray.600">•</Text>
                        <Text color="gray.600">Difficulty: {result.difficulty}</Text>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>
            ))}
          </Grid>
        ) : searchQuery && !isLoading && (
          <Box textAlign="center" py={10}>
            <Text fontSize="lg" color="gray.600">
              No plants found matching "{searchQuery}"
            </Text>
          </Box>
        )}
      </VStack>
    </Container>
  )
} 