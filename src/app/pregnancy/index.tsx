import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomAlert } from '../../components/ui/custom-alert';
import { useRouter } from 'expo-router';
import { getPregnancyData, savePregnancyData, deactivatePregnancy } from '../../database/db';
import { useAppStore } from '../../store/store';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Heart, ChevronLeft, Calendar, Sparkles, Smile, Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../../utils/date';

/**
 * Calculate gestational age from LMP date (UTC-safe).
 * Returns { weeks, days, trimester, dueDate }
 */
function calcGestationalAge(lmpDateStr: string) {
  const lmpUtc   = new Date(lmpDateStr + 'T00:00:00Z');
  const todayUtc = new Date(getLocalDateString() + 'T00:00:00Z');
  const totalDays = Math.max(0, Math.floor(
    (todayUtc.getTime() - lmpUtc.getTime()) / (1000 * 60 * 60 * 24)
  ));
  const weeks    = Math.floor(totalDays / 7);
  const days     = totalDays % 7;
  const trimester = weeks <= 13 ? 1 : weeks <= 27 ? 2 : 3;

  const dueDateUtc = new Date(lmpUtc.getTime() + 280 * 24 * 60 * 60 * 1000);
  const dueDate = getLocalDateString(dueDateUtc);

  return { weeks, days, trimester, dueDate };
}

/**
 * Validates a YYYY-MM-DD string and checks it is not in the future
 * and not more than 42 weeks ago (obstetric limit).
 */
function validateLmpDate(input: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return 'Tarihi YYYY-AA-GG formatında giriniz (Örn: 2026-04-15)';

  const [year, month, day] = input.split('-').map(Number);
  if (month < 1 || month > 12) return 'Geçerli bir ay giriniz (01-12)';
  if (day < 1 || day > 31)     return 'Geçerli bir gün giriniz (01-31)';

  const entered  = new Date(input + 'T00:00:00Z');
  const todayUtc = new Date(getLocalDateString() + 'T00:00:00Z');

  if (entered > todayUtc) return 'Son adet tarihi bugünden ileri bir tarih olamaz';

  const maxPastMs = 42 * 7 * 24 * 60 * 60 * 1000; // 42 weeks
  if (todayUtc.getTime() - entered.getTime() > maxPastMs) {
    return '42 haftadan önceye ait bir tarih giremezsiniz';
  }

  return null; // valid
}

export default function PregnancyScreen() {
  const router = useRouter();
  const { setPregnancyMode } = useAppStore();
  const insets = useSafeAreaInsets();

  const [loading,   setLoading]   = useState(true);
  const [hasData,   setHasData]   = useState(false);

  // Calculated display values
  const [week,      setWeek]      = useState(0);
  const [day,       setDay]       = useState(0);
  const [trimester, setTrimester] = useState(1);
  const [dueDateStr, setDueDateStr] = useState('');
  const [lmpDateStr, setLmpDateStr] = useState('');

  // Setup-form state (when no data exists yet)
  const [inputLmp,  setInputLmp]  = useState('');
  const [inputErr,  setInputErr]  = useState('');

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'question';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {},
  });

  const loadPregnancyInfo = useCallback(async () => {
    try {
      const data = await getPregnancyData();
      if (data) {
        const { weeks, days, trimester: tri, dueDate } = calcGestationalAge(data.lmp_date);
        setWeek(weeks);
        setDay(days);
        setTrimester(tri);
        setDueDateStr(dueDate);
        setLmpDateStr(data.lmp_date);
        setHasData(true);
      } else {
        setHasData(false);
      }
    } catch (e) {
      console.error('Failed to load pregnancy details:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadPregnancyInfo();
    });
  }, [loadPregnancyInfo]);

  // ── Setup form handler ───────────────────────────────────────────────────────
  const handleSetup = async () => {
    const err = validateLmpDate(inputLmp);
    if (err) { setInputErr(err); return; }
    setInputErr('');

    const { dueDate } = calcGestationalAge(inputLmp);
    const ok = await savePregnancyData(inputLmp, dueDate);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadPregnancyInfo();
    }
  };

  // ── Deactivate handler ───────────────────────────────────────────────────────
  const handleDeactivate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAlertConfig({
      visible: true,
      title: 'Gebelik Takibini Kapat',
      message: 'Gebelik modunu kapatıp adet döngüsü takip moduna geri dönmek istediğinize emin misiniz?',
      type: 'question',
      confirmText: 'Modu Değiştir',
      cancelText: 'İptal',
      onCancel: () => setAlertConfig(prev => ({ ...prev, visible: false })),
      onConfirm: async () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        await deactivatePregnancy();
        setPregnancyMode(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      }
    });
  };

  // ── Fruit / development data ────────────────────────────────────────────────
  const getBabySizeFruit = (wk: number) => {
    if (wk <= 4)  return { fruit: 'Haşhaş Tohumu', icon: '🌱', size: '1 mm' };
    if (wk <= 8)  return { fruit: 'Ahududu',       icon: '🍓', size: '1.6 cm' };
    if (wk <= 12) return { fruit: 'Limon',          icon: '🍋', size: '5.4 cm' };
    if (wk <= 16) return { fruit: 'Avokado',        icon: '🥑', size: '11.6 cm' };
    if (wk <= 20) return { fruit: 'Muz',            icon: '🍌', size: '25.6 cm' };
    if (wk <= 24) return { fruit: 'Kavun',          icon: '🍈', size: '30 cm' };
    if (wk <= 28) return { fruit: 'Patlıcan',       icon: '🍆', size: '37.6 cm' };
    if (wk <= 32) return { fruit: 'Balkabağı',      icon: '🎃', size: '42.4 cm' };
    return { fruit: 'Karpuz', icon: '🍉', size: '50.7 cm' };
  };

  const getDevelopmentDetails = (wk: number) => {
    if (wk <= 12) return {
      baby: 'Bebeğinizin organları gelişmeye başlıyor. Tırnakları, parmakları ve yüz hatları şekilleniyor. Kalp atışı ultrason ile net duyulabilir.',
      mother: 'Mide bulantıları ve koku hassasiyeti yavaş yavaş azalabilir. Rahminiz büyüdükçe idrara çıkma sıklığınız artacaktır.',
      tip: 'Folik asit takviyesini doktor kontrolünde almaya devam edin ve bol bol dinlenin. Hafif yürüyüşler yapabilirsiniz.',
    };
    if (wk <= 27) return {
      baby: 'Bebeğiniz artık sesleri duyabiliyor ve hareketlerini hissettirmeye başlıyor. Kaşları ve saçları çıkıyor. Göz kırpma refleksi gelişiyor.',
      mother: 'Hamileliğin en enerjik dönemi! Cildinizde hormonal parlama görülebilir. Karın büyümesiyle birlikte bel ağrıları yaşanabilir.',
      tip: 'Kalsiyum ve demir emilimi için öğünlerinizi düzenleyin. Varis oluşumunu engellemek için uzun süre hareketsiz ayakta kalmayın.',
    };
    return {
      baby: 'Bebeğinizin akciğer gelişimi tamamlanmak üzere. Düzenli uyku döngüleri geliştiriyor. Pozisyonunu doğum için yavaşça aşağıya doğru çeviriyor.',
      mother: 'Nefes darlığı ve mide yanmaları sıklaşabilir. Bebeğin baskısı nedeniyle mesane kapasitesi iyice daralır ve uykuya dalmak zorlaşır.',
      tip: 'Doğum çantanızı hazırlamaya başlayın. Nefes egzersizleri yapın ve sol tarafınıza yatarak uyumaya özen gösterin.',
    };
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7209B7" />
      </View>
    );
  }

  // ── Setup screen (no pregnancy data yet) ────────────────────────────────────
  if (!hasData) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <ChevronLeft size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Gebelik Takibi Kurulumu</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.setupCard}>
              <Text style={styles.setupEmoji}>🤰</Text>
              <Text style={styles.setupTitle}>Son Adet Tarihinizi Girin</Text>
              <Text style={styles.setupDesc}>
                Hafta ve gün hesaplaması için son adet başlangıç tarihinizi (LMP) doğru
                girmeniz çok önemlidir. Bu bilgi doktor kontrolünde belirlenenle örtüşmelidir.
              </Text>

              <View style={styles.infoRow}>
                <Info size={14} color="#7209B7" />
                <Text style={styles.infoText}>
                  YYYY-AA-GG formatında giriniz (örn: 2026-04-15)
                </Text>
              </View>

              <TextInput
                style={[styles.lmpInput, inputErr ? styles.lmpInputError : null]}
                placeholder="2026-04-15"
                placeholderTextColor="#444"
                value={inputLmp}
                onChangeText={(t) => { setInputLmp(t); setInputErr(''); }}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleSetup}
              />

              {inputErr ? <Text style={styles.inputErrText}>{inputErr}</Text> : null}

              <TouchableOpacity style={styles.setupBtn} onPress={handleSetup}>
                <Text style={styles.setupBtnText}>Gebelik Takibini Başlat 🌸</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleDeactivate} style={styles.deactivateSetupBtn}>
                <Text style={styles.deactivateBtnText}>Adet Takvimine Geri Dön</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Main tracking screen ─────────────────────────────────────────────────────
  const fruitInfo = getBabySizeFruit(week);
  const devDetails = getDevelopmentDetails(week);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gebelik Takip Asistanı</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Countdown card ── */}
        <View style={styles.countdownCard}>
          <LinearGradient colors={['#7209B7', '#3f37c9']} style={styles.gradientCard}>
            <View style={styles.countdownRow}>
              <View>
                <Text style={styles.trimesterLabel}>{trimester}. Trimester</Text>
                <Text style={styles.weekNumber}>{week}</Text>
                <Text style={styles.weekUnit}>
                  Hafta{day > 0 ? `, ${day} Gün` : ''}
                </Text>
                <Text style={styles.lmpLine}>
                  Son adet: {new Date(lmpDateStr + 'T12:00:00').toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.fruitCircle}>
                <Text style={styles.fruitIcon}>{fruitInfo.icon}</Text>
                <Text style={styles.fruitName}>{fruitInfo.fruit}</Text>
                <Text style={styles.fruitSize}>{fruitInfo.size}</Text>
              </View>
            </View>

            <View style={styles.progressFooter}>
              <Calendar size={14} color="#ddd" style={{ marginRight: 6 }} />
              <Text style={styles.progressFooterText}>
                Tahmini Doğum:{' '}
                {new Date(dueDateStr + 'T12:00:00').toLocaleDateString('tr-TR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Baby development ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Smile size={18} color="#7209B7" />
            <Text style={styles.infoCardTitle}>Bebek Gelişimi</Text>
          </View>
          <Text style={styles.infoCardBody}>{devDetails.baby}</Text>
        </View>

        {/* ── Mother changes ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Heart size={18} color="#7209B7" fill="#7209B7" />
            <Text style={styles.infoCardTitle}>Annedeki Değişimler</Text>
          </View>
          <Text style={styles.infoCardBody}>{devDetails.mother}</Text>
        </View>

        {/* ── Tip ── */}
        <View style={[styles.infoCard, styles.tipCard]}>
          <View style={styles.infoTitleRow}>
            <Sparkles size={18} color="#FFD166" />
            <Text style={[styles.infoCardTitle, { color: '#FFD166' }]}>Haftalık Tavsiye</Text>
          </View>
          <Text style={[styles.infoCardBody, { color: '#eee' }]}>{devDetails.tip}</Text>
        </View>

        {/* ── LMP update note ── */}
        <TouchableOpacity
          style={styles.updateLmpBtn}
          onPress={() => {
            setAlertConfig({
              visible: true,
              title: 'Son Adet Tarihini Güncelle',
              message: 'Tarihi güncellemek için gebelik takibini kapatıp yeniden başlatın.',
              type: 'info',
              onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
            });
          }}
        >
          <Text style={styles.updateLmpText}>Son adet tarihini güncelle →</Text>
        </TouchableOpacity>

        {/* ── Deactivate ── */}
        <TouchableOpacity onPress={handleDeactivate} style={styles.deactivateBtn}>
          <Text style={styles.deactivateBtnText}>Adet Takvimine Geri Dön</Text>
        </TouchableOpacity>

      </ScrollView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121214' },
  loadingContainer: { flex: 1, backgroundColor: '#121214', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },

  // ── Setup screen ──
  setupCard: {
    backgroundColor: '#18181c', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(114,9,183,0.2)', alignItems: 'center',
  },
  setupEmoji:  { fontSize: 52, marginBottom: 12 },
  setupTitle:  { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  setupDesc:   { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(114,9,183,0.08)',
                 borderRadius: 10, padding: 10, marginBottom: 16, gap: 8, width: '100%' },
  infoText:    { fontSize: 12, color: '#9B5DE5', flex: 1 },

  lmpInput: {
    width: '100%', height: 52, backgroundColor: '#1e1e24',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(114,9,183,0.3)',
    color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center',
    letterSpacing: 2, marginBottom: 6,
  },
  lmpInputError: { borderColor: '#FF4444' },
  inputErrText:  { color: '#FF4444', fontSize: 12, marginBottom: 12, textAlign: 'center' },

  setupBtn: {
    marginTop: 12, backgroundColor: '#7209B7', borderRadius: 16,
    height: 52, width: '100%', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#7209B7', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  setupBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  deactivateSetupBtn: {
    marginTop: 16, height: 44, width: '100%',
    borderRadius: 14, borderWidth: 1, borderColor: '#FF2366',
    backgroundColor: 'rgba(255,35,102,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Tracking card ──
  countdownCard: {
    borderRadius: 24, overflow: 'hidden', marginBottom: 24,
    shadowColor: '#7209B7', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 8,
  },
  gradientCard: { padding: 24 },
  countdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trimesterLabel: { color: '#eee', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  weekNumber:    { fontSize: 64, fontWeight: 'bold', color: '#fff', lineHeight: 72 },
  weekUnit:      { fontSize: 16, color: '#fff', fontWeight: '600' },
  lmpLine:       { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 6 },

  fruitCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  fruitIcon: { fontSize: 32 },
  fruitName: { fontSize: 10, fontWeight: 'bold', color: '#fff', marginTop: 4, textAlign: 'center' },
  fruitSize: { fontSize: 9, color: '#ddd', marginTop: 2 },

  progressFooter: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 16, marginTop: 20,
  },
  progressFooterText: { color: '#eee', fontSize: 12, fontWeight: '500' },

  infoCard: {
    backgroundColor: '#18181c', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
    padding: 16, marginBottom: 20,
  },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
  infoCardBody:  { fontSize: 13, color: '#aaa', lineHeight: 18 },
  tipCard: { backgroundColor: 'rgba(114,9,183,0.08)', borderColor: 'rgba(114,9,183,0.2)' },

  updateLmpBtn: { alignItems: 'center', marginBottom: 12 },
  updateLmpText: { color: '#7209B7', fontSize: 13, fontWeight: '600' },

  deactivateBtn: {
    height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#FF2366',
    backgroundColor: 'rgba(255,35,102,0.05)', justifyContent: 'center', alignItems: 'center',
  },
  deactivateBtnText: { color: '#FF2366', fontSize: 14, fontWeight: 'bold' },
});
