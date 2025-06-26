import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft,
  Search,
  X,
  Clock
} from "lucide-react";

interface PlantSearchResult {
  id: string;
  name: string;
  type: string;
  scientificName: string;
  image: string;
  displayName: string;
  matchedTerm: string;
}

interface SearchOverlayProps {
  onClose: () => void;
  onSelectPlant?: (plant: PlantSearchResult) => void;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ onClose, onSelectPlant }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlantSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('recentPlantSearches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure we only save valid string entries
        if (Array.isArray(parsed)) {
          const validSearches = parsed.filter(item => typeof item === 'string' && item.trim());
          setRecentSearches(validSearches);
        }
      } catch (error) {
        console.error('Error loading recent searches:', error);
        // Clear corrupted data
        localStorage.removeItem('recentPlantSearches');
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = (query: string) => {
    if (!query || typeof query !== 'string' || !query.trim()) return;
    
    const updated = [query, ...recentSearches.filter(q => q && q !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentPlantSearches', JSON.stringify(updated));
  };

  // Search function for plants
  const searchPlants = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await fetch(`/.netlify/functions/search-plants?q=${encodeURIComponent(query)}&limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to search plants');
      }
      
      const data = await response.json();
      
      // Validate search results structure
      const validResults = Array.isArray(data.results) 
        ? data.results.filter((plant: any) => 
            plant && 
            typeof plant === 'object' && 
            typeof plant.id === 'string'
          )
        : [];
      
      setSearchResults(validResults);
      
      // Save successful search to recent searches
      saveRecentSearch(query);
    } catch (error) {
      console.error('Error searching plants:', error);
      toast({
        title: "Search Error",
        description: "Failed to search plants. Please try again.",
        variant: "destructive",
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input change with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        searchPlants(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Handle recent search click
  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentPlantSearches');
  };

  // Handle plant selection
  const handlePlantSelect = (plant: PlantSearchResult) => {
    if (onSelectPlant) {
      onSelectPlant(plant);
      onClose();
    } else {
      // Navigate to plant details page using plant ID
      // Don't pass state data to ensure fresh fetch from MongoDB
      navigate(`/plant/${plant.id}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-[100] flex flex-col">
      {/* Header with Back Button and Search */}
      <div className="flex items-center p-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="mr-3 p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="relative flex-1">
          <Input
            className="pl-10 pr-10 py-3 w-full bg-muted border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base text-foreground"
            placeholder="Search plants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              WebkitAppearance: "none",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            }}
          />
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            {isSearching ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-transparent"></div>
            ) : (
              <Search className="w-4 h-4" />
            )}
          </span>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {/* Recent Searches - Show when no search query */}
          {!searchQuery && recentSearches.length > 0 && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-foreground flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Recent Searches
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentSearches}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear All
                </Button>
              </div>
              <div className="space-y-2">
                {recentSearches.filter(q => q && typeof q === 'string').map((query, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
                    onClick={() => handleRecentSearchClick(query)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">{String(query || '')}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = recentSearches.filter((_, i) => i !== index);
                          setRecentSearches(updated);
                          localStorage.setItem('recentPlantSearches', JSON.stringify(updated));
                        }}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <div className="p-4">
              {searchResults.length > 0 ? (
                <>
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    Search Results ({searchResults.length})
                  </h3>
                  <div className="space-y-3">
                    {searchResults.map((plant) => (
                      <Card
                        key={plant.id}
                        className="p-4 cursor-pointer hover:shadow-md transition-shadow bg-card border border-border"
                        onClick={() => handlePlantSelect(plant)}
                      >
                        <div className="flex flex-col">
                          <h4 className="font-medium text-card-foreground text-base mb-2">
                            {plant.name || 'Unknown Plant'}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm text-muted-foreground italic">
                              {plant.scientificName || 'No scientific name'}
                            </p>
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-none">
                              {plant.type || 'Unknown'}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              ) : !isSearching ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-lg">No plants found for "{searchQuery}"</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Searching plants...</p>
                </div>
              )}
            </div>
          )}

          {/* Empty State - Show when no query and no recent searches */}
          {!searchQuery && recentSearches.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Search className="w-16 h-16 mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-medium mb-2">Search for Plants</h3>
              <p className="text-center max-w-sm">
                Find plants by name or type. Your recent searches will appear here.
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default SearchOverlay; 