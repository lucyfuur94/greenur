import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read service account key
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../../../serviceAccountKey.json'), 'utf8')
)

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount),
})

// Initialize Firestore
export const db = getFirestore(app) 