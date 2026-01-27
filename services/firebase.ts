import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Handle global variables usually injected by the hosting environment
const rawConfig = typeof (window as any).__firebase_config !== 'undefined' 
    ? (window as any).__firebase_config 
    : null;

// Only parse if rawConfig exists
const firebaseConfig = rawConfig ? JSON.parse(rawConfig) : null;

export const initialAuthToken = typeof (window as any).__initial_auth_token !== 'undefined' 
    ? (window as any).__initial_auth_token 
    : null;

let app: FirebaseApp;
let db: Firestore | null = null;
let auth: Auth | null = null;

// Only initialize if we have a valid config, otherwise app runs in offline/demo mode
if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "PLACEHOLDER_API_KEY") {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } catch (error) {
        console.error("Firebase Initialization Error:", error);
    }
} else {
    console.warn("No valid Firebase config found. Running in Offline Demo Mode.");
}

export { db, auth };