import { db } from '../config/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, deleteDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { WEATHER_API_KEY } from '../config/weatherConfig';

export interface Location {
  id: string;
  type: 'home' | 'work' | 'other';
  name: string;
  address: string;
  lat: number;
  lon: number;
}

export interface UserLocation {
  current: Location | null;
  saved: Location[];
}

export interface SavedLocations {
  saved: Location[];
}

export const searchLocations = async (query: string): Promise<Location[]> => {
  if (!query.trim() || !WEATHER_API_KEY) return [];

  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to search locations');
    }

    const results = await response.json();
    return results.map((result: any) => ({
      id: `${result.lat}-${result.lon}`,
      type: 'other',
      name: result.name,
      address: `${result.name}, ${result.region}, ${result.country}`,
      lat: result.lat,
      lon: result.lon,
    }));
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
};

export const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.error('[LocationService] Geolocation is not supported');
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    console.log('[LocationService] Requesting current position...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[LocationService] Successfully got position:', {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        resolve(position);
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location services.';
            console.error('[LocationService] Permission denied:', error);
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            console.error('[LocationService] Position unavailable:', error);
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            console.error('[LocationService] Request timeout:', error);
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
};

export const saveUserLocation = async (userId: string, location: Location) => {
  const locationsRef = collection(db, 'users', userId, 'locations');
  const existing = await getDocs(query(locationsRef, 
    where('address', '==', location.address),
    where('lat', '==', location.lat),
    where('lon', '==', location.lon)
  ));
  
  if (!existing.empty) {
    throw new Error('Location already exists');
  }

  await addDoc(locationsRef, location);
};

export const removeUserLocation = async (userId: string, location: Location): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'locations.saved': arrayRemove(location)
    });
  } catch (error) {
    console.error('Error removing location:', error);
    throw error;
  }
};

export const setCurrentLocation = async (userId: string, location: Location): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'locations.current': location
    });
  } catch (error) {
    console.error('Error setting current location:', error);
    throw error;
  }
};

export const getUserLocations = async (userId: string) => {
  try {
    const locationsRef = collection(db, 'users', userId, 'locations');
    const snapshot = await getDocs(locationsRef);
    return {
      saved: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location))
    };
  } catch (error) {
    console.error('[LocationService] Error getting locations:', error);
    throw error;
  }
};

export const deleteUserLocation = async (userId: string, locationId: string) => {
  const docRef = doc(db, 'users', userId, 'locations', locationId);
  await deleteDoc(docRef);
}; 