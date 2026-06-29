import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/store';
import { addCycle, saveDailyLog } from '../../database/db';
import { addDays } from '../../utils/periodEngine';
import { User, Calendar as CalendarIcon, Ruler, Weight } from 'lucide-react-native';
import { getLocalDateString } from '../../utils/date';
import { CustomAlert } from '../../components/ui/custom-alert';

export default function SetupScreen() {
  const router = useRouter();
  const { user, setUser, setOnboarded } = useAppStore();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [lastPeriod, setLastPeriod] = useState(getLocalDateString());
  const [cycleLength, setCycleLength] = useState('28');
  const [periodLength, setPeriodLength] = useState('5');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleFinish = async () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(lastPeriod) || isNaN(Date.parse(lastPeriod))) {
      setAlertConfig({
        visible: true,
        title: 'Hata',
        message: 'Lütfen son regl tarihinizi YYYY-AA-GG formatında giriniz (Örn: 2026-06-15).',
        type: 'error',
      });
      return;
    }

    const enteredDate = new Date(lastPeriod + 'T00:00:00Z');
    const todayUtc = new Date(getLocalDateString() + 'T00:00:00Z');
    if (enteredDate > todayUtc) {
      setAlertConfig({
        visible: true,
        title: 'Hata',
        message: 'Son regl tarihi bugünden ileri bir tarih olamaz.',
        type: 'error',
      });
      return;
    }

    const maxPastMs = 42 * 7 * 24 * 60 * 60 * 1000; // 42 weeks
    if (todayUtc.getTime() - enteredDate.getTime() > maxPastMs) {
      setAlertConfig({
        visible: true,
        title: 'Hata',
        message: '42 haftadan önceye ait bir tarih giremezsiniz.',
        type: 'error',
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Update user profile name
      if (user) {
        setUser({ ...user, displayName: name });
      }

      // 2. Add first cycle
      const pLen = parseInt(periodLength) || 5;
      const cLen = parseInt(cycleLength) || 28;
      const calculatedEndDate = addDays(lastPeriod, pLen - 1);
      await addCycle(lastPeriod, calculatedEndDate, cLen, pLen);

      // 3. Add initial log for weight and height today
      const todayStr = getLocalDateString();
      await saveDailyLog({
        date: todayStr,
        weight_kg: weight ? parseFloat(weight) : undefined,
        height_cm: height ? parseFloat(height) : undefined,
      });

      // 4. Set onboarded to true
      await setOnboarded(true);

      // 5. Navigate to tabs
      router.replace('/(tabs)');
    } catch (e) {
      console.error('Kurulum sırasında hata:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sizi Biraz Tanıyalım</Text>
        <Text style={styles.headerSub}>Uygulamayı size özel hale getirmek için lütfen bilgilerinizi girin.</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Adınız Nedir?</Text>
          <View style={styles.inputWrapper}>
            <User size={20} color="#888" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Örn: Ayşe"
              placeholderTextColor="#555"
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Son Regl / Kanama Tarihiniz</Text>
          <View style={styles.inputWrapper}>
            <CalendarIcon size={20} color="#888" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="YYYY-AA-GG (Örn: 2024-05-20)"
              placeholderTextColor="#555"
              value={lastPeriod}
              onChangeText={setLastPeriod}
            />
          </View>
          <Text style={styles.hintText}>Tarihi YYYY-AA-GG formatında giriniz.</Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Döngü Süresi</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="28"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={cycleLength}
                onChangeText={setCycleLength}
              />
              <Text style={styles.unitText}>Gün</Text>
            </View>
          </View>
          
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Kanama Süresi</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="5"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={periodLength}
                onChangeText={setPeriodLength}
              />
              <Text style={styles.unitText}>Gün</Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Boyunuz</Text>
            <View style={styles.inputWrapper}>
              <Ruler size={20} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="165"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
              />
              <Text style={styles.unitText}>cm</Text>
            </View>
          </View>
          
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Kilonuz</Text>
            <View style={styles.inputWrapper}>
              <Weight size={20} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="60"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
              />
              <Text style={styles.unitText}>kg</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
        <TouchableOpacity 
          style={[styles.button, (!name || !lastPeriod) && styles.buttonDisabled]} 
          onPress={handleFinish}
          disabled={!name || !lastPeriod || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Tamamla ve Başla</Text>
          )}
        </TouchableOpacity>
      </View>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSub: {
    fontSize: 15,
    color: '#aaa',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1f',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  unitText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 8,
  },
  hintText: {
    color: '#666',
    fontSize: 12,
    marginTop: 6,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  button: {
    backgroundColor: '#FF2366',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
