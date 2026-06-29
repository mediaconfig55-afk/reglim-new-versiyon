import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getDailyLog,
  saveDailyLog,
  addCustomSymptom,
  getCustomSymptoms,
  getCycles,
  addCycle,
} from '../database/db';
import {
  Check,
  X,
  Plus,
  Smile,
  Flame,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ClipboardList,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../utils/date';
import { CustomAlert } from '../components/ui/custom-alert';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

// Categorized Moods list with emojis, categories and premium HSL matching colors
const MOODS_CATEGORIES: Record<string, { name: string; emoji: string; color: string; bg: string }[]> = {
  'Pozitif 🌸': [
    { name: 'Mutlu', emoji: '😊', color: '#FFB5A7', bg: 'rgba(255, 181, 167, 0.15)' },
    { name: 'Enerjik', emoji: '⚡', color: '#FFD166', bg: 'rgba(255, 209, 102, 0.15)' },
    { name: 'Sakin', emoji: '🍃', color: '#06D6A0', bg: 'rgba(6, 214, 160, 0.15)' },
    { name: 'Huzurlu', emoji: '🕊️', color: '#118AB2', bg: 'rgba(17, 138, 178, 0.15)' },
    { name: 'Neşeli', emoji: '🎉', color: '#F15BB5', bg: 'rgba(241, 91, 181, 0.15)' },
    { name: 'Sevgi Dolu', emoji: '❤️', color: '#FF4D6D', bg: 'rgba(255, 77, 109, 0.15)' },
    { name: 'Heyecanlı', emoji: '✨', color: '#FF9F1C', bg: 'rgba(255, 159, 28, 0.15)' },
    { name: 'Motive', emoji: '🔥', color: '#E63946', bg: 'rgba(230, 57, 70, 0.15)' },
  ],
  'Düşük Enerji 💤': [
    { name: 'Yorgun', emoji: '😴', color: '#A8DADC', bg: 'rgba(168, 220, 220, 0.15)' },
    { name: 'Halsiz', emoji: '🤒', color: '#8D99AE', bg: 'rgba(141, 153, 174, 0.15)' },
    { name: 'Uykulu', emoji: '💤', color: '#457B9D', bg: 'rgba(69, 123, 157, 0.15)' },
    { name: 'Üşengeç', emoji: '🦥', color: '#B5E2FA', bg: 'rgba(181, 226, 250, 0.15)' },
    { name: 'Keyifsiz', emoji: '😕', color: '#E2E2E2', bg: 'rgba(226, 226, 226, 0.15)' },
    { name: 'Sıkılmış', emoji: '😑', color: '#BDB2FF', bg: 'rgba(189, 178, 255, 0.15)' },
  ],
  'Duygusal 🥺': [
    { name: 'Duygusal', emoji: '🥺', color: '#FFC6FF', bg: 'rgba(255, 198, 255, 0.15)' },
    { name: 'Hassas', emoji: '🌸', color: '#FFB7FF', bg: 'rgba(255, 183, 255, 0.15)' },
    { name: 'Ağlamaklı', emoji: '😢', color: '#CAFFBF', bg: 'rgba(202, 255, 191, 0.15)' },
    { name: 'Üzgün', emoji: '😔', color: '#90E0EF', bg: 'rgba(144, 224, 239, 0.15)' },
    { name: 'Yalnız', emoji: '👤', color: '#BDB2FF', bg: 'rgba(189, 178, 255, 0.15)' },
    { name: 'Kırgın', emoji: '💔', color: '#FF85A1', bg: 'rgba(255, 133, 161, 0.15)' },
    { name: 'Karamsar', emoji: '🖤', color: '#6C757D', bg: 'rgba(108, 117, 125, 0.15)' },
  ],
  'Stres & Negatif ⚡': [
    { name: 'Stresli', emoji: '😰', color: '#FF7096', bg: 'rgba(255, 112, 150, 0.15)' },
    { name: 'Kaygılı', emoji: '😟', color: '#FF85A1', bg: 'rgba(255, 133, 161, 0.15)' },
    { name: 'Gergin', emoji: '😬', color: '#E07A5F', bg: 'rgba(224, 122, 95, 0.15)' },
    { name: 'Öfkeli', emoji: '😡', color: '#FF0054', bg: 'rgba(255, 0, 84, 0.15)' },
    { name: 'Sinirli', emoji: '😠', color: '#FF5400', bg: 'rgba(255, 84, 0, 0.15)' },
    { name: 'Huzursuz', emoji: '🌀', color: '#9B5DE5', bg: 'rgba(155, 93, 229, 0.15)' },
    { name: 'Panik', emoji: '😱', color: '#F15BB5', bg: 'rgba(241, 91, 181, 0.15)' },
    { name: 'Kararsız', emoji: '🤔', color: '#FFD166', bg: 'rgba(255, 209, 102, 0.15)' },
  ],
};

// 100+ Symptoms categorized (We filtered out checklist items to prevent duplicates)
const SYMPTOMS_CATEGORIES: Record<string, string[]> = {
  Fiziksel: [
    'Karın Ağrısı',
    'Kramp',
    'Şişkinlik',
    'Göğüs Hassasiyeti',
    'Baş Ağrısı',
    'Sırt Ağrısı',
    'Bel Ağrısı',
    'Kas Ağrısı',
    'Eklem Ağrısı',
    'Ateş',
    'Titreme',
    'Sıcak Basması',
    'Soğuk Terleme',
    'Aşırı Kanama',
    'Hafif Leke',
    'Vajinal Kaşıntı',
    'Akıntı',
    'Bacak Krampı',
    'Burun Tıkanıklığı',
    'Baş Dönmesi',
    'Halsizlik',
    'Yorgunluk',
    'Kulak Çınlaması',
  ],
  Psikolojik: [
    'Stres',
    'Kaygı',
    'Depresif',
    'Ağlama İsteği',
    'Sinirlilik',
    'Ani Ruh Hali Değişimi',
    'Konsantrasyon Güçlüğü',
    'Unutkanlık',
    'Huzursuzluk',
    'Yalnızlık Hissi',
    'Panik Hissi',
    'Sosyal Çekilme',
    'Aşırı Hassasiyet',
    'Öfke Patlaması',
    'Sabırsızlık',
  ],
  Hormonal: [
    'Sivilce',
    'Yağlı Saç',
    'Saç Dökülmesi',
    'Kuru Cilt',
    'Aşırı İştah',
    'Tatlı Aşerme',
    'Tuzlu Aşerme',
    'İştahsızlık',
    'Vajinal Kuruluk',
    'Libido Artışı',
    'Libido Düşüşü',
  ],
  Sindirim: [
    'Mide Şişkinliği',
    'Gaz Sancısı',
    'Kabızlık',
    'İshal',
    'Mide Bulantısı',
    'Kusma',
    'Mide Yanması',
    'Hazımsızlık',
    'Karın Şişliği',
    'Mide Krampları',
    'Reflü',
  ],
  'Uyku & Enerji': [
    'Uykusuzluk',
    'Aşırı Uyuma',
    'Kabus Görme',
    'Bölük Pörçük Uyku',
    'Yorgun Uyanma',
    'Sabah Sersemliği',
    'Enerji Patlaması',
    'Bitkinlik',
    'Uyuşukluk',
  ],
  Özel: [
    'Cinsel İlişki',
    'Korunmasız İlişki',
    'Doktor Kontrolü',
    'Alkol Tüketimi',
    'Kafein Tüketimi',
    'Sigara Kullanımı',
  ],
};

// Checklist items mapped directly to SQLite symptoms field to keep schema clean
const CHECKLIST_ITEMS = [
  { id: 'water', emoji: '💧', label: 'Yeterli Su Tüketimi', desc: 'En az 2 Litre su içildi', symptom: 'Yeterli Su Tüketimi' },
  { id: 'vitamins', emoji: '💊', label: 'İlaç & Vitaminler', desc: 'Günlük takviyeler alındı', symptom: 'Vitamin Takviyesi' },
  { id: 'exercise', emoji: '🏃', label: 'Egzersiz & Spor', desc: 'Hafif spor veya yoga yapıldı', symptom: 'Egzersiz' },
  { id: 'diet', emoji: '🥗', label: 'Dengeli Beslenme', desc: 'Sağlıklı ve düzenli beslenildi', symptom: 'Dengeli Beslenme' },
  { id: 'sleep', emoji: '😴', label: 'Düzenli Uyku', desc: '7-8 saat kaliteli uyku uyunuldu', symptom: 'Düzenli Uyku' },
  { id: 'skincare', emoji: '🧴', label: 'Cilt Bakımı & Bakım', desc: 'Cilt rutini yapıldı veya zaman ayrıldı', symptom: 'Cilt Bakımı' },
];

export default function LogDayModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const selectedDateStr = (params.date as string) || getLocalDateString();

  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptomInput, setCustomSymptomInput] = useState('');
  const [customSymptomsList, setCustomSymptomsList] = useState<any[]>([]);

  // Accordion state (first one is open by default)
  const [openCategories, setOpenCategories] = useState<string[]>(['Fiziksel']);

  const [isPeriodStartDay, setIsPeriodStartDay] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const loadDayLogs = useCallback(async () => {
    try {
      const customs = await getCustomSymptoms();
      setCustomSymptomsList(customs);

      const dayLog = await getDailyLog(selectedDateStr);
      if (dayLog) {
        setSelectedMoods(dayLog.moods || []);
        setSelectedSymptoms(dayLog.symptoms || []);
      }

      const cycles = await getCycles();
      const match = cycles.some((c) => c.start_date === selectedDateStr);
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
      setSelectedMoods(selectedMoods.filter((m) => m !== mood));
    } else {
      setSelectedMoods([...selectedMoods, mood]);
    }
  };

  const toggleSymptom = (sym: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
    }
  };

  const toggleCategory = (catName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (openCategories.includes(catName)) {
      setOpenCategories(openCategories.filter((c) => c !== catName));
    } else {
      setOpenCategories([...openCategories, catName]);
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
      setSelectedSymptoms([...selectedSymptoms, name]);
      setCustomSymptomInput('');
    } else {
      setAlertConfig({
        visible: true,
        title: 'Hata',
        message: 'Belirtilmek istenen semptom zaten veritabanında kayıtlı.',
        type: 'error',
      });
    }
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const currentLog = (await getDailyLog(selectedDateStr)) || {};
      const payload = {
        ...currentLog,
        date: selectedDateStr,
        moods: selectedMoods,
        symptoms: selectedSymptoms,
      };

      await saveDailyLog(payload);

      if (isPeriodStartDay) {
        await addCycle(selectedDateStr);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.error('Failed to save log details:', e);
    }
  };

  // Checklist statistics helper
  const getCompletedChecklistCount = () => {
    return CHECKLIST_ITEMS.filter((item) => selectedSymptoms.includes(item.symptom)).length;
  };

  const getCategoryActiveCount = (catName: string, list: string[]) => {
    let count = selectedSymptoms.filter((s) => list.includes(s)).length;
    if (catName === 'Özel') {
      count += selectedSymptoms.filter((s) =>
        customSymptomsList.some((cs) => cs.name === s)
      ).length;
    }
    return count;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2366" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
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
          {new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>

        {/* Period Check */}
        <View style={styles.periodCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.periodCardTitle}>Regl Başlangıç Günü Mü?</Text>
            <Text style={styles.periodCardSub}>Bugün yeni adet döngünüzün ilk günü ise aktif edin.</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsPeriodStartDay(!isPeriodStartDay);
            }}
            style={[styles.checkbox, isPeriodStartDay && styles.checkboxActive]}
          >
            {isPeriodStartDay && <Check size={14} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* =========================================================================
            DAILY CHECKLIST
            ========================================================================= */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <ClipboardList size={18} color="#06D6A0" />
            <Text style={styles.sectionTitle}>Günlük Sağlık Rutinleri</Text>
            <View style={styles.badgeProgress}>
              <Text style={styles.badgeProgressText}>
                {getCompletedChecklistCount()} / {CHECKLIST_ITEMS.length}
              </Text>
            </View>
          </View>

          <View style={styles.checklistCard}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${(getCompletedChecklistCount() / CHECKLIST_ITEMS.length) * 100}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.checklistGrid}>
              {CHECKLIST_ITEMS.map((item) => {
                const isChecked = selectedSymptoms.includes(item.symptom);
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => toggleSymptom(item.symptom)}
                    style={[styles.checkItemCard, isChecked && styles.checkItemCardActive]}
                  >
                    <View style={styles.checkItemHeader}>
                      <Text style={styles.checkItemEmoji}>{item.emoji}</Text>
                      <View
                        style={[
                          styles.checklistIndicator,
                          isChecked && styles.checklistIndicatorActive,
                        ]}
                      >
                        {isChecked && <Check size={10} color="#fff" />}
                      </View>
                    </View>
                    <Text style={[styles.checkItemLabel, isChecked && styles.textWhite]}>
                      {item.label}
                    </Text>
                    <Text style={styles.checkItemDesc}>{item.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* =========================================================================
            MOOD SECTION
            ========================================================================= */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Smile size={18} color="#9B5DE5" />
            <Text style={styles.sectionTitle}>Ruh Hali & Duygular</Text>
          </View>

          {Object.entries(MOODS_CATEGORIES).map(([catTitle, list]) => (
            <View key={catTitle} style={styles.moodCatBlock}>
              <Text style={styles.moodCatTitle}>{catTitle}</Text>
              <View style={styles.moodGrid}>
                {list.map((mood) => {
                  const isSelected = selectedMoods.includes(mood.name);
                  return (
                    <TouchableOpacity
                      key={mood.name}
                      onPress={() => toggleMood(mood.name)}
                      style={[
                        styles.moodCell,
                        { borderColor: isSelected ? mood.color : 'rgba(255,255,255,0.03)' },
                        isSelected && { backgroundColor: mood.bg },
                      ]}
                    >
                      <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                      <Text
                        style={[
                          styles.moodLabel,
                          isSelected && { color: mood.color, fontWeight: 'bold' },
                        ]}
                      >
                        {mood.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* =========================================================================
            COLLAPSIBLE SYMPTOM ACCORDIONS
            ========================================================================= */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Flame size={18} color="#FF2366" />
            <Text style={styles.sectionTitle}>Semptom ve Belirtiler</Text>
          </View>

          {Object.entries(SYMPTOMS_CATEGORIES).map(([catName, list]) => {
            const isOpen = openCategories.includes(catName);
            const activeCount = getCategoryActiveCount(catName, list);

            return (
              <View key={catName} style={styles.accordionCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => toggleCategory(catName)}
                  style={styles.accordionHeader}
                >
                  <View style={styles.accordionHeaderLeft}>
                    <Text style={styles.accordionTitle}>{catName} Belirtiler</Text>
                    {activeCount > 0 && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>{activeCount}</Text>
                      </View>
                    )}
                  </View>
                  {isOpen ? (
                    <ChevronDown size={18} color="#aaa" />
                  ) : (
                    <ChevronRight size={18} color="#aaa" />
                  )}
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.accordionBody}>
                    <View style={styles.gridContainer}>
                      {list.map((s) => {
                        const isSelected = selectedSymptoms.includes(s);
                        return (
                          <TouchableOpacity
                            key={s}
                            onPress={() => toggleSymptom(s)}
                            style={[
                              styles.tagCell,
                              isSelected && styles.symptomTagSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.tagText,
                                isSelected && styles.tagTextActive,
                              ]}
                            >
                              {s}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      {catName === 'Özel' &&
                        customSymptomsList.map((s) => {
                          const isSelected = selectedSymptoms.includes(s.name);
                          return (
                            <TouchableOpacity
                              key={s.name}
                              onPress={() => toggleSymptom(s.name)}
                              style={[
                                styles.tagCell,
                                isSelected && styles.symptomTagSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.tagText,
                                  isSelected && styles.tagTextActive,
                                ]}
                              >
                                {s.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Add Custom Symptom */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Sparkles size={18} color="#FF9F1C" />
            <Text style={styles.sectionTitle}>Kendi Belirtini Ekle</Text>
          </View>
          <View style={styles.customSymptomRow}>
            <TextInput
              placeholder="Farklı bir belirti yazın..."
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

        {/* Bottom Save Button */}
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <ExpoLinearGradient
            colors={['#FF2366', '#FF4D6D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveGradient}
          >
            <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
          </ExpoLinearGradient>
        </TouchableOpacity>

        <View style={{ height: Math.max(100, insets.bottom + 48) }} />
      </ScrollView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121214',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 32,
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
    backgroundColor: 'rgba(255, 35, 102, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.12)',
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  badgeProgress: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(6, 214, 160, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeProgressText: {
    color: '#06D6A0',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Checklist routine styles
  checklistCard: {
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 16,
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#06D6A0',
    borderRadius: 2,
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkItemCard: {
    width: (Dimensions.get('window').width - 76) / 2,
    backgroundColor: '#1d1d22',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    padding: 12,
  },
  checkItemCardActive: {
    borderColor: 'rgba(6, 214, 160, 0.3)',
    backgroundColor: 'rgba(6, 214, 160, 0.03)',
  },
  checkItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkItemEmoji: {
    fontSize: 20,
  },
  checklistIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistIndicatorActive: {
    backgroundColor: '#06D6A0',
    borderColor: '#06D6A0',
  },
  checkItemLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ccc',
  },
  checkItemDesc: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },

  // Mood section styles
  moodCatBlock: {
    marginBottom: 16,
    backgroundColor: '#18181c',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.01)',
  },
  moodCatTitle: {
    fontSize: 11,
    color: '#888',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodCell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e24',
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  moodEmoji: {
    fontSize: 14,
  },
  moodLabel: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: '500',
  },

  // Accordion lists
  accordionCard: {
    backgroundColor: '#18181c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  activeBadge: {
    backgroundColor: '#FF2366',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  accordionBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    backgroundColor: '#1b1b20',
  },

  // Symptoms tag cells
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagCell: {
    backgroundColor: '#222228',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.01)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  symptomTagSelected: {
    backgroundColor: 'rgba(255, 35, 102, 0.1)',
    borderColor: '#FF2366',
  },
  tagText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  tagTextActive: {
    color: '#FF2366',
    fontWeight: 'bold',
  },

  // Custom addition row
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

  // Save buttons
  saveBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  saveGradient: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  textWhite: {
    color: '#fff',
  },
});
