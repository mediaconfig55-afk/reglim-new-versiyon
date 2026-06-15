import { encryptText, decryptText } from '../utils/security';

// In-memory/localStorage helpers for Web preview
const STORAGE_KEYS = {
  CYCLES: 'reglim_cycles',
  DAILY_LOGS: 'reglim_daily_logs',
  CUSTOM_SYMPTOMS: 'reglim_custom_symptoms',
  PREGNANCY: 'reglim_pregnancy',
};

// Helper to get from localStorage
function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined') return defaultValue;
    const data = window.localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Failed to read key ${key} from localStorage:`, error);
    return defaultValue;
  }
}

// Helper to save to localStorage
function setLocalItem<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error(`Failed to write key ${key} to localStorage:`, error);
  }
}

export function initDatabase() {
  console.log('Web localStorage database initialized successfully.');
  // Seed initial mock symptoms if empty
  const custom = getLocalItem<any[]>(STORAGE_KEYS.CUSTOM_SYMPTOMS, []);
  if (custom.length === 0) {
    setLocalItem(STORAGE_KEYS.CUSTOM_SYMPTOMS, [
      { id: 1, name: 'Baş Ağrısı', category: 'Fiziksel' },
      { id: 2, name: 'Kramp', category: 'Fiziksel' },
      { id: 3, name: 'Yorgunluk', category: 'Fiziksel' },
    ]);
  }
}

// ==========================================
// CYCLE QUERIES
// ==========================================

export async function getCycles(): Promise<any[]> {
  const cycles = getLocalItem<any[]>(STORAGE_KEYS.CYCLES, []);
  // Sort by start_date DESC
  return [...cycles].sort((a, b) => b.start_date.localeCompare(a.start_date));
}

export async function addCycle(
  startDate: string,
  endDate?: string,
  cycleLength?: number,
  periodLength?: number
): Promise<boolean> {
  try {
    const cycles = getLocalItem<any[]>(STORAGE_KEYS.CYCLES, []);
    // Check if start_date already exists to mimic UNIQUE constraint (replace or ignore)
    const existingIndex = cycles.findIndex((c) => c.start_date === startDate);
    
    const newCycle = {
      id: existingIndex >= 0 ? cycles[existingIndex].id : (cycles.length > 0 ? Math.max(...cycles.map((c: any) => c.id)) + 1 : 1),
      start_date: startDate,
      end_date: endDate || null,
      cycle_length: cycleLength || null,
      period_length: periodLength || null,
      synced: 0,
    };

    if (existingIndex >= 0) {
      cycles[existingIndex] = newCycle;
    } else {
      cycles.push(newCycle);
    }

    setLocalItem(STORAGE_KEYS.CYCLES, cycles);
    return true;
  } catch (error) {
    console.error('Failed to add cycle (web):', error);
    return false;
  }
}

export async function updateCycle(
  id: number,
  startDate: string,
  endDate?: string,
  cycleLength?: number,
  periodLength?: number
): Promise<boolean> {
  try {
    const cycles = getLocalItem<any[]>(STORAGE_KEYS.CYCLES, []);
    const index = cycles.findIndex((c) => c.id === id);
    if (index === -1) return false;

    cycles[index] = {
      ...cycles[index],
      start_date: startDate,
      end_date: endDate || null,
      cycle_length: cycleLength || null,
      period_length: periodLength || null,
      synced: 0,
    };

    setLocalItem(STORAGE_KEYS.CYCLES, cycles);
    return true;
  } catch (error) {
    console.error('Failed to update cycle (web):', error);
    return false;
  }
}

export async function deleteCycle(id: number): Promise<boolean> {
  try {
    const cycles = getLocalItem<any[]>(STORAGE_KEYS.CYCLES, []);
    const filtered = cycles.filter((c) => c.id !== id);
    setLocalItem(STORAGE_KEYS.CYCLES, filtered);
    return true;
  } catch (error) {
    console.error('Failed to delete cycle (web):', error);
    return false;
  }
}

// ==========================================
// DAILY LOGS QUERIES
// ==========================================

export interface DailyLogInput {
  date: string;
  moods?: string[];
  symptoms?: string[];
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

interface WebDailyLogDB {
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
    const logs = getLocalItem<Record<string, WebDailyLogDB>>(STORAGE_KEYS.DAILY_LOGS, {});
    const row = logs[date];
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
    console.error('Failed to get daily log (web):', error);
    return null;
  }
}

export async function getDailyLogsRange(startDate: string, endDate: string): Promise<DailyLogInput[]> {
  try {
    const logs = getLocalItem<Record<string, WebDailyLogDB>>(STORAGE_KEYS.DAILY_LOGS, {});
    const dates = Object.keys(logs).filter((d) => d >= startDate && d <= endDate).sort();

    const decryptedLogs: DailyLogInput[] = [];
    for (const date of dates) {
      const row = logs[date];
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
    console.error('Failed to get daily logs range (web):', error);
    return [];
  }
}

export async function saveDailyLog(log: DailyLogInput): Promise<boolean> {
  try {
    const logs = getLocalItem<Record<string, WebDailyLogDB>>(STORAGE_KEYS.DAILY_LOGS, {});

    // Encrypt sensitive elements
    const notes_encrypted = log.notes ? await encryptText(log.notes) : undefined;
    const systolic_encrypted = log.systolic !== undefined ? await encryptText(String(log.systolic)) : undefined;
    const diastolic_encrypted = log.diastolic !== undefined ? await encryptText(String(log.diastolic)) : undefined;
    const pulse_encrypted = log.pulse !== undefined ? await encryptText(String(log.pulse)) : undefined;
    const blood_sugar_encrypted = log.blood_sugar !== undefined ? await encryptText(String(log.blood_sugar)) : undefined;

    const moodsStr = JSON.stringify(log.moods || []);
    const symptomsStr = JSON.stringify(log.symptoms || []);

    logs[log.date] = {
      date: log.date,
      moods: moodsStr,
      symptoms: symptomsStr,
      water_ml: log.water_ml || 0,
      sleep_hours: log.sleep_hours || 0,
      weight_kg: log.weight_kg || 0,
      height_cm: log.height_cm || 0,
      steps: log.steps || 0,
      calories: log.calories || 0,
      systolic_encrypted,
      diastolic_encrypted,
      pulse_encrypted,
      blood_sugar_encrypted,
      notes_encrypted,
      synced: 0,
    };

    setLocalItem(STORAGE_KEYS.DAILY_LOGS, logs);
    return true;
  } catch (error) {
    console.error('Failed to save daily log (web):', error);
    return false;
  }
}

// ==========================================
// CUSTOM SYMPTOMS QUERIES
// ==========================================

export async function getCustomSymptoms(): Promise<any[]> {
  return getLocalItem<any[]>(STORAGE_KEYS.CUSTOM_SYMPTOMS, []);
}

export async function addCustomSymptom(name: string, category: string): Promise<boolean> {
  try {
    const custom = getLocalItem<any[]>(STORAGE_KEYS.CUSTOM_SYMPTOMS, []);
    if (custom.some((c) => c.name === name)) return true;

    custom.push({
      id: custom.length > 0 ? Math.max(...custom.map((c: any) => c.id)) + 1 : 1,
      name,
      category,
    });
    setLocalItem(STORAGE_KEYS.CUSTOM_SYMPTOMS, custom);
    return true;
  } catch (error) {
    console.error('Failed to add custom symptom (web):', error);
    return false;
  }
}

// ==========================================
// PREGNANCY QUERIES
// ==========================================

export async function getPregnancyData(): Promise<any | null> {
  const list = getLocalItem<any[]>(STORAGE_KEYS.PREGNANCY, []);
  const active = list.find((p) => p.active === 1);
  return active || null;
}

export async function savePregnancyData(lmpDate: string, dueDate: string): Promise<boolean> {
  try {
    const list = getLocalItem<any[]>(STORAGE_KEYS.PREGNANCY, []);
    // Deactivate previous entries
    const updatedList = list.map((p) => ({ ...p, active: 0 }));
    // Add new active entry
    updatedList.push({
      id: list.length > 0 ? Math.max(...list.map((p: any) => p.id)) + 1 : 1,
      lmp_date: lmpDate,
      due_date: dueDate,
      active: 1,
    });
    setLocalItem(STORAGE_KEYS.PREGNANCY, updatedList);
    return true;
  } catch (error) {
    console.error('Failed to save pregnancy data (web):', error);
    return false;
  }
}

export async function deactivatePregnancy(): Promise<boolean> {
  try {
    const list = getLocalItem<any[]>(STORAGE_KEYS.PREGNANCY, []);
    const updatedList = list.map((p) => ({ ...p, active: 0 }));
    setLocalItem(STORAGE_KEYS.PREGNANCY, updatedList);
    return true;
  } catch (error) {
    console.error('Failed to deactivate pregnancy (web):', error);
    return false;
  }
}

// ==========================================
// ONLINE SYNCING UTILITIES
// ==========================================

export async function getUnsyncedData(): Promise<{ cycles: any[]; logs: any[] }> {
  const cycles = getLocalItem<any[]>(STORAGE_KEYS.CYCLES, []);
  const logsObj = getLocalItem<Record<string, WebDailyLogDB>>(STORAGE_KEYS.DAILY_LOGS, {});
  const logs = Object.values(logsObj);

  return {
    cycles: cycles.filter((c) => c.synced === 0),
    logs: logs.filter((l) => l.synced === 0),
  };
}

export async function markCycleSynced(id: number): Promise<void> {
  try {
    const cycles = getLocalItem<any[]>(STORAGE_KEYS.CYCLES, []);
    const index = cycles.findIndex((c) => c.id === id);
    if (index !== -1) {
      cycles[index].synced = 1;
      setLocalItem(STORAGE_KEYS.CYCLES, cycles);
    }
  } catch (error) {
    console.error('Failed to mark cycle synced (web):', error);
  }
}

export async function markLogSynced(date: string): Promise<void> {
  try {
    const logs = getLocalItem<Record<string, WebDailyLogDB>>(STORAGE_KEYS.DAILY_LOGS, {});
    if (logs[date]) {
      logs[date].synced = 1;
      setLocalItem(STORAGE_KEYS.DAILY_LOGS, logs);
    }
  } catch (error) {
    console.error('Failed to mark log synced (web):', error);
  }
}
