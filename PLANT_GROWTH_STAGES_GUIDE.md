# Plant Growth Stages Management System

This system allows you to store and manage plant growth stage images using Firebase Storage and MongoDB.

## 📋 Overview

The system consists of:
- **MongoDB Collection**: `plant_growth_stages` - stores image metadata and growth stage information
- **Firebase Storage**: Stores the actual image files in organized folders
- **Netlify Functions**: Handle upload and retrieval operations
- **Upload Script**: Bulk uploads existing images

## 🗄️ MongoDB Collection Schema

### Collection: `plant_growth_stages`

```typescript
interface GrowthStageImage {
  plantType: string;           // e.g., "tomato", "pepper", "lettuce"
  stageName: string;           // e.g., "germination", "seedling", "flowering"
  stageDescription: string;    // Human-readable description
  imageUrl: string;           // Firebase signed URL
  firebasePath: string;       // Firebase storage path
  stageOrder: number;         // Order of stage (1-6 for tomato)
  uploadedAt: Date;           // Upload timestamp
  uploadedBy?: string;        // User who uploaded (optional)
  metadata: {
    originalFileName: string;
    fileSize: number;
    contentType: string;
  };
}
```

### Indexes
- `{ plantType: 1, stageName: 1, stageOrder: 1 }` - For efficient querying

## 🍅 Tomato Growth Stages

The system currently supports these tomato growth stages:

| Stage | Order | Name | Description |
|-------|-------|------|-------------|
| 1 | `germination` | Seed germination and early sprouting |
| 2 | `seedling` | Young plant with first true leaves |
| 3 | `vegetative_growth` | Rapid growth and leaf development |
| 4 | `flowering` | Flower buds and blooming stage |
| 5 | `fruiting` | Fruit formation and development |
| 6 | `ripening` | Fruit maturation and ripening |

## 📁 Firebase Storage Structure

Images are stored in Firebase with this hierarchy:
```
growth-stages/
  └── tomato/
      ├── germination/
      │   └── 1703123456789_tomato-germination.jpg
      ├── seedling/
      │   └── 1703123456790_tomato-seedling.jpg
      ├── vegetative_growth/
      │   └── 1703123456791_tomato-vegetative_growth.jpg
      ├── flowering/
      │   └── 1703123456792_tomato-flowering.jpg
      ├── fruiting/
      │   └── 1703123456793_tomatoe-fruiting.jpg
      └── ripening/
          └── 1703123456794_tomato-ripening.jpg
```

## 🔧 API Functions

### 1. Upload Growth Stage Images
**Endpoint**: `/.netlify/functions/upload-growth-stage-images`
**Method**: POST
**Content-Type**: multipart/form-data

**Parameters**:
- `file`: Image file (max 10MB)
- `plantType`: Plant type (e.g., "tomato")
- `stageName`: Growth stage name (e.g., "germination")
- `uploadedBy`: Optional uploader identifier
- `contentType`: Optional content type (defaults to "image/jpeg")

**Response**:
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://storage.googleapis.com/...",
    "firebasePath": "growth-stages/tomato/germination/...",
    "plantType": "tomato",
    "stageName": "germination",
    "stageOrder": 1
  }
}
```

### 2. Get Growth Stage Images
**Endpoint**: `/.netlify/functions/get-growth-stage-images`
**Method**: GET

**Query Parameters**:
- `plantType`: Filter by plant type (optional)
- `stageName`: Filter by stage name (optional)
- `limit`: Number of results (default: 50)

**Examples**:
- Get all tomato stages: `?plantType=tomato`
- Get specific stage: `?plantType=tomato&stageName=flowering`
- Get all images: (no parameters)

**Response for specific plant type**:
```json
{
  "success": true,
  "plantType": "tomato",
  "stageCount": 6,
  "totalImages": 6,
  "stages": {
    "germination": [{ /* image data */ }],
    "seedling": [{ /* image data */ }],
    "vegetative_growth": [{ /* image data */ }],
    "flowering": [{ /* image data */ }],
    "fruiting": [{ /* image data */ }],
    "ripening": [{ /* image data */ }]
  }
}
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Upload Your Tomato Images

**Option A: Use the Bulk Upload Script (Recommended)**
```bash
# First, start your Netlify dev server
netlify dev

# In another terminal, run the upload script
npm run upload-tomato-images

# Or run directly
node scripts/upload-tomato-images.js
```

**Option B: Manual Upload via API**
Use the upload function endpoint directly with tools like Postman or curl.

### 3. Test the System
```bash
# Get all tomato images
curl "http://localhost:8888/.netlify/functions/get-growth-stage-images?plantType=tomato"

# Get specific stage
curl "http://localhost:8888/.netlify/functions/get-growth-stage-images?plantType=tomato&stageName=flowering"
```

## 📝 Upload Script Usage

The bulk upload script (`scripts/upload-tomato-images.js`) automatically maps your tomato images:

| Filename | Maps to Stage |
|----------|---------------|
| `tomato-germination.jpg` | germination |
| `tomato-seedling.jpg` | seedling |
| `tomato-vegetative_growth.jpg` | vegetative_growth |
| `tomato-flowering.jpg` | flowering |
| `tomatoe-fruiting.jpg` | fruiting |
| `tomato-ripening.jpg` | ripening |

**Script Options**:
```bash
# Show help
node scripts/upload-tomato-images.js --help

# Dry run (see what would be uploaded)
node scripts/upload-tomato-images.js --dry-run

# Actually upload
node scripts/upload-tomato-images.js
```

## 🔧 Configuration

### Environment Variables Required:
- `MONGO_URI`: MongoDB connection string
- `MONGODB_DB`: Database name (default: "master")
- Firebase service account key in `netlify/functions/utils/serviceAccountKey.json`

### For Production:
Update the `UPLOAD_ENDPOINT` in the upload script to your deployed Netlify function URL.

## 🔍 Querying the Data

### Frontend Integration Example:
```typescript
// Get all tomato growth stages
const response = await fetch('/.netlify/functions/get-growth-stage-images?plantType=tomato');
const data = await response.json();

// Access stages
const germinationImages = data.stages.germination;
const floweringImages = data.stages.flowering;
```

### MongoDB Direct Query:
```javascript
// Find all tomato images
db.plant_growth_stages.find({ plantType: "tomato" })

// Find specific stage
db.plant_growth_stages.find({ 
  plantType: "tomato", 
  stageName: "flowering" 
})

// Find images ordered by stage
db.plant_growth_stages.find({ plantType: "tomato" })
  .sort({ stageOrder: 1 })
```

## 🔄 Adding New Plant Types

To add support for new plants:

1. **Update the growth stages definition** in `upload-growth-stage-images.ts`:
```typescript
const PLANT_GROWTH_STAGES = {
  tomato: [...],
  pepper: [
    { name: 'germination', description: 'Seed sprouting', order: 1 },
    { name: 'seedling', description: 'Young pepper plant', order: 2 },
    // ... add more stages
  ]
};
```

2. **Create a new upload script** for the new plant type following the tomato script pattern.

3. **Update file mapping** in your upload script with the new plant's image filenames.

## 🛡️ Security & Best Practices

- Images are stored with signed URLs that expire in 2500 (long-term access)
- File uploads are limited to 10MB
- Only specific file types are accepted (JPEG, PNG)
- All uploads are logged with timestamps and uploader information
- Firebase storage paths are organized and predictable
- MongoDB indexes ensure efficient querying

## 🎯 Recommendations

**For your current setup, I recommend**:

1. **Use the automated script** - It's the fastest way to get your tomato images uploaded
2. **Keep images on Firebase** - Don't duplicate them locally once uploaded
3. **Use the MongoDB collection** - It provides fast querying and metadata storage
4. **Extend for other plants** - The system is designed to scale to multiple plant types

This system gives you a robust, scalable foundation for managing plant growth stage images that integrates perfectly with your existing Firebase and MongoDB infrastructure. 