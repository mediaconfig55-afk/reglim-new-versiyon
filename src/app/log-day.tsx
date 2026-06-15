import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDailyLog, saveDailyLog, addCustomSymptom, getCustomSymptoms, getCycles, addCycle } from '../database/db';
import { Check, X, Plus, Smile, Flame, ShieldAlert, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../utils/date';

// 30+ Moods with emojis and categories
const MOODS_LIST = [
  'Mutlu', 'Enerjik', 'Sakin', 'Huzurlu', 'Neşeli', 'Sevgi Dolu', 'Heyecanlı', 'Motive',
  'Yorgun', 'Halsiz', 'Uykulu', 'Üşengeç', 'Sakin', 'Duygusal', 'Hassas', 'Ağlamaklı',
  'Stresli', 'Kaygılı', 'Gergin', 'Öfkeli', 'Sinirli', 'Huzursuz', 'Panik', 'Kararsız',
  'Üzgün', 'Yalnız', 'Kırgın', 'Keyifsiz', 'Sıkılmış', 'Karamsar'
];

// 100+ Symptoms categorized
const SYMPTOMS_CATEGORIES = {
  Fiziksel: [
    'Karın Ağrısı', 'Kramp', 'Şişkinlik', 'Göğüs Hassasiyeti', 'Baş Ağrısı', 'Sırt Ağrısı',
    'Bel Ağrısı', 'Kas Ağrısı', 'Eklem Ağrısı', 'Ateş', 'Titreme', 'Sıcak Basması',
    'Soğuk Terleme', 'Aşırı Kanama', 'Hafif Leke', 'Vajinal Kaşıntı', 'Akıntı', 'Bacak Krampı',
    'Burun Tıkanıklığı', 'Baş Dönmesi', 'Halsizlik', 'Yorgunluk', 'Kulak Çınlaması'
  ],
  Psikolojik: [
    'Stres', 'Kaygı', 'Depresif', 'Ağlama İsteği', 'Sinirlilik', 'Ani Ruh Hali Değişimi',
    'Konsantrasyon Güçlüğü', 'Unutkanlık', 'Huzursuzluk', 'Yalnızlık Hissi', 'Panik Hissi',
    'Sosyal Çekilme', 'Aşırı Hassasiyet', 'Öfke Patlaması', 'Sabırsızlık'
  ],
  Hormonal: [
    'Sivilce', 'Yağlı Saç', 'Saç Dökülmesi', 'Kuru Cilt', 'Aşırı İştah', 'Tatlı Aşerme',
    'Tuzlu Aşerme', 'İştahsızlık', 'Vajinal Kuruluk', 'Libido Artışı', 'Libido Düşüşü'
  ],
  Sindirim: [
    'Mide Şişkinliği', 'Gaz Sancısı', 'Kabızlık', 'İshal', 'Mide Bulantısı', 'Kusma',
    'Mide Yanması', 'Hazımsızlık', 'Karın Şişliği', 'Mide Krampları', 'Reflü'
  ],
  'Uyku & Enerji': [
    'Uykusuzluk', 'Aşırı Uyuma', 'Kabus Görme', 'Bölük Pörçük Uyku', 'Yorgun Uyanma',
    'Sabah Sersemliği', 'Enerji Patlaması', 'Bitkinlik', 'Uyuşukluk'
  ],
  Özel: [
    'İlaç Kullanımı', 'Cinsel İlişki', 'Korunmasız İlişki', 'Vitamin Takviyesi',
    'Doktor Kontrolü', 'Egzersiz', 'Alkol Tüketimi', 'Kafein Tüketimi', 'Sigara Kullanımı'
  ]
};

export default function LogDayModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Use date query param or default to today
  const selectedDateStr = (params.date as string) || getLocalDateString();

  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptomInput, setCustomSymptomInput] = useState('');
  const [customSymptomsList, setCustomSymptomsList] = useState<any[]>([]);

  // Period log helper checkbox
  const [isPeriodStartDay, setIsPeriodStartDay] = useState(false);
  
  const [loading, setLoading] = useState(true);

  const loadDayLogs = useCallback(async () => {
    try {
      // Load custom symptoms from SQLite
      const customs = await getCustomSymptoms();
      setCustomSymptomsList(customs);

      // Load daily log
      const dayLog = await getDailyLog(selectedDateStr);
      if (dayLog) {
        setSelectedMoods(dayLog.moods || []);
        setSelectedSymptoms(dayLog.symptoms || []);
      }

      // Check if this date matches any cycle start date
      const cycles = await getCycles();
      const match = cycles.some(c => c.start_date === selectedDateStr);
      setIsPeriodStartDay(match);

    } catch (e) {
      console.error('Failed to load day log picker:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDateStr]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDayLogs();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDayLogs]);

  const toggleMood = (mood: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedMoods.includes(mood)) {
      setSelectedMoods(selectedMoods.filter(m => m !== mood));
    } else {
      setSelectedMoods([...selectedMoods, mood]);
    }
  };

  const toggleSymptom = (sym: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
    }
  };

  const handleAddCustomSymptom = async () => {
    if (!customSymptomInput.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const name = customSymptomInput.trim();
    const success = await addCustomSymptom(name, 'Özel');
    if (success) {
      const customs = await getCustomSymptoms();
      setCustomSymptomsList(customs);
      
      // Auto select the added symptom
      setSelectedSymptoms([...selectedSymptoms, name]);
      setCustomSymptomInput('');
    } else {
      Alert.alert('Hata', 'Belirtilmek istenen semptom zaten veritabanında kayıtlı.');
    }
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // 1. Fetch current log configuration
      const currentLog = await getDailyLog(selectedDateStr) || {};
      
      const payload = {
        ...currentLog,
        date: selectedDateStr,
        moods: selectedMoods,
        symptoms: selectedSymptoms,
      };

      // 2. Save daily log
      await saveDailyLog(payload);

      // 3. Handle cycle triggers
      if (isPeriodStartDay) {
        await addCycle(selectedDateStr);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.error('Failed to save log details:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Günü Düzenle</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveHeaderBtn}>
          <Check size={20} color="#FF2366" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.dateBanner}>
          {new Date(selectedDateStr).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>

        {/* Period check trigger */}
        <View style={styles.periodCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.periodCardTitle}>Regl Başlangıç Günü Mü?</Text>
            <Text style={styles.periodCardSub}>Bugün yeni adet döngünüzün ilk günü ise aktif edin.</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsPeriodStartDay(!isPeriodStartDay)}
            style={[styles.checkbox, isPeriodStartDay && styles.checkboxActive]}
          >
            {isPeriodStartDay && <Check size={14} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* 1. Mood Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Smile size={18} color="#9B5DE5" />
            <Text style={styles.sectionTitle}>Ruh Hali & Duygular</Text>
          </View>
          <View style={styles.gridContainer}>
            {MOODS_LIST.map(mood => {
              const isSelected = selectedMoods.includes(mood);
              return (
                <TouchableOpacity
                  key={mood}
                  onPress={() => toggleMood(mood)}
                  style={[styles.tagCell, isSelected && styles.moodTagSelected]}
                >
                  <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>
                    {mood}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Symptom categories */}
        {Object.entries(SYMPTOMS_CATEGORIES).map(([catName, list]) => (
          <View key={catName} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Flame size={18} color="#FF2366" />
              <Text style={styles.sectionTitle}>{catName} Belirtiler</Text>
            </View>
            <View style={styles.gridContainer}>
              {list.map(s => {
                const isSelected = selectedSymptoms.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleSymptom(s)}
                    style={[styles.tagCell, isSelected && styles.symptomTagSelected]}
                  >
                    <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Render custom user symptoms under "Özel" category */}
              {catName === 'Özel' && customSymptomsList.map(s => {
                const isSelected = selectedSymptoms.includes(s.name);
                return (
                  <TouchableOpacity
                    key={s.name}
                    onPress={() => toggleSymptom(s.name)}
                    style={[styles.tagCell, isSelected && styles.symptomTagSelected]}
                  >
                    <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* 3. Add Custom Symptom Field */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Sparkles size={18} color="#FFD166" />
            <Text style={styles.sectionTitle}>Kendi Belirtini Ekle</Text>
          </View>
          <View style={styles.customSymptomRow}>
            <TextInput
              placeholder="Farklı bir semptom girin..."
              placeholderTextColor="#555"
              style={styles.customInput}
              value={customSymptomInput}
              onChangeText={setCustomSymptomInput}
            />
            <TouchableOpacity onPress={handleAddCustomSymptom} style={styles.addCustomBtn}>
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom save button */}
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 32, // Push the back and check icons down slightly
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 35, 102, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  dateBanner: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FF2366',
    textAlign: 'center',
    marginBottom: 20,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 35, 102, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  periodCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  periodCardSub: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
    lineHeight: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FF2366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FF2366',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagCell: {
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moodTagSelected: {
    backgroundColor: '#9B5DE5',
    borderColor: '#9B5DE5',
  },
  symptomTagSelected: {
    backgroundColor: '#FF2366',
    borderColor: '#FF2366',
  },
  tagText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  tagTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  customSymptomRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#222228',
    borderRadius: 12,
    height: 48,
    color: '#fff',
    paddingHorizontal: 16,
    fontSize: 13,
  },
  addCustomBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FF2366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
