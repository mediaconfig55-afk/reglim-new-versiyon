import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppStore } from '../../store/store';
import { getCycles, getDailyLog, saveDailyLog, addCycle, getDailyLogsRange } from '../../database/db';
import { calculatePredictions, PredictionResult } from '../../utils/periodEngine';
import { generateAIInsights, getDailyTip, AIInsight } from '../../utils/aiAnalyzer';
import { getUpcomingNotifications } from '../../services/notifications';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { getLocalDateString } from '../../utils/date';
import {
  Flame,
  Droplet,
  Moon,
  TrendingUp,
  Brain,
  Bell,
  Heart,
  Plus,
  Compass,
  Activity,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function DashboardScreen() {
  const router = useRouter();
  const { isPregnancyMode, user } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [predictions, setPredictions] = useState<PredictionResult | null>(null);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [upcomingAlerts, setUpcomingAlerts] = useState<any[]>([]);
  const [dailyTipText, setDailyTipText] = useState('');

  const todayStr = getLocalDateString();

  const loadDashboardData = async () => {
    try {
      let dbCycles = await getCycles();
      
      // 1. Calculate Period Predictions
      const results = calculatePredictions(dbCycles, todayStr);
      setPredictions(results);

      // 2. Fetch/Create Today's Log
      let log = await getDailyLog(todayStr);
      if (!log) {
        log = {
          date: todayStr,
          water_ml: 0,
          sleep_hours: 0,
          weight_kg: undefined,
          moods: [],
          symptoms: [],
          notes: '',
        };
        await saveDailyLog(log);
      }
      setTodayLog(log);

      // 3. Generate AI insights from logs range
      const allLogs = await getDailyLogsRange(
        getLocalDateString(new Date(Date.now() - 90*24*60*60*1000)),
        todayStr
      );
      const insights = generateAIInsights(allLogs, dbCycles);
      setAiInsights(insights);

      // 4. Fetch scheduled native alarms
      const alerts = await getUpcomingNotifications();
      setUpcomingAlerts(alerts.slice(0, 3)); // show top 3

      // 5. Get Daily Tip
      setDailyTipText(getDailyTip(todayStr));

    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [isPregnancyMode])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const incrementWater = async () => {
    if (!todayLog) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = {
      ...todayLog,
      water_ml: (todayLog.water_ml || 0) + 250,
    };
    setTodayLog(updated);
    await saveDailyLog(updated);
  };

  // Determine cycle status wording
  const getCyclePhaseText = () => {
    if (!predictions) return '';
    const today = new Date(todayStr).getTime();
    const nextStart = new Date(predictions.nextPeriodDate).getTime();
    
    // Checks if today is inside predicted period
    const fertileStart = new Date(predictions.fertileWindowStart).getTime();
    const fertileEnd = new Date(predictions.fertileWindowEnd).getTime();
    const ovulation = new Date(predictions.nextOvulationDate).getTime();
    
    if (today >= fertileStart && today <= fertileEnd) {
      if (Math.abs(today - ovulation) < 12 * 60 * 60 * 1000) {
        return 'Yumurtlama Günü';
      }
      return 'Doğurganlık Penceresi';
    }

    const daysLeft = Math.round((nextStart - today) / (1000 * 60 * 60 * 24));
    if (daysLeft === 0) {
      return 'Regl Günü 🎉';
    }
    if (daysLeft < 0 && daysLeft > -5) {
      return 'Regl Dönemi';
    }

    return 'Foliküler Faz';
  };

  const getDaysLeftCount = () => {
    if (!predictions) return 0;
    const today = new Date(todayStr).getTime();
    const nextStart = new Date(predictions.nextPeriodDate).getTime();
    const diff = Math.round((nextStart - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF2366" />}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerWelcome}>Merhaba, {user?.displayName || 'Kullanıcı'} 👋</Text>
            <Text style={styles.headerDate}>
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          {isPregnancyMode && (
            <TouchableOpacity onPress={() => router.push('/pregnancy')} style={styles.pregnancyBadge}>
              <Heart size={14} color="#FFF" fill="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.pregnancyBadgeText}>Gebelik Modu</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pregnancy Mode Redirect Card if active */}
        {isPregnancyMode && (
          <TouchableOpacity onPress={() => router.push('/pregnancy')} style={styles.pregnancyNoticeCard}>
            <ExpoLinearGradient colors={['#7209B7', '#560BAD']} style={styles.pregnancyNoticeGradient}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pregnancyNoticeTitle}>Gebelik Modu Aktif</Text>
                <Text style={styles.pregnancyNoticeSub}>Haftalık bebek gelişimi, trimester raporları ve doğum geri sayımını inceleyin.</Text>
              </View>
              <Compass size={28} color="#fff" />
            </ExpoLinearGradient>
          </TouchableOpacity>
        )}

        {/* 1. Cycle Progress Wheel Container */}
        {!isPregnancyMode && predictions && (
          <View style={styles.wheelContainer}>
            <ExpoLinearGradient colors={['rgba(255, 35, 102, 0.08)', 'rgba(30, 30, 35, 0.6)']} style={styles.wheelBorder}>
              <View style={styles.wheelInner}>
                <Text style={styles.wheelLabel}>{getCyclePhaseText()}</Text>
                <Text style={styles.wheelNumber}>{getDaysLeftCount()}</Text>
                <Text style={styles.wheelUnit}>Gün Kaldı</Text>
                <Text style={styles.wheelSub}>
                  Tahmini Başlangıç: {new Date(predictions.nextPeriodDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            </ExpoLinearGradient>
            
            {/* Quick action bar */}
            <View style={styles.quickActionRow}>
              <TouchableOpacity onPress={() => router.push('/log-day')} style={[styles.logTodayBtn, { backgroundColor: '#FF2366' }]}>
                <Droplet size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.logTodayBtnText}>Regli Başlat</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/tracker')} style={[styles.logTodayBtn, { backgroundColor: '#9B5DE5' }]}>
                <Activity size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.logTodayBtnText}>Takip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => router.push('/log-day')} style={[styles.logTodayBtn, { backgroundColor: '#333' }]}>
                <Plus size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.logTodayBtnText}>Belirti</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 2. Today's Symptoms & Mood Logged */}
        {todayLog && (todayLog.moods.length > 0 || todayLog.symptoms.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bugünkü Kayıtlarınız</Text>
            <View style={styles.tagsContainer}>
              {todayLog.moods.map((m: string) => (
                <View key={m} style={[styles.logTag, styles.moodTag]}>
                  <Text style={styles.logTagText}>😊 {m}</Text>
                </View>
              ))}
              {todayLog.symptoms.map((s: string) => (
                <View key={s} style={[styles.logTag, styles.symptomTag]}>
                  <Text style={styles.logTagText}>🌸 {s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 3. Daily Health Tracker Widgets Grid */}
        <Text style={styles.sectionTitle}>Bugünkü Sağlık Göstergeleri</Text>
        <View style={styles.widgetGrid}>
          {/* Water widget */}
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Droplet size={18} color="#00B4D8" />
              <Text style={styles.widgetTitle}>Su Tüketimi</Text>
            </View>
            <Text style={styles.widgetValue}>{todayLog?.water_ml || 0} ml</Text>
            <Text style={styles.widgetTarget}>Hedef: 2000 ml</Text>
            <TouchableOpacity onPress={incrementWater} style={styles.widgetBtn}>
              <Plus size={16} color="#00B4D8" style={{ marginRight: 4 }} />
              <Text style={styles.widgetBtnText}>+250 ml</Text>
            </TouchableOpacity>
          </View>

          {/* Sleep widget */}
          <TouchableOpacity onPress={() => router.push('/tracker')} style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Moon size={18} color="#9B5DE5" />
              <Text style={styles.widgetTitle}>Uyku Süresi</Text>
            </View>
            <Text style={styles.widgetValue}>{todayLog?.sleep_hours || 0} Sa</Text>
            <Text style={styles.widgetTarget}>Hedef: 8 Saat</Text>
            <Text style={styles.widgetClickText}>Kaydetmek için dokunun</Text>
          </TouchableOpacity>

          {/* Weight widget */}
          <TouchableOpacity onPress={() => router.push('/tracker')} style={styles.widget}>
            <View style={styles.widgetHeader}>
              <TrendingUp size={18} color="#06D6A0" />
              <Text style={styles.widgetTitle}>Kilo Takibi</Text>
            </View>
            <Text style={styles.widgetValue}>{todayLog?.weight_kg || '-'} kg</Text>
            <Text style={styles.widgetTarget}>
              BMI: {
                todayLog?.weight_kg && todayLog?.height_cm 
                  ? (todayLog.weight_kg / Math.pow(todayLog.height_cm / 100, 2)).toFixed(1) 
                  : '-'
              }
            </Text>
            <Text style={styles.widgetClickText}>Kaydetmek için dokunun</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Daily tip advice card */}
        {dailyTipText ? (
          <View style={styles.tipCard}>
            <ExpoLinearGradient colors={['rgba(255, 35, 102, 0.05)', 'rgba(255, 35, 102, 0.02)']} style={styles.tipGradient}>
              <View style={styles.tipHeader}>
                <Flame size={16} color="#FF2366" />
                <Text style={styles.tipHeaderTitle}>GÜNÜN SAĞLIK TAVSİYESİ</Text>
              </View>
              <Text style={styles.tipBody}>{dailyTipText}</Text>
            </ExpoLinearGradient>
          </View>
        ) : null}

        {/* 5. AI Health Insight Centre */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={20} color="#FF2366" />
            <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>Yapay Zeka Analizleri</Text>
          </View>
          
          {aiInsights.map((insight, idx) => (
            <View key={idx} style={[styles.insightCard, styles[`insight_${insight.type}`]]}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDesc}>{insight.description}</Text>
            </View>
          ))}
        </View>

        {/* 6. Upcoming alerts list */}
        {upcomingAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={20} color="#FF2366" />
              <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>Yaklaşan Hatırlatıcılar</Text>
            </View>
            <View style={styles.alertsContainer}>
              {upcomingAlerts.map((alert, idx) => (
                <View key={idx} style={styles.alertRow}>
                  <View style={styles.alertCircle} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertTrigger}>{alert.triggerTime}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Prevent bottom bar truncation */}
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerWelcome: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  pregnancyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7209B7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pregnancyBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pregnancyNoticeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  pregnancyNoticeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  pregnancyNoticeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pregnancyNoticeSub: {
    color: '#e0d0f5',
    fontSize: 12,
    marginTop: 4,
    paddingRight: 10,
  },
  wheelContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  wheelBorder: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: 'rgba(255, 35, 102, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  },
  wheelInner: {
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: '#16161a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  wheelLabel: {
    fontSize: 12,
    color: '#FF2366',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wheelNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 4,
  },
  wheelUnit: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  wheelSub: {
    fontSize: 11,
    color: '#555',
    marginTop: 10,
    textAlign: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  accuracyTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  accuracyText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  logTodayBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTodayBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  logTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  moodTag: {
    backgroundColor: 'rgba(155, 93, 229, 0.08)',
    borderColor: 'rgba(155, 93, 229, 0.2)',
  },
  symptomTag: {
    backgroundColor: 'rgba(255, 35, 102, 0.08)',
    borderColor: 'rgba(255, 35, 102, 0.2)',
  },
  logTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  widgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  widget: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#18181c',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  widgetTitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginLeft: 6,
  },
  widgetValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  widgetTarget: {
    fontSize: 11,
    color: '#555',
    marginTop: 4,
  },
  widgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(0, 180, 216, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 216, 0.15)',
    borderRadius: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  widgetBtnText: {
    color: '#00B4D8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  widgetClickText: {
    fontSize: 10,
    color: '#FF2366',
    marginTop: 12,
    fontWeight: '600',
  },
  tipCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.12)',
  },
  tipGradient: {
    padding: 16,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipHeaderTitle: {
    fontSize: 10,
    color: '#FF2366',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 6,
  },
  tipBody: {
    fontSize: 13,
    color: '#ddd',
    lineHeight: 18,
  },
  insightCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  insight_success: {
    backgroundColor: 'rgba(6, 214, 160, 0.05)',
    borderColor: 'rgba(6, 214, 160, 0.15)',
  },
  insight_warning: {
    backgroundColor: 'rgba(255, 183, 3, 0.05)',
    borderColor: 'rgba(255, 183, 3, 0.15)',
  },
  insight_info: {
    backgroundColor: 'rgba(0, 180, 216, 0.05)',
    borderColor: 'rgba(0, 180, 216, 0.15)',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  insightDesc: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 16,
  },
  alertsContainer: {
    backgroundColor: '#18181c',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF2366',
  },
  alertTitle: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  alertTrigger: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
});
