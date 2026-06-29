import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getDailyLog, saveDailyLog, DailyLogInput } from '../../database/db';
import { Activity, Heart, Droplet, Moon, Scale, Sparkles, MessageSquare, Save } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../../utils/date';
import { CustomAlert } from '../../components/ui/custom-alert';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../constants/theme';

export default function HealthTrackerScreen() {
  const todayStr = getLocalDateString();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [log, setLog] = useState<DailyLogInput>({
    date: todayStr,
    water_ml: 0,
    sleep_hours: 0,
    weight_kg: undefined,
    height_cm: undefined,
    steps: 0,
    calories: 0,
    systolic: undefined,
    diastolic: undefined,
    pulse: undefined,
    blood_sugar: undefined,
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'question';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const loadTodayData = async () => {
    try {
      const todayLog = await getDailyLog(todayStr);
      if (todayLog) {
        setLog({
          ...todayLog,
          weight_kg: todayLog.weight_kg ?? undefined,
          height_cm: todayLog.height_cm ?? undefined,
          systolic: todayLog.systolic ?? undefined,
          diastolic: todayLog.diastolic ?? undefined,
          pulse: todayLog.pulse ?? undefined,
          blood_sugar: todayLog.blood_sugar ?? undefined,
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

    const showError = (msg: string) => {
      setAlertConfig({
        visible: true,
        title: 'Hata',
        message: msg,
        type: 'error',
      });
      setSaving(false);
    };

    // Bounds Validation checks
    if (log.weight_kg !== undefined && (log.weight_kg < 20 || log.weight_kg > 300)) {
      showError('Kilo değeri 20 ile 300 kg arasında olmalıdır.');
      return;
    }
    if (log.height_cm !== undefined && (log.height_cm < 50 || log.height_cm > 250)) {
      showError('Boy değeri 50 ile 250 cm arasında olmalıdır.');
      return;
    }
    if (log.water_ml !== undefined && (log.water_ml < 0 || log.water_ml > 10000)) {
      showError('Su miktarı 0 ile 10000 ml arasında olmalıdır.');
      return;
    }
    if (log.sleep_hours !== undefined && (log.sleep_hours < 0 || log.sleep_hours > 24)) {
      showError('Uyku süresi 0 ile 24 saat arasında olmalıdır.');
      return;
    }
    if (log.steps !== undefined && (log.steps < 0 || log.steps > 100000)) {
      showError('Adım sayısı 0 ile 100.000 arasında olmalıdır.');
      return;
    }
    if (log.calories !== undefined && (log.calories < 0 || log.calories > 10000)) {
      showError('Kalori değeri 0 ile 10.000 kcal arasında olmalıdır.');
      return;
    }
    if (log.systolic !== undefined && (log.systolic < 40 || log.systolic > 250)) {
      showError('Büyük tansiyon 40 ile 250 mmHg arasında olmalıdır.');
      return;
    }
    if (log.diastolic !== undefined && (log.diastolic < 30 || log.diastolic > 150)) {
      showError('Küçük tansiyon 30 ile 150 mmHg arasında olmalıdır.');
      return;
    }
    if (log.pulse !== undefined && (log.pulse < 30 || log.pulse > 220)) {
      showError('Nabız 30 ile 220 bpm arasında olmalıdır.');
      return;
    }
    if (log.blood_sugar !== undefined && (log.blood_sugar < 10 || log.blood_sugar > 600)) {
      showError('Açlık kan şekeri 10 ile 600 mg/dL arasında olmalıdır.');
      return;
    }

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

  const bmiStr = calculateBMI();
  const bmi = parseFloat(bmiStr);
  const isBmiValid = bmi > 0;
  const bmiCat = isBmiValid ? getBMICategory(bmi) : { text: 'Veri Yok', color: '#888' };

  return (
    <LinearGradient colors={theme.bgGradient} style={styles.container}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
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
          <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
            <View style={styles.cardHeader}>
              <Scale size={18} color="#06D6A0" />
              <Text style={styles.cardTitle}>Vücut Kitle Endeksi (BMI)</Text>
            </View>
            
            <View style={styles.bmiGrid}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Kilo (kg)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="58.0"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.weight_kg !== undefined ? String(log.weight_kg) : ''}
                  onChangeText={(val) => {
                    const cleaned = val.replace(',', '.').trim();
                    const parsed = parseFloat(cleaned);
                    updateField('weight_kg', isNaN(parsed) ? undefined : parsed);
                  }}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Boy (cm)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="165"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.height_cm !== undefined ? String(log.height_cm) : ''}
                  onChangeText={(val) => {
                    const cleaned = val.replace(',', '.').trim();
                    const parsed = parseFloat(cleaned);
                    updateField('height_cm', isNaN(parsed) ? undefined : parsed);
                  }}
                />
              </View>
            </View>

            <View style={styles.bmiResultRow}>
              <Text style={styles.bmiLabel}>BMI Skorunuz:</Text>
              <View style={styles.bmiBadgeRow}>
                <Text style={styles.bmiScore}>{isBmiValid ? bmiStr : '-'}</Text>
                <View style={[styles.bmiCatBadge, { backgroundColor: bmiCat.color + '20', borderColor: bmiCat.color }]}>
                  <Text style={[styles.bmiCatText, { color: bmiCat.color }]}>{bmiCat.text}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 2. Water and Sleep Card */}
          <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
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
                  placeholder="0"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.water_ml !== undefined ? String(log.water_ml) : ''}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.trim(), 10);
                    updateField('water_ml', isNaN(parsed) ? 0 : parsed);
                  }}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <View style={styles.labelRow}>
                  <Moon size={14} color="#9B5DE5" />
                  <Text style={[styles.inputLabel, { marginLeft: 4 }]}>Uyku Süresi (Saat)</Text>
                </View>
                <TextInput
                  keyboardType="numeric"
                  placeholder="0.0"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.sleep_hours !== undefined ? String(log.sleep_hours) : ''}
                  onChangeText={(val) => {
                    const cleaned = val.replace(',', '.').trim();
                    const parsed = parseFloat(cleaned);
                    updateField('sleep_hours', isNaN(parsed) ? 0 : parsed);
                  }}
                />
              </View>
            </View>
          </View>

          {/* 3. Steps & Calories Card */}
          <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
            <View style={styles.cardHeader}>
              <Activity size={18} color="#FFB703" />
              <Text style={styles.cardTitle}>Günlük Aktivite</Text>
            </View>
            
            <View style={styles.twoColumnGrid}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Adım Sayısı</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.steps !== undefined ? String(log.steps) : ''}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.trim(), 10);
                    updateField('steps', isNaN(parsed) ? 0 : parsed);
                  }}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Alınan Kalori (kcal)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.calories !== undefined ? String(log.calories) : ''}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.trim(), 10);
                    updateField('calories', isNaN(parsed) ? 0 : parsed);
                  }}
                />
              </View>
            </View>
          </View>

          {/* 4. Vital Signs (BP, Pulse, Blood Sugar) - AES ENCRYPTED locally in DB */}
          <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
            <View style={styles.cardHeader}>
              <Heart size={18} color={theme.primary} />
              <Text style={styles.cardTitle}>Yaşamsal Bulgular & Vitals (Şifreli)</Text>
            </View>
            
            <Text style={[styles.encryptShieldText, { color: theme.primary, backgroundColor: theme.primary + '0D', borderColor: theme.primary + '1F' }]}>
              🛡️ Sağlık verileriniz KVKK/GDPR uyumlu şekilde lokal veritabanında AES-256 ile şifrelenerek saklanır.
            </Text>

            <View style={styles.vitalsRowGrid}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Büyük Tansiyon (Sys)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="120"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.systolic !== undefined ? String(log.systolic) : ''}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.trim(), 10);
                    updateField('systolic', isNaN(parsed) ? undefined : parsed);
                  }}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Küçük Tansiyon (Dia)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="80"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.diastolic !== undefined ? String(log.diastolic) : ''}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.trim(), 10);
                    updateField('diastolic', isNaN(parsed) ? undefined : parsed);
                  }}
                />
              </View>
            </View>

            <View style={[styles.twoColumnGrid, { marginTop: 12, flexDirection: 'row', gap: 12 }]}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Nabız (bpm)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="72"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.pulse !== undefined ? String(log.pulse) : ''}
                  onChangeText={(val) => {
                    const parsed = parseInt(val.trim(), 10);
                    updateField('pulse', isNaN(parsed) ? undefined : parsed);
                  }}
                />
              </View>
              
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Açlık Kan Şekeri (mg/dL)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="90"
                  placeholderTextColor="#444"
                  style={styles.numericInput}
                  value={log.blood_sugar !== undefined ? String(log.blood_sugar) : ''}
                  onChangeText={(val) => {
                    const cleaned = val.replace(',', '.').trim();
                    const parsed = parseFloat(cleaned);
                    updateField('blood_sugar', isNaN(parsed) ? undefined : parsed);
                  }}
                />
              </View>
            </View>
          </View>

          {/* 5. Health Notes (AES ENCRYPTED) */}
          <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
            <View style={styles.cardHeader}>
              <MessageSquare size={18} color={theme.primary} />
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
            style={[styles.saveBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
            disabled={saving}
          >
            <Save size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet ve Güncelle'}</Text>
          </TouchableOpacity>

          {/* Padding for bottom tab bar */}
          <View style={{ height: Math.max(140, insets.bottom + 90) }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
      </SafeAreaView>
    </LinearGradient>
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
