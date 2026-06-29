import * as SQLite from 'expo-sqlite';
import { encryptText, decryptText } from '../utils/security';

// Open the database synchronously
let db: SQLite.SQLiteDatabase;

let dbInitialized = false;

export function initDatabase() {
  if (dbInitialized) return; // Prevent double-init on hot-reload
  try {
    db = SQLite.openDatabaseSync('reglim_takvim.db');

    // Create cycles table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_date TEXT NOT NULL UNIQUE,
        end_date TEXT,
        cycle_length INTEGER,
        period_length INTEGER,
        synced INTEGER DEFAULT 0
      );
    `);

    // Create daily logs table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        date TEXT PRIMARY KEY,
        moods TEXT, -- JSON array of active mood ids
        symptoms TEXT, -- JSON array of active symptom ids
        water_ml REAL DEFAULT 0,
        sleep_hours REAL DEFAULT 0,
        weight_kg REAL,
        height_cm REAL,
        steps INTEGER DEFAULT 0,
        calories INTEGER DEFAULT 0,
        systolic_encrypted TEXT,
        diastolic_encrypted TEXT,
        pulse_encrypted TEXT,
        blood_sugar_encrypted TEXT,
        notes_encrypted TEXT,
        synced INTEGER DEFAULT 0
      );
    `);

    // Create custom symptoms table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS custom_symptoms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL
      );
    `);

    // Create pregnancy data table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS pregnancy_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lmp_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        active INTEGER DEFAULT 1
      );
    `);

    dbInitialized = true;
    console.log('Local SQLite database initialized successfully.');
  } catch (error) {
    console.error('FATAL: Failed to initialize database:', error);
    // Re-throw so the app can show an error state instead of silently failing
    throw error;
  }
}

// ==========================================
// CYCLE QUERIES
// ==========================================

export async function getCycles(): Promise<any[]> {
  try {
    return await db.getAllAsync('SELECT * FROM cycles ORDER BY start_date DESC');
  } catch (error) {
    console.error('Failed to get cycles:', error);
    return [];
  }
}

export async function addCycle(startDate: string, endDate?: string, cycleLength?: number, periodLength?: number): Promise<boolean> {
  try {
    // 1. Insert the new cycle
    await db.runAsync(
      `INSERT OR REPLACE INTO cycles (start_date, end_date, cycle_length, period_length, synced) 
       VALUES (?, ?, ?, ?, 0)`,
      [startDate, endDate || null, cycleLength || null, periodLength || null]
    );

    // 2. Automatically calculate and update cycle_length for the previous cycle (if any)
    const prevCycle = await db.getFirstAsync<any>(
      'SELECT * FROM cycles WHERE start_date < ? ORDER BY start_date DESC LIMIT 1',
      [startDate]
    );
    if (prevCycle) {
      const startUtc = new Date(prevCycle.start_date + 'T12:00:00');
      const nextUtc = new Date(startDate + 'T12:00:00');
      const calculatedLength = Math.round((nextUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24));
      
      await db.runAsync(
        'UPDATE cycles SET cycle_length = ?, synced = 0 WHERE id = ?',
        [calculatedLength, prevCycle.id]
      );
    }

    // 3. Automatically calculate and update cycle_length for the new cycle (if a next cycle exists)
    const nextCycle = await db.getFirstAsync<any>(
      'SELECT * FROM cycles WHERE start_date > ? ORDER BY start_date ASC LIMIT 1',
      [startDate]
    );
    if (nextCycle) {
      const startUtc = new Date(startDate + 'T12:00:00');
      const nextUtc = new Date(nextCycle.start_date + 'T12:00:00');
      const calculatedLength = Math.round((nextUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24));
      
      await db.runAsync(
        'UPDATE cycles SET cycle_length = ?, synced = 0 WHERE start_date = ?',
        [calculatedLength, startDate]
      );
    }

    return true;
  } catch (error) {
    console.error('Failed to add cycle:', error);
    return false;
  }
}

export async function updateCycle(id: number, startDate: string, endDate?: string, cycleLength?: number, periodLength?: number): Promise<boolean> {
  try {
    await db.runAsync(
      `UPDATE cycles SET start_date = ?, end_date = ?, cycle_length = ?, period_length = ?, synced = 0 WHERE id = ?`,
      [startDate, endDate || null, cycleLength || null, periodLength || null, id]
    );

    // Recalculate cycle lengths for all cycles after update
    const allCycles = await db.getAllAsync<any>('SELECT * FROM cycles ORDER BY start_date ASC');
    for (let i = 0; i < allCycles.length; i++) {
      let calculatedLength: number | null = null;
      if (i < allCycles.length - 1) {
        const startUtc = new Date(allCycles[i].start_date + 'T12:00:00');
        const nextUtc = new Date(allCycles[i + 1].start_date + 'T12:00:00');
        calculatedLength = Math.round((nextUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      if (allCycles[i].cycle_length !== calculatedLength) {
        await db.runAsync(
          'UPDATE cycles SET cycle_length = ?, synced = 0 WHERE id = ?',
          [calculatedLength, allCycles[i].id]
        );
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to update cycle:', error);
    return false;
  }
}

export async function deleteCycle(id: number): Promise<boolean> {
  try {
    // Get start_date of cycle before deleting
    const target = await db.getFirstAsync<any>('SELECT start_date FROM cycles WHERE id = ?', [id]);
    
    await db.runAsync('DELETE FROM cycles WHERE id = ?', [id]);

    if (target) {
      const prevCycle = await db.getFirstAsync<any>(
        'SELECT * FROM cycles WHERE start_date < ? ORDER BY start_date DESC LIMIT 1',
        [target.start_date]
      );
      const nextCycle = await db.getFirstAsync<any>(
        'SELECT * FROM cycles WHERE start_date > ? ORDER BY start_date ASC LIMIT 1',
        [target.start_date]
      );

      if (prevCycle) {
        if (nextCycle) {
          const startUtc = new Date(prevCycle.start_date + 'T12:00:00');
          const nextUtc = new Date(nextCycle.start_date + 'T12:00:00');
          const calculatedLength = Math.round((nextUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24));
          await db.runAsync(
            'UPDATE cycles SET cycle_length = ?, synced = 0 WHERE id = ?',
            [calculatedLength, prevCycle.id]
          );
        } else {
          await db.runAsync(
            'UPDATE cycles SET cycle_length = NULL, synced = 0 WHERE id = ?',
            [prevCycle.id]
          );
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to delete cycle:', error);
    return false;
  }
}

// ==========================================
// DAILY LOGS QUERIES (with Field-Level AES-256 Encryption)
// ==========================================

export interface DailyLogInput {
  date: string;
  moods?: string[]; // array of strings
  symptoms?: string[]; // array of strings
  water_ml?: number;
  sleep_hours?: number;
  weight_kg?: number;
  height_cm?: number;
  steps?: number;
  calories?: number;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  blood_sugar?: number;
  notes?: string;
}

export interface DailyLogDB {
  date: string;
  moods: string; // JSON
  symptoms: string; // JSON
  water_ml: number;
  sleep_hours: number;
  weight_kg: number;
  height_cm: number;
  steps: number;
  calories: number;
  systolic_encrypted?: string;
  diastolic_encrypted?: string;
  pulse_encrypted?: string;
  blood_sugar_encrypted?: string;
  notes_encrypted?: string;
  synced: number;
}

export async function getDailyLog(date: string): Promise<DailyLogInput | null> {
  try {
    const row = await db.getFirstAsync<DailyLogDB>('SELECT * FROM daily_logs WHERE date = ?', [date]);
    if (!row) return null;

    // Decrypt values
    const notes = row.notes_encrypted ? await decryptText(row.notes_encrypted) : '';
    const systolicStr = row.systolic_encrypted ? await decryptText(row.systolic_encrypted) : '';
    const diastolicStr = row.diastolic_encrypted ? await decryptText(row.diastolic_encrypted) : '';
    const pulseStr = row.pulse_encrypted ? await decryptText(row.pulse_encrypted) : '';
    const sugarStr = row.blood_sugar_encrypted ? await decryptText(row.blood_sugar_encrypted) : '';

    return {
      date: row.date,
      moods: row.moods ? JSON.parse(row.moods) : [],
      symptoms: row.symptoms ? JSON.parse(row.symptoms) : [],
      water_ml: row.water_ml,
      sleep_hours: row.sleep_hours,
      weight_kg: row.weight_kg || undefined,
      height_cm: row.height_cm || undefined,
      steps: row.steps,
      calories: row.calories,
      systolic: systolicStr ? parseInt(systolicStr) : undefined,
      diastolic: diastolicStr ? parseInt(diastolicStr) : undefined,
      pulse: pulseStr ? parseInt(pulseStr) : undefined,
      blood_sugar: sugarStr ? parseFloat(sugarStr) : undefined,
      notes,
    };
  } catch (error) {
    console.error('Failed to get daily log:', error);
    return null;
  }
}

export async function getDailyLogsRange(startDate: string, endDate: string): Promise<DailyLogInput[]> {
  try {
    const rows = await db.getAllAsync<DailyLogDB>(
      'SELECT * FROM daily_logs WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [startDate, endDate]
    );

    const decryptedLogs: DailyLogInput[] = [];
    for (const row of rows) {
      const notes = row.notes_encrypted ? await decryptText(row.notes_encrypted) : '';
      const systolicStr = row.systolic_encrypted ? await decryptText(row.systolic_encrypted) : '';
      const diastolicStr = row.diastolic_encrypted ? await decryptText(row.diastolic_encrypted) : '';
      const pulseStr = row.pulse_encrypted ? await decryptText(row.pulse_encrypted) : '';
      const sugarStr = row.blood_sugar_encrypted ? await decryptText(row.blood_sugar_encrypted) : '';

      decryptedLogs.push({
        date: row.date,
        moods: row.moods ? JSON.parse(row.moods) : [],
        symptoms: row.symptoms ? JSON.parse(row.symptoms) : [],
        water_ml: row.water_ml,
        sleep_hours: row.sleep_hours,
        weight_kg: row.weight_kg || undefined,
        height_cm: row.height_cm || undefined,
        steps: row.steps,
        calories: row.calories,
        systolic: systolicStr ? parseInt(systolicStr) : undefined,
        diastolic: diastolicStr ? parseInt(diastolicStr) : undefined,
        pulse: pulseStr ? parseInt(pulseStr) : undefined,
        blood_sugar: sugarStr ? parseFloat(sugarStr) : undefined,
        notes,
      });
    }

    return decryptedLogs;
  } catch (error) {
    console.error('Failed to get daily logs range:', error);
    return [];
  }
}

export async function saveDailyLog(log: DailyLogInput): Promise<boolean> {
  try {
    // Encrypt sensitive elements
    const notes_encrypted = log.notes ? await encryptText(log.notes) : null;
    const systolic_encrypted = log.systolic !== undefined ? await encryptText(String(log.systolic)) : null;
    const diastolic_encrypted = log.diastolic !== undefined ? await encryptText(String(log.diastolic)) : null;
    const pulse_encrypted = log.pulse !== undefined ? await encryptText(String(log.pulse)) : null;
    const blood_sugar_encrypted = log.blood_sugar !== undefined ? await encryptText(String(log.blood_sugar)) : null;

    const moodsStr = JSON.stringify(log.moods || []);
    const symptomsStr = JSON.stringify(log.symptoms || []);

    await db.runAsync(
      `INSERT OR REPLACE INTO daily_logs (
        date, moods, symptoms, water_ml, sleep_hours, weight_kg, height_cm, steps, calories, 
        systolic_encrypted, diastolic_encrypted, pulse_encrypted, blood_sugar_encrypted, notes_encrypted, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        log.date,
        moodsStr,
        symptomsStr,
        log.water_ml ?? 0,
        log.sleep_hours ?? 0,
        log.weight_kg ?? null,
        log.height_cm ?? null,
        log.steps ?? 0,
        log.calories ?? 0,
        systolic_encrypted,
        diastolic_encrypted,
        pulse_encrypted,
        blood_sugar_encrypted,
        notes_encrypted,
      ]
    );

    return true;
  } catch (error) {
    console.error('Failed to save daily log:', error);
    return false;
  }
}

// ==========================================
// CUSTOM SYMPTOMS QUERIES
// ==========================================

export async function getCustomSymptoms(): Promise<any[]> {
  try {
    return await db.getAllAsync('SELECT * FROM custom_symptoms');
  } catch (error) {
    console.error('Failed to get custom symptoms:', error);
    return [];
  }
}

export async function addCustomSymptom(name: string, category: string): Promise<boolean> {
  try {
    await db.runAsync('INSERT OR IGNORE INTO custom_symptoms (name, category) VALUES (?, ?)', [name, category]);
    return true;
  } catch (error) {
    console.error('Failed to add custom symptom:', error);
    return false;
  }
}

// ==========================================
// PREGNANCY QUERIES
// ==========================================

export async function getPregnancyData(): Promise<any | null> {
  try {
    const row = await db.getFirstAsync('SELECT * FROM pregnancy_data WHERE active = 1 ORDER BY id DESC');
    return row || null;
  } catch (error) {
    console.error('Failed to get pregnancy data:', error);
    return null;
  }
}

export async function savePregnancyData(lmpDate: string, dueDate: string): Promise<boolean> {
  try {
    // Deactivate previous entries
    await db.runAsync('UPDATE pregnancy_data SET active = 0');
    // Insert new active entry
    await db.runAsync('INSERT INTO pregnancy_data (lmp_date, due_date, active) VALUES (?, ?, 1)', [lmpDate, dueDate]);
    return true;
  } catch (error) {
    console.error('Failed to save pregnancy data:', error);
    return false;
  }
}

export async function deactivatePregnancy(): Promise<boolean> {
  try {
    await db.runAsync('UPDATE pregnancy_data SET active = 0');
    return true;
  } catch (error) {
    console.error('Failed to deactivate pregnancy:', error);
    return false;
  }
}

// ==========================================
// ACTIVE CYCLE HELPERS
// ==========================================

/**
 * Returns the currently open cycle (no end_date) or null.
 * Used to detect if a period is in progress.
 */
export async function getActiveCycle(): Promise<any | null> {
  try {
    const row = await db.getFirstAsync(
      'SELECT * FROM cycles WHERE end_date IS NULL ORDER BY start_date DESC LIMIT 1'
    );
    return row || null;
  } catch (error) {
    console.error('Failed to get active cycle:', error);
    return null;
  }
}

/**
 * Closes an open cycle by setting its end_date and calculating period length.
 * Period length is inclusive (start and end day both count).
 */
export async function endCycle(id: number, endDate: string, startDate: string): Promise<boolean> {
  try {
    const startUtc = new Date(startDate + 'T00:00:00Z');
    const endUtc   = new Date(endDate   + 'T00:00:00Z');
    const periodLength = Math.max(
      1,
      Math.round((endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
    await db.runAsync(
      'UPDATE cycles SET end_date = ?, period_length = ?, synced = 0 WHERE id = ?',
      [endDate, periodLength, id]
    );
    return true;
  } catch (error) {
    console.error('Failed to end cycle:', error);
    return false;
  }
}

// ==========================================
// ONLINE SYNCING UTILITIES
// ==========================================

export async function getUnsyncedData(): Promise<{ cycles: any[]; logs: any[] }> {
  try {
    const cycles = await db.getAllAsync('SELECT * FROM cycles WHERE synced = 0');
    const logs = await db.getAllAsync('SELECT * FROM daily_logs WHERE synced = 0');
    return { cycles, logs };
  } catch (error) {
    console.error('Failed to fetch unsynced data:', error);
    return { cycles: [], logs: [] };
  }
}

export async function markCycleSynced(id: number): Promise<void> {
  try {
    await db.runAsync('UPDATE cycles SET synced = 1 WHERE id = ?', [id]);
  } catch (error) {
    console.error('Failed to mark cycle synced:', error);
  }
}

export async function markLogSynced(date: string): Promise<void> {
  try {
    await db.runAsync('UPDATE daily_logs SET synced = 1 WHERE date = ?', [date]);
  } catch (error) {
    console.error('Failed to mark log synced:', error);
  }
}

export async function clearDatabase(): Promise<boolean> {
  try {
    await db.runAsync('DELETE FROM cycles;');
    await db.runAsync('DELETE FROM daily_logs;');
    await db.runAsync('DELETE FROM custom_symptoms;');
    await db.runAsync('DELETE FROM pregnancy_data;');
    console.log('Local SQLite database wiped successfully.');
    return true;
  } catch (error) {
    console.error('Failed to clear local SQLite database:', error);
    return false;
  }
}

export async function restoreDataInLocalDB(cycles: any[], logs: any[]): Promise<boolean> {
  try {
    // 1. Wipe previous local data to prevent duplications or constraint violations
    await db.runAsync('DELETE FROM cycles;');
    await db.runAsync('DELETE FROM daily_logs;');

    // 2. Populate cycles
    for (const c of cycles) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cycles (id, start_date, end_date, cycle_length, period_length, synced) 
         VALUES (?, ?, ?, ?, ?, 1)`,
        [c.id, c.start_date, c.end_date || null, c.cycle_length || null, c.period_length || null]
      );
    }

    // 3. Populate daily logs (with decrypted storage and moods/symptoms stringification)
    for (const l of logs) {
      const moodsStr = JSON.stringify(l.moods || []);
      const symptomsStr = JSON.stringify(l.symptoms || []);
      await db.runAsync(
        `INSERT OR REPLACE INTO daily_logs (
          date, moods, symptoms, water_ml, sleep_hours, weight_kg, height_cm, steps, calories, 
          systolic_encrypted, diastolic_encrypted, pulse_encrypted, blood_sugar_encrypted, notes_encrypted, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          l.date,
          moodsStr,
          symptomsStr,
          l.water_ml ?? 0,
          l.sleep_hours ?? 0,
          l.weight_kg ?? null,
          l.height_cm ?? null,
          l.steps ?? 0,
          l.calories ?? 0,
          l.systolic_encrypted ?? null,
          l.diastolic_encrypted ?? null,
          l.pulse_encrypted ?? null,
          l.blood_sugar_encrypted ?? null,
          l.notes_encrypted ?? null,
        ]
      );
    }
    console.log('Restored cloud data to local SQLite database successfully.');
    return true;
  } catch (error) {
    console.error('Failed to restore data in local SQLite database:', error);
    return false;
  }
}
