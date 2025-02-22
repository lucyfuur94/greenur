import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Image,
  Text,
  Box,
  Badge,
  Spinner,
  Center,
  Button,
  Input,
  HStack,
  useToast,
  FormControl,
  FormLabel,
  FormErrorMessage,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  IconButton,
  Tooltip,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Checkbox,
  Editable,
  EditableInput,
  EditablePreview,
  useEditableControls,
  ButtonGroup,
} from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { FaPlus, FaFileUpload, FaDownload, FaTrash, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { SearchBar } from '../SearchBar';

interface Plant {
  _id: number;
  common_name: string;
  scientific_name: string;
  plant_type: string;
  default_image_url: string;
  names_in_languages: Record<string, string>;
  last_updated: string;
}

interface BulkUploadResult {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  success: Plant[];
  failed: Array<{ name: string; error: string }>;
  duplicates: string[];
}

interface EditableFieldProps {
  value: string;
  onChange: (newValue: string) => void;
  isDisabled?: boolean;
  isEditing?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onChange, isDisabled, isEditing }) => {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      isDisabled={!isEditing || isDisabled}
      size="sm"
      variant={isEditing ? "outline" : "unstyled"}
      _disabled={{ opacity: 1, cursor: "default" }}
    />
  );
};

export const PlantCatalog = () => {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [filteredPlants, setFilteredPlants] = useState<Plant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlantName, setNewPlantName] = useState('');
  const [isAddingPlant, setIsAddingPlant] = useState(false);
  const [inputError, setInputError] = useState('');
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState<Plant | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [selectedPlants, setSelectedPlants] = useState<Set<number>>(new Set());
  const [isMultiDeleteOpen, setIsMultiDeleteOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [editingPlantId, setEditingPlantId] = useState<number | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Plant>>({});

  const fetchPlants = async () => {
    try {
      const response = await fetch('/.netlify/functions/get-plant-basics');
      if (!response.ok) {
        throw new Error('Failed to fetch plants');
      }
      const data = await response.json();
      // Sort by last_updated in descending order
      const sortedData = data.sort((a: Plant, b: Plant) => 
        new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
      );
      setPlants(sortedData);
      setFilteredPlants(sortedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  // Filter plants based on search query
  useEffect(() => {
    const filtered = plants.filter(plant => 
      plant.common_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plant.scientific_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plant.plant_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plant.names_in_languages?.hi || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredPlants(filtered);
    setCurrentPage(1); // Reset to first page when search changes
  }, [searchQuery, plants]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPlants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPlants = filteredPlants.slice(startIndex, endIndex);

  const handleAddPlant = async () => {
    if (!newPlantName.trim()) {
      setInputError('Plant name is required');
      return;
    }

    setIsAddingPlant(true);
    setInputError('');

    try {
      const response = await fetch('/.netlify/functions/add-plant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plantName: newPlantName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add plant');
      }

      await fetchPlants();
      setNewPlantName('');
      toast({
        title: 'Success',
        description: `${newPlantName} has been added to the catalog`,
        status: 'success',
        duration: 5000,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add plant';
      setInputError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsAddingPlant(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: 'Error',
        description: 'Please upload a CSV file',
        status: 'error',
        duration: 5000,
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      // Read file content
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      
      // Skip header row and process remaining lines
      const plantNames = lines
        .slice(1) // Skip the first row (header)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (plantNames.length === 0) {
        throw new Error('No plant names found in the CSV file');
      }

      // Send to API
      const response = await fetch('/.netlify/functions/bulk-add-plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plantNames }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process plants');
      }

      setUploadResult(data.results);
      await fetchPlants();

      toast({
        title: 'Upload Complete',
        description: `Successfully added ${data.results.successCount} plants`,
        status: 'success',
        duration: 5000,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload plants';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    const template = 'Plant Name\nRose\nTulip\nLily';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plant_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteClick = (plant: Plant, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event
    setPlantToDelete(plant);
  };

  const handleDeleteConfirm = async () => {
    if (!plantToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/.netlify/functions/delete-plant?id=${plantToDelete._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete plant');
      }

      await fetchPlants();
      toast({
        title: 'Success',
        description: `${plantToDelete.common_name} has been deleted from the catalog`,
        status: 'success',
        duration: 5000,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete plant';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
      setPlantToDelete(null);
    }
  };

  // Add select/deselect functions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPlants(new Set(currentPlants.map(plant => plant._id)));
    } else {
      setSelectedPlants(new Set());
    }
  };

  const handleSelectPlant = (plantId: number, checked: boolean) => {
    const newSelected = new Set(selectedPlants);
    if (checked) {
      newSelected.add(plantId);
    } else {
      newSelected.delete(plantId);
    }
    setSelectedPlants(newSelected);
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedPlants).map(id =>
        fetch(`/.netlify/functions/delete-plant?id=${id}`, {
          method: 'DELETE',
        })
      );

      await Promise.all(deletePromises);
      await fetchPlants();
      
      toast({
        title: 'Success',
        description: `${selectedPlants.size} plants have been deleted from the catalog`,
        status: 'success',
        duration: 5000,
      });
      
      setSelectedPlants(new Set());
      setIsMultiDeleteOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete plants';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (plant: Plant) => {
    if (editingPlantId === plant._id) {
      // Already editing this plant - do nothing
      return;
    }
    setEditingPlantId(plant._id);
    setEditedValues({
      scientific_name: plant.scientific_name,
      plant_type: plant.plant_type,
      names_in_languages: { ...plant.names_in_languages }
    });
  };

  const handleCancelEdit = () => {
    setEditingPlantId(null);
    setEditedValues({});
  };

  const handleApplyEdit = async (plantId: number) => {
    if (!editedValues) return;

    try {
      // Log the request details for debugging
      console.log('Updating plant:', {
        id: plantId,
        updates: editedValues
      });

      const response = await fetch(`/.netlify/functions/update-plant?id=${plantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scientific_name: editedValues.scientific_name,
          plant_type: editedValues.plant_type,
          names_in_languages: editedValues.names_in_languages
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update plant');
      }

      console.log('Update response:', data);

      await fetchPlants(); // Refresh the plant list
      setEditingPlantId(null); // Exit edit mode
      setEditedValues({}); // Clear edited values
      
      toast({
        title: 'Success',
        description: 'Plant updated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (err) {
      console.error('Error updating plant:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update plant',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'hindi_name') {
      setEditedValues(prev => ({
        ...prev,
        names_in_languages: { ...(prev.names_in_languages || {}), hi: value }
      }));
    } else {
      setEditedValues(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  if (isLoading) {
    return (
      <Center p={4}>
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center p={4}>
        <Text color="red.500">{error}</Text>
      </Center>
    );
  }

  return (
    <Box>
      {/* Add Plant Form */}
      <Box mb={6} p={4} borderWidth="1px" borderRadius="lg">
        <VStack spacing={4} align="stretch">
          <FormControl isInvalid={!!inputError}>
            <FormLabel>Add New Plant</FormLabel>
            <HStack>
              <Input
                placeholder="Enter plant name..."
                value={newPlantName}
                onChange={(e) => setNewPlantName(e.target.value)}
                isDisabled={isAddingPlant}
              />
              <Button
                leftIcon={<FaPlus />}
                colorScheme="green"
                onClick={handleAddPlant}
                isLoading={isAddingPlant}
                loadingText="Adding..."
              >
                Add Plant
              </Button>
            </HStack>
            {inputError && <FormErrorMessage>{inputError}</FormErrorMessage>}
          </FormControl>

          <Box>
            <Text fontWeight="medium" mb={2}>Or Upload CSV</Text>
            <HStack>
              <Button
                leftIcon={<FaFileUpload />}
                onClick={() => fileInputRef.current?.click()}
                isLoading={isUploading}
                loadingText="Uploading..."
              >
                Upload CSV
              </Button>
              <Tooltip label="Download CSV template">
                <IconButton
                  icon={<FaDownload />}
                  aria-label="Download template"
                  onClick={handleDownloadTemplate}
                />
              </Tooltip>
            </HStack>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".csv"
              onChange={handleFileUpload}
            />
            {isUploading && (
              <Progress size="sm" isIndeterminate mt={2} />
            )}
          </Box>
        </VStack>

        {/* Upload Results */}
        {uploadResult && (
          <Box mt={4}>
            <Alert
              status={uploadResult.failedCount === 0 ? 'success' : 'warning'}
              variant="subtle"
              flexDirection="column"
              alignItems="flex-start"
              borderRadius="md"
            >
              <AlertIcon />
              <AlertTitle>Upload Results</AlertTitle>
              <AlertDescription>
                <VStack align="start" spacing={1}>
                  <Text>Total Processed: {uploadResult.totalProcessed}</Text>
                  <Text>Successfully Added: {uploadResult.successCount}</Text>
                  {uploadResult.duplicateCount > 0 && (
                    <Text>Duplicates Skipped: {uploadResult.duplicateCount}</Text>
                  )}
                  {uploadResult.failedCount > 0 && (
                    <Text>Failed: {uploadResult.failedCount}</Text>
                  )}
                  {uploadResult.duplicates.length > 0 && (
                    <Text fontSize="sm" color="gray.600">
                      Duplicates: {uploadResult.duplicates.join(', ')}
                    </Text>
                  )}
                  {uploadResult.failed.length > 0 && (
                    <Text fontSize="sm" color="red.600">
                      Failed plants: {uploadResult.failed.map(f => f.name).join(', ')}
                    </Text>
                  )}
                </VStack>
              </AlertDescription>
            </Alert>
          </Box>
        )}
      </Box>

      {/* Search and Table */}
      <Box mb={4}>
        <HStack justify="space-between" mb={4}>
          <SearchBar
            initialValue={searchQuery}
            onSearch={setSearchQuery}
            placeholder="Search plants..."
            size="md"
            hideImageUpload={true}
          />
          {selectedPlants.size > 0 && (
            <Button
              leftIcon={<FaTrash />}
              colorScheme="red"
              variant="outline"
              onClick={() => setIsMultiDeleteOpen(true)}
            >
              Delete Selected ({selectedPlants.size})
            </Button>
          )}
        </HStack>
      </Box>

      {/* Plants Table */}
      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th px={4} width="40px">
                <Checkbox
                  isChecked={currentPlants.length > 0 && selectedPlants.size === currentPlants.length}
                  isIndeterminate={selectedPlants.size > 0 && selectedPlants.size < currentPlants.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </Th>
              <Th>Image</Th>
              <Th>Common Name</Th>
              <Th>Scientific Name</Th>
              <Th>Type</Th>
              <Th>Hindi Name</Th>
              <Th>Last Updated</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {currentPlants.map((plant) => (
              <Tr key={plant._id}>
                <Td px={4}>
                  <Checkbox
                    isChecked={selectedPlants.has(plant._id)}
                    onChange={(e) => handleSelectPlant(plant._id, e.target.checked)}
                  />
                </Td>
                <Td>
                  {plant.default_image_url ? (
                    <Image
                      src={plant.default_image_url}
                      alt={plant.common_name}
                      boxSize="50px"
                      objectFit="cover"
                      borderRadius="md"
                    />
                  ) : (
                    <Box
                      w="50px"
                      h="50px"
                      bg="gray.200"
                      borderRadius="md"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="xs" color="gray.500">No image</Text>
                    </Box>
                  )}
                </Td>
                <Td>{plant.common_name}</Td>
                <Td>
                  <EditableField
                    value={editingPlantId === plant._id ? editedValues.scientific_name || '' : plant.scientific_name}
                    onChange={(value) => handleFieldChange('scientific_name', value)}
                    isEditing={editingPlantId === plant._id}
                  />
                </Td>
                <Td>
                  <EditableField
                    value={editingPlantId === plant._id ? editedValues.plant_type || '' : plant.plant_type}
                    onChange={(value) => handleFieldChange('plant_type', value)}
                    isEditing={editingPlantId === plant._id}
                  />
                </Td>
                <Td>
                  <EditableField
                    value={editingPlantId === plant._id ? editedValues.names_in_languages?.hi || '' : plant.names_in_languages?.hi || ''}
                    onChange={(value) => handleFieldChange('hindi_name', value)}
                    isEditing={editingPlantId === plant._id}
                  />
                </Td>
                <Td>{new Date(plant.last_updated).toLocaleString()}</Td>
                <Td>
                  <HStack spacing={2}>
                    {editingPlantId === plant._id ? (
                      <>
                        <IconButton
                          aria-label="Apply changes"
                          icon={<FaCheck />}
                          size="sm"
                          colorScheme="green"
                          variant="ghost"
                          onClick={() => handleApplyEdit(plant._id)}
                        />
                        <IconButton
                          aria-label="Cancel edit"
                          icon={<FaTimes />}
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={handleCancelEdit}
                        />
                      </>
                    ) : (
                      <IconButton
                        aria-label="Edit plant"
                        icon={<FaEdit />}
                        size="sm"
                        colorScheme="gray"
                        variant="ghost"
                        onClick={() => handleEditClick(plant)}
                      />
                    )}
                    <IconButton
                      aria-label="Delete plant"
                      icon={<FaTrash />}
                      size="sm"
                      colorScheme="red"
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(plant, e)}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog
          isOpen={isMultiDeleteOpen}
          leastDestructiveRef={cancelRef}
          onClose={() => setIsMultiDeleteOpen(false)}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete Multiple Plants
              </AlertDialogHeader>

              <AlertDialogBody>
                Are you sure you want to delete {selectedPlants.size} plants? This action cannot be undone.
              </AlertDialogBody>

              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={() => setIsMultiDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  colorScheme="red"
                  onClick={handleBulkDelete}
                  ml={3}
                  isLoading={isDeleting}
                  loadingText="Deleting..."
                >
                  Delete All
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>

        {/* Pagination */}
        {totalPages > 1 && (
          <HStack justify="center" spacing={4} mt={6}>
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              isDisabled={currentPage === 1}
              size="sm"
            >
              Previous
            </Button>
            <HStack spacing={2}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  variant={currentPage === page ? 'solid' : 'outline'}
                  colorScheme={currentPage === page ? 'green' : 'gray'}
                  size="sm"
                >
                  {page}
                </Button>
              ))}
            </HStack>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              isDisabled={currentPage === totalPages}
              size="sm"
            >
              Next
            </Button>
          </HStack>
        )}

        {/* Show total count */}
        <Text textAlign="center" color="gray.600" mt={4}>
          Showing {startIndex + 1}-{Math.min(endIndex, filteredPlants.length)} of {filteredPlants.length} plants
        </Text>
      </Box>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={!!plantToDelete}
        leastDestructiveRef={cancelRef}
        onClose={() => setPlantToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Plant
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete {plantToDelete?.common_name}? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setPlantToDelete(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteConfirm}
                ml={3}
                isLoading={isDeleting}
                loadingText="Deleting..."
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

function getTypeColor(type: string): string {
  const typeColors: Record<string, string> = {
    'Herb': 'green',
    'Flowering': 'pink',
    'Fruit/Vegetable': 'orange',
    'Tree': 'teal',
    'Grass': 'yellow',
    'Succulent': 'purple',
    'Ornamental': 'blue',
    'Plant': 'gray'
  };
  return typeColors[type] || 'gray';
} 