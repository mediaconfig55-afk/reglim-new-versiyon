import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getPregnancyData, savePregnancyData, deactivatePregnancy } from '../../database/db';
import { useAppStore } from '../../store/store';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, ChevronLeft, Calendar, Compass, Sparkles, Smile, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../../utils/date';

export default function PregnancyScreen() {
  const router = useRouter();
  const { setPregnancyMode } = useAppStore();

  const [lmpDateStr, setLmpDateStr] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [week, setWeek] = useState(12); // default placeholder if no DB record
  const [day, setDay] = useState(3);
  const [trimester, setTrimester] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadPregnancyInfo = useCallback(async () => {
    try {
      const data = await getPregnancyData();
      if (data) {
        setLmpDateStr(data.lmp_date);
        setDueDateStr(data.due_date);
        
        // Calculate weeks and days passed since LMP
        const lmp = new Date(data.lmp_date);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - lmp.getTime());
        const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        const calcWeeks = Math.floor(totalDays / 7);
        const calcDays = totalDays % 7;
        
        setWeek(calcWeeks || 1);
        setDay(calcDays);

        // Determine trimester
        if (calcWeeks <= 13) setTrimester(1);
        else if (calcWeeks <= 27) setTrimester(2);
        else setTrimester(3);
      } else {
        // Seed default LMP (e.g. 87 days ago) if empty
        const defaultLmp = new Date();
        defaultLmp.setDate(defaultLmp.getDate() - 87);
        const lmpStr = getLocalDateString(defaultLmp);
        
        // Due date = lmp + 280 days
        const defaultDue = new Date(defaultLmp.getTime() + 280*24*60*60*1000);
        const dueStr = getLocalDateString(defaultDue);
        
        await savePregnancyData(lmpStr, dueStr);
        setLmpDateStr(lmpStr);
        setDueDateStr(dueStr);
        setWeek(12);
        setDay(3);
        setTrimester(1);
      }
    } catch (e) {
      console.error('Failed to load pregnancy details:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPregnancyInfo();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPregnancyInfo]);

  const handleDeactivate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Gebelik Takibini Kapat',
      'Gebelik modunu kapatıp adet döngüsü takip moduna geri dönmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Modu Değiştir',
          style: 'destructive',
          onPress: async () => {
            await deactivatePregnancy();
            setPregnancyMode(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const getBabySizeFruit = (wk: number) => {
    if (wk <= 4) return { fruit: 'Haşhaş Tohumu', icon: '🌱', size: '1 mm' };
    if (wk <= 8) return { fruit: 'Ahududu', icon: '🍓', size: '1.6 cm' };
    if (wk <= 12) return { fruit: 'Limon', icon: '🍋', size: '5.4 cm' };
    if (wk <= 16) return { fruit: 'Avokado', icon: '🥑', size: '11.6 cm' };
    if (wk <= 20) return { fruit: 'Muz', icon: '🍌', size: '25.6 cm' };
    if (wk <= 24) return { fruit: 'Kavun', icon: '🍈', size: '30 cm' };
    if (wk <= 28) return { fruit: 'Patlıcan', icon: '🍆', size: '37.6 cm' };
    if (wk <= 32) return { fruit: 'Balkabağı', icon: '🎃', size: '42.4 cm' };
    return { fruit: 'Karpuz', icon: '🍉', size: '50.7 cm' };
  };

  const getDevelopmentDetails = (wk: number) => {
    if (wk <= 12) {
      return {
        baby: 'Bebeğinizin organları gelişmeye başlıyor. Tırnakları, parmakları ve yüz hatları şekilleniyor. Kalp atışı ultrason ile net duyulabilir.',
        mother: 'Mide bulantıları ve koku hassasiyeti yavaş yavaş azalabilir. Rahminiz büyüdükçe idrara çıkma sıklığınız artacaktır.',
        tip: 'Folik asit takviyesini doktor kontrolünde almaya devam edin ve bol bol dinlenin. Hafif yürüyüşler yapabilirsiniz.',
      };
    }
    if (wk <= 27) {
      return {
        baby: 'Bebeğiniz artık sesleri duyabiliyor ve hareketlerini hissettirmeye başlıyor. Kaşları ve saçları çıkıyor. Göz kırpma refleksi gelişiyor.',
        mother: 'Hamileliğin en enerjik dönemi! Cildinizde hormonal parlama görülebilir. Karın büyümesiyle birlikte bel ağrıları yaşanabilir.',
        tip: 'Kalsiyum ve demir emilimi için öğünlerinizi düzenleyin. Varis oluşumunu engellemek için uzun süre hareketsiz ayakta kalmayın.',
      };
    }
    return {
      baby: 'Bebeğinizin akciğer gelişimi tamamlanmak üzere. Düzenli uyku döngüleri geliştiriyor. Pozisyonunu doğum için yavaşça aşağıya doğru çeviriyor.',
      mother: 'Nefes darlığı ve mide yanmaları sıklaşabilir. Bebeğin baskısı nedeniyle mesane kapasitesi iyice daralır ve uykuya dalmak zorlaşır.',
      tip: 'Doğum çantanızı hazırlamaya başlayın. Nefes egzersizleri yapın ve sol tarafınıza yatarak uyumaya özen gösterin.',
    };
  };

  const fruitInfo = getBabySizeFruit(week);
  const devDetails = getDevelopmentDetails(week);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7209B7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Back and title header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gebelik Takip Asistanı</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 1. Countdown Ring progress */}
        <View style={styles.countdownCard}>
          <LinearGradient colors={['#7209B7', '#3f37c9']} style={styles.gradientCard}>
            <View style={styles.countdownRow}>
              <View>
                <Text style={styles.trimesterLabel}>{trimester}. Trimester</Text>
                <Text style={styles.weekNumber}>{week}</Text>
                <Text style={styles.weekUnit}>Hafta, {day} Günlük</Text>
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
                Tahmini Doğum: {new Date(dueDateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* 2. Baby development */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Smile size={18} color="#7209B7" />
            <Text style={styles.infoCardTitle}>Bebek Gelişimi</Text>
          </View>
          <Text style={styles.infoCardBody}>{devDetails.baby}</Text>
        </View>

        {/* 3. Mother body changes */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Heart size={18} color="#7209B7" fill="#7209B7" />
            <Text style={styles.infoCardTitle}>Annedeki Değişimler</Text>
          </View>
          <Text style={styles.infoCardBody}>{devDetails.mother}</Text>
        </View>

        {/* 4. Suggestion tip */}
        <View style={[styles.infoCard, styles.tipCard]}>
          <View style={styles.infoTitleRow}>
            <Sparkles size={18} color="#FFD166" />
            <Text style={[styles.infoCardTitle, { color: '#FFD166' }]}>Haftalık Tavsiye</Text>
          </View>
          <Text style={[styles.infoCardBody, { color: '#eee' }]}>{devDetails.tip}</Text>
        </View>

        {/* Deactivate button */}
        <TouchableOpacity onPress={handleDeactivate} style={styles.deactivateBtn}>
          <Text style={styles.deactivateBtnText}>Adet Takvimine Geri Dön</Text>
        </TouchableOpacity>

      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  countdownCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#7209B7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  gradientCard: {
    padding: 24,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trimesterLabel: {
    color: '#eee',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  weekNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 72,
  },
  weekUnit: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  fruitCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fruitIcon: {
    fontSize: 32,
  },
  fruitName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  fruitSize: {
    fontSize: 9,
    color: '#ddd',
    marginTop: 2,
  },
  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 16,
    marginTop: 20,
  },
  progressFooterText: {
    color: '#eee',
    fontSize: 12,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#18181c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    marginBottom: 20,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  infoCardBody: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
  },
  tipCard: {
    backgroundColor: 'rgba(114, 9, 183, 0.08)',
    borderColor: 'rgba(114, 9, 183, 0.2)',
  },
  deactivateBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF2366',
    backgroundColor: 'rgba(255, 35, 102, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  deactivateBtnText: {
    color: '#FF2366',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
