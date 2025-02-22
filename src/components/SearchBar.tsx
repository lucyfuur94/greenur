import { useState, useRef } from 'react';
import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  useColorModeValue,
} from '@chakra-ui/react';
import { FaCamera } from 'react-icons/fa';
import { useNavigate, NavigateFunction } from 'react-router-dom';

export interface SearchBarProps {
  /**
   * Initial value for the search input
   */
  initialValue?: string;
  /**
   * Whether the search bar should be focused on mount
   */
  autoFocus?: boolean;
  /**
   * Callback fired when user submits a search
   */
  onSearch: (query: string) => void;
  /**
   * Callback fired when user selects an image
   */
  onImageSelect?: (file: File) => void;
  /**
   * Whether the component is in a loading state
   */
  isLoading?: boolean;
  /**
   * Placeholder text for the search input
   */
  placeholder?: string;
  /**
   * Size of the search bar
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Shadow depth of the search bar
   */
  boxShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * Whether to hide the image upload button
   */
  hideImageUpload?: boolean;
  customNavigate?: NavigateFunction; // For Storybook testing
}

export const SearchBar = ({
  initialValue = '',
  autoFocus = false,
  onSearch,
  onImageSelect,
  isLoading = false,
  placeholder = 'Search plants by name..',
  size = 'lg',
  boxShadow = 'sm',
  hideImageUpload = false,
  customNavigate,
}: SearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = customNavigate || useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onSearch(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/botanica/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageSelect) {
      onImageSelect(file);
    }
  };

  // Size configurations
  const sizes = {
    sm: {
      height: "40px",
      fontSize: "sm",
      padding: "0 16px",
      iconSize: "20px",
      rightElementWidth: "32px",
    },
    md: {
      height: "56px",
      fontSize: "md",
      padding: "0 24px",
      iconSize: "20px",
      rightElementWidth: "48px",
    },
    lg: {
      height: "56px",
      fontSize: "md",
      padding: "0 24px",
      iconSize: "20px",
      rightElementWidth: "48px",
    },
  };

  const currentSize = sizes[size];

  return (
    <Box
      position="relative"
      width="100%"
      mx="auto"
    >
      <Box
        position="relative"
        width="100%"
        boxShadow={boxShadow}
        borderRadius="full"
        bg="white"
        _hover={{
          boxShadow: "md",
        }}
        transition="box-shadow 0.2s"
      >
        <InputGroup size={size} width="100%">
          <Input
            value={searchQuery}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            height={currentSize.height}
            fontSize={currentSize.fontSize}
            pl={currentSize.padding}
            pr={hideImageUpload ? currentSize.padding : `calc(${currentSize.rightElementWidth} + ${currentSize.padding})`}
            border="1px solid"
            borderColor="gray.200"
            _hover={{ borderColor: "gray.300" }}
            _focus={{
              borderColor: "gray.300",
              boxShadow: "none",
            }}
            _placeholder={{ color: "gray.400" }}
            bg="white"
            borderRadius="full"
            autoFocus={autoFocus}
            width="100%"
          />
          {!hideImageUpload && onImageSelect && (
            <InputRightElement 
              width={currentSize.rightElementWidth} 
              height={currentSize.height}
              right={2}
            >
              <IconButton
                aria-label="Upload plant image"
                icon={<FaCamera size={currentSize.iconSize} />}
                variant="ghost"
                height={`calc(${currentSize.height} - 16px)`}
                minWidth={`calc(${currentSize.rightElementWidth} - 8px)`}
                color="gray.400"
                _hover={{
                  bg: "transparent",
                  color: "gray.600",
                }}
                onClick={handleImageClick}
                isDisabled={isLoading}
              />
            </InputRightElement>
          )}
        </InputGroup>
      </Box>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
        disabled={isLoading}
      />
    </Box>
  );
}; 