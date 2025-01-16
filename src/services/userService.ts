import { db } from '../config/firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { User } from 'firebase/auth'

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  createdAt: Date
  lastLoginAt: Date
}

export const createOrUpdateUser = async (user: User) => {
  const userRef = doc(db, 'users', user.uid)
  const userDoc = await getDoc(userRef)

  const userData: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    lastLoginAt: new Date(),
    createdAt: userDoc.exists() ? userDoc.data().createdAt : new Date(),
  }

  await setDoc(userRef, userData, { merge: true })
  return userData
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid)
  const userDoc = await getDoc(userRef)

  if (!userDoc.exists()) {
    return null
  }

  return userDoc.data() as UserProfile
} 