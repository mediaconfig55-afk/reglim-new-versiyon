import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithCredential,
  GoogleAuthProvider,
  signInAnonymously,
  onAuthStateChanged,
  // @ts-ignore
  getReactNativePersistence
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getUnsyncedData, markCycleSynced, markLogSynced } from '../database/db';

const firebaseConfig = {
  apiKey: "AIzaSyA76G_AnCDu1cphfERq7zCgcOKTCO33UtI",
  authDomain: "reglim-4e244.firebaseapp.com",
  projectId: "reglim-4e244",
  storageBucket: "reglim-4e244.firebasestorage.app",
  messagingSenderId: "393754770159",
  appId: "1:393754770159:android:4585ef0db99a9c7d47b91a"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with platform-specific persistence to support Web and Native
const auth = Platform.OS === 'web' 
  ? getAuth(app) 
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

const db = getFirestore(app);

/**
 * Syncs unsynced local SQLite cycles and daily logs data to Firebase Firestore
 * for the authenticated user.
 */
export async function syncCyclesAndLogsToCloud(userId: string): Promise<boolean> {
  try {
    const { cycles, logs } = await getUnsyncedData();
    
    if (cycles.length === 0 && logs.length === 0) {
      console.log('No unsynced data to upload.');
      return true;
    }

    console.log(`Syncing ${cycles.length} cycles and ${logs.length} logs to cloud for user ${userId}...`);

    // We use batches to optimize Firestore operations (up to 500 operations per batch)
    const batch = writeBatch(db);
    let operationCount = 0;

    // 1. Queue cycle docs
    for (const c of cycles) {
      const cycleRef = doc(db, 'users', userId, 'cycles', String(c.id));
      batch.set(cycleRef, {
        id: c.id,
        start_date: c.start_date,
        end_date: c.end_date || null,
        cycle_length: c.cycle_length || null,
        period_length: c.period_length || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      operationCount++;
    }

    // 2. Queue daily log docs
    for (const l of logs) {
      const logRef = doc(db, 'users', userId, 'daily_logs', l.date);
      batch.set(logRef, {
        date: l.date,
        water_ml: l.water_ml || 0,
        sleep_hours: l.sleep_hours || 0,
        weight_kg: l.weight_kg || null,
        height_cm: l.height_cm || null,
        steps: l.steps || 0,
        calories: l.calories || 0,
        // Sync encrypted health data safely
        systolic_encrypted: l.systolic_encrypted || null,
        diastolic_encrypted: l.diastolic_encrypted || null,
        pulse_encrypted: l.pulse_encrypted || null,
        blood_sugar_encrypted: l.blood_sugar_encrypted || null,
        notes_encrypted: l.notes_encrypted || null,
        // Emojis/Moods and Symptoms (SQLite parses to JSON string, Web returns lists/strings)
        moods: typeof l.moods === 'string' ? JSON.parse(l.moods) : (l.moods || []),
        symptoms: typeof l.symptoms === 'string' ? JSON.parse(l.symptoms) : (l.symptoms || []),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      operationCount++;
    }

    // Commit batch
    if (operationCount > 0) {
      await batch.commit();
    }

    // 3. Mark synced successfully in local SQLite / local storage
    for (const c of cycles) {
      await markCycleSynced(c.id);
    }
    for (const l of logs) {
      await markLogSynced(l.date);
    }

    console.log('Firebase sync completed successfully!');
    return true;
  } catch (error) {
    console.error('Firebase Cloud Sync Error:', error);
    return false;
  }
}

export { app, auth, db };
