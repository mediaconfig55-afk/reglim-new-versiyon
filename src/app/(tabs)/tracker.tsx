import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getDailyLog, saveDailyLog, DailyLogInput } from '../../database/db';
import { Activity, Heart, Droplet, Moon, Scale, Sparkles, MessageSquare, Save } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../../utils/date';

export default function HealthTrackerScreen() {
  const todayStr = getLocalDateString();

  const [log, setLog] = useState<DailyLogInput>({
    date: todayStr,
    water_ml: 0,
    sleep_hours: 0,
    weight_kg: 58.0,
    height_cm: 165.0,
    steps: 0,
    calories: 0,
    systolic: 120,
    diastolic: 80,
    pulse: 72,
    blood_sugar: 90,
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadTodayData = async () => {
    try {
      const todayLog = await getDailyLog(todayStr);
      if (todayLog) {
        setLog({
          ...todayLog,
          weight_kg: todayLog.weight_kg || 58.0,
          height_cm: todayLog.height_cm || 165.0,
          systolic: todayLog.systolic || 120,
          diastolic: todayLog.diastolic || 80,
          pulse: todayLog.pulse || 72,
          blood_sugar: todayLog.blood_sugar || 90,
        });
      }
    } catch (e) {
      console.error('Failed to load health log:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTodayData();
    }, [])
  );

  const calculateBMI = () => {
    if (!log.weight_kg || !log.height_cm) return '0.0';
    const heightM = log.height_cm / 100;
    return (log.weight_kg / (heightM * heightM)).toFixed(1);
  };

  const getBMICategory = (bmiVal: number) => {
    if (bmiVal < 18.5) return { text: 'Zayıf', color: '#FFB703' };
    if (bmiVal < 25) return { text: 'Normal', color: '#06D6A0' };
    if (bmiVal < 30) return { text: 'Fazla Kilolu', color: '#FFB703' };
    return { text: 'Obez', color: '#FF4D6D' };
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    setSuccessMsg('');

    try {
      await saveDailyLog(log);
      setSuccessMsg('Göstergeler başarıyla kaydedildi! 🌟');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (e) {
      console.error('Failed to save log:', e);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof DailyLogInput, val: any) => {
    setLog(prev => ({
      ...prev,
      [field]: val,
    }));
  };

  const bmi = parseFloat(calculateBMI());
  const bmiCat = getBMICategory(bmi);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sağlık Takip Merkezi</Text>
            <Text style={styles.headerSub}>Günlük biyometrik ve yaşamsal verilerinizi loglayın</Text>
          </View>

          {successMsg ? (
            <View style={styles.successAlert}>
              <Text style={styles.successAlertText}>{successMsg}</Text>
            </View>
          ) : null}

          {/* 1. BMI Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Scale size={18} color="#06D6A0" />
              <Text style={styles.cardTitle}>Vücut Kitle Endeksi (BMI)</Text>
            </View>
            
            <View style={styles.bmiGrid}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Kilo (kg)</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.weight_kg || '')}
                  onChangeText={(val) => updateField('weight_kg', val ? parseFloat(val) : 0)}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Boy (cm)</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.height_cm || '')}
                  onChangeText={(val) => updateField('height_cm', val ? parseFloat(val) : 0)}
                />
              </View>
            </View>

            <View style={styles.bmiResultRow}>
              <Text style={styles.bmiLabel}>BMI Skorunuz:</Text>
              <View style={styles.bmiBadgeRow}>
                <Text style={styles.bmiScore}>{bmi}</Text>
                <View style={[styles.bmiCatBadge, { backgroundColor: bmiCat.color + '20', borderColor: bmiCat.color }]}>
                  <Text style={[styles.bmiCatText, { color: bmiCat.color }]}>{bmiCat.text}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 2. Water and Sleep Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Moon size={18} color="#9B5DE5" />
              <Text style={styles.cardTitle}>Su ve Uyku Hedefleri</Text>
            </View>
            
            <View style={styles.twoColumnGrid}>
              <View style={styles.inputContainer}>
                <View style={styles.labelRow}>
                  <Droplet size={14} color="#00B4D8" />
                  <Text style={[styles.inputLabel, { marginLeft: 4 }]}>Su Tüketimi (ml)</Text>
                </View>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.water_ml || '')}
                  onChangeText={(val) => updateField('water_ml', val ? parseInt(val) : 0)}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <View style={styles.labelRow}>
                  <Moon size={14} color="#9B5DE5" />
                  <Text style={[styles.inputLabel, { marginLeft: 4 }]}>Uyku Süresi (Saat)</Text>
                </View>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.sleep_hours || '')}
                  onChangeText={(val) => updateField('sleep_hours', val ? parseFloat(val) : 0)}
                />
              </View>
            </View>
          </View>

          {/* 3. Steps & Calories Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Activity size={18} color="#FFB703" />
              <Text style={styles.cardTitle}>Günlük Aktivite</Text>
            </View>
            
            <View style={styles.twoColumnGrid}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Adım Sayısı</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.steps || '')}
                  onChangeText={(val) => updateField('steps', val ? parseInt(val) : 0)}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Alınan Kalori (kcal)</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.calories || '')}
                  onChangeText={(val) => updateField('calories', val ? parseInt(val) : 0)}
                />
              </View>
            </View>
          </View>

          {/* 4. Vital Signs (BP, Pulse, Blood Sugar) - AES ENCRYPTED locally in DB */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Heart size={18} color="#FF2366" />
              <Text style={styles.cardTitle}>Yaşamsal Bulgular & Vitals (Şifreli)</Text>
            </View>
            
            <Text style={styles.encryptShieldText}>
              🛡️ Sağlık verileriniz KVKK/GDPR uyumlu şekilde lokal veritabanında AES-256 ile şifrelenerek saklanır.
            </Text>

            <View style={styles.vitalsRowGrid}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Büyük Tansiyon (Sys)</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.systolic || '')}
                  onChangeText={(val) => updateField('systolic', val ? parseInt(val) : 0)}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Küçük Tansiyon (Dia)</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.diastolic || '')}
                  onChangeText={(val) => updateField('diastolic', val ? parseInt(val) : 0)}
                />
              </View>
            </View>

            <View style={[styles.twoColumnGrid, { marginTop: 12, flexDirection: 'row', gap: 12 }]}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Nabız (bpm)</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.pulse || '')}
                  onChangeText={(val) => updateField('pulse', val ? parseInt(val) : 0)}
                />
              </View>
              
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Açlık Kan Şekeri (mg/dL)</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.numericInput}
                  value={String(log.blood_sugar || '')}
                  onChangeText={(val) => updateField('blood_sugar', val ? parseFloat(val) : 0)}
                />
              </View>
            </View>
          </View>

          {/* 5. Health Notes (AES ENCRYPTED) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MessageSquare size={18} color="#FF2366" />
              <Text style={styles.cardTitle}>Günün Özel Sağlık Notları (Şifreli)</Text>
            </View>
            
            <TextInput
              placeholder="Fiziksel veya ruhsal durumunuzla ilgili doktorunuza göstermek istediğiniz notları ekleyin..."
              placeholderTextColor="#555"
              multiline
              numberOfLines={4}
              style={styles.textArea}
              value={log.notes || ''}
              onChangeText={(val) => updateField('notes', val)}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveBtn}
            disabled={saving}
          >
            <Save size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet ve Güncelle'}</Text>
          </TouchableOpacity>

          {/* Padding for bottom tab bar */}
          <View style={{ height: 140 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSub: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  successAlert: {
    backgroundColor: 'rgba(6, 214, 160, 0.12)',
    borderColor: '#06D6A0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  successAlertText: {
    color: '#06D6A0',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#18181c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  bmiGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  vitalsRowGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  inputContainer: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    marginBottom: 6,
  },
  numericInput: {
    backgroundColor: '#131316',
    borderWidth: 1,
    borderColor: '#222228',
    borderRadius: 12,
    height: 48,
    color: '#fff',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: 'bold',
  },
  bmiResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  bmiLabel: {
    fontSize: 13,
    color: '#aaa',
    fontWeight: '600',
  },
  bmiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bmiScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bmiCatBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bmiCatText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  encryptShieldText: {
    fontSize: 10,
    color: '#FF2366',
    backgroundColor: 'rgba(255, 35, 102, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.12)',
    padding: 10,
    borderRadius: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#131316',
    borderWidth: 1,
    borderColor: '#222228',
    borderRadius: 12,
    color: '#fff',
    padding: 12,
    fontSize: 13,
    height: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 8,
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
