import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/store';
import {
  getCycles,
  getDailyLog,
  saveDailyLog,
  addCycle,
  getDailyLogsRange,
  getActiveCycle,
  endCycle,
} from '../../database/db';
import { calculatePredictions, PredictionResult } from '../../utils/periodEngine';
import { generateAIInsights, getDailyTip, AIInsight } from '../../utils/aiAnalyzer';
import { getUpcomingNotifications, scheduleCycleAlert, scheduleOvulationAlert, cancelAllCycleAlerts } from '../../services/notifications';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { getLocalDateString } from '../../utils/date';
import { useTheme } from '../../constants/theme';
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
  X,
  CheckCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { isPregnancyMode, user, contraceptiveConfig } = useAppStore();
  const insets = useSafeAreaInsets();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core data
  const [predictions, setPredictions]   = useState<PredictionResult | null>(null);
  const [todayLog, setTodayLog]         = useState<any>(null);
  const [aiInsights, setAiInsights]     = useState<AIInsight[]>([]);
  const [upcomingAlerts, setUpcomingAlerts] = useState<any[]>([]);
  const [dailyTipText, setDailyTipText] = useState('');
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // Period tracking
  const [activeCycle, setActiveCycle]         = useState<any>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [periodLogs, setPeriodLogs]           = useState<any[]>([]);
  const [periodDuration, setPeriodDuration]   = useState(0);

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    emoji: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    emoji: '',
    confirmText: '',
    cancelText: '',
    onConfirm: () => {},
  });

  // Pulse animation states (two rings for ripple effect)
  const [pulse1Scale]   = useState(() => new Animated.Value(1));
  const [pulse1Opacity] = useState(() => new Animated.Value(0.55));
  const [pulse2Scale]   = useState(() => new Animated.Value(1));
  const [pulse2Opacity] = useState(() => new Animated.Value(0));
  const anim2Ref      = useRef<Animated.CompositeAnimation | null>(null);
  const timeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayStr = getLocalDateString();

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadDashboardData = async () => {
    try {
      const dbCycles = await getCycles();

      // Active period check
      const active = await getActiveCycle();
      setActiveCycle(active);

      // Predictions
      const results = calculatePredictions(dbCycles, todayStr, user?.avgCycleLength, user?.avgPeriodLength);
      setPredictions(results);

      // Schedule or cancel cycle alerts dynamically
      if (isPregnancyMode) {
        await cancelAllCycleAlerts();
      } else if (results) {
        await cancelAllCycleAlerts();
        await scheduleCycleAlert(2, results.nextPeriodDate);
        await scheduleOvulationAlert(results.nextOvulationDate);
      }

      // Today's log
      let log = await getDailyLog(todayStr);
      if (!log) {
        log = { date: todayStr, water_ml: 0, sleep_hours: 0, moods: [], symptoms: [], notes: '', steps: 0 };
        await saveDailyLog(log);
      }
      setTodayLog(log);

      // AI insights (last 90 days)
      const allLogs = await getDailyLogsRange(
        getLocalDateString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
        todayStr
      );
      setRecentLogs(allLogs);
      setAiInsights(generateAIInsights(allLogs, dbCycles));

      // Notifications
      const alerts = await getUpcomingNotifications();
      setUpcomingAlerts(alerts.slice(0, 3));

      // Daily tip
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

  // ── Pulse animation (runs when a period is active) ────────────────────────
  useEffect(() => {
    const makePulse = (scale: Animated.Value, opacity: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1.22, duration: 1150, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,    duration: 1150, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1,    duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.55, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );

    if (activeCycle) {
      const anim1 = makePulse(pulse1Scale, pulse1Opacity);
      anim1.start();

      timeoutRef.current = setTimeout(() => {
        const anim2 = makePulse(pulse2Scale, pulse2Opacity);
        anim2Ref.current = anim2;
        anim2.start();
      }, 575);

      return () => {
        anim1.stop();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (anim2Ref.current) anim2Ref.current.stop();
        pulse1Scale.setValue(1);   pulse1Opacity.setValue(0.55);
        pulse2Scale.setValue(1);   pulse2Opacity.setValue(0);
      };
    }
  }, [activeCycle]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleRefresh = () => { setRefreshing(true); loadDashboardData(); };

  const incrementWater = async () => {
    if (!todayLog) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...todayLog, water_ml: (todayLog.water_ml || 0) + 250 };
    setTodayLog(updated);
    await saveDailyLog(updated);
  };

  const incrementSleep = async () => {
    if (!todayLog) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...todayLog, sleep_hours: Math.min(24, (todayLog.sleep_hours || 0) + 1) };
    setTodayLog(updated);
    await saveDailyLog(updated);
  };

  const incrementSteps = async () => {
    if (!todayLog) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...todayLog, steps: (todayLog.steps || 0) + 1000 };
    setTodayLog(updated);
    await saveDailyLog(updated);
  };

  const handleStartPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const displayDate = new Date(todayStr + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    setConfirmModal({
      visible: true,
      title: 'Regli Başlat',
      message: `Bugün (${displayDate}) regl başlangıcını kaydetmek istiyor musunuz?`,
      emoji: '🩸',
      confirmText: 'Başlat',
      cancelText: 'Vazgeç',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        const ok = await addCycle(todayStr);
        if (ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await loadDashboardData();
        }
      }
    });
  };

  const handleEndPeriod = () => {
    if (!activeCycle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const startUtc = new Date(activeCycle.start_date + 'T00:00:00Z');
    const todayUtc = new Date(todayStr + 'T00:00:00Z');
    const days = Math.round((todayUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    setConfirmModal({
      visible: true,
      title: 'Regli Bitir',
      message: `${days} günlük regl dönemini bitirmek istiyor musunuz?`,
      emoji: '✅',
      confirmText: 'Bitir',
      cancelText: 'Vazgeç',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        const ok = await endCycle(activeCycle.id, todayStr, activeCycle.start_date);
        if (ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const logs = await getDailyLogsRange(activeCycle.start_date, todayStr);
          setPeriodLogs(logs);
          setPeriodDuration(days);
          setActiveCycle(null);
          setShowSummaryModal(true);
          loadDashboardData();
        }
      }
    });
  };

  // ── Cycle helpers ─────────────────────────────────────────────────────────────
  const getCyclePhaseText = () => {
    if (!predictions) return '';
    const today      = new Date(todayStr + 'T00:00:00Z').getTime();
    const nextStart  = new Date(predictions.nextPeriodDate + 'T00:00:00Z').getTime();
    const fertileStart = new Date(predictions.fertileWindowStart + 'T00:00:00Z').getTime();
    const fertileEnd   = new Date(predictions.fertileWindowEnd   + 'T00:00:00Z').getTime();
    const ovulation    = new Date(predictions.nextOvulationDate  + 'T00:00:00Z').getTime();

    if (today >= fertileStart && today <= fertileEnd) {
      return Math.abs(today - ovulation) < 12 * 3600 * 1000 ? 'Yumurtlama Günü' : 'Doğurganlık Penceresi';
    }
    const daysLeft = Math.round((nextStart - today) / (1000 * 60 * 60 * 24));
    if (daysLeft === 0)               return 'Regl Günü 🎉';
    if (daysLeft < 0 && daysLeft > -5) return 'Regl Dönemi';
    return 'Foliküler Faz';
  };

  const getDaysLeftCount = () => {
    if (!predictions) return 0;
    const today     = new Date(todayStr + 'T00:00:00Z').getTime();
    const nextStart = new Date(predictions.nextPeriodDate + 'T00:00:00Z').getTime();
    const diff = Math.round((nextStart - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  };

  const getActivePeriodDay = () => {
    if (!activeCycle) return 1;
    const startUtc = new Date(activeCycle.start_date + 'T00:00:00Z').getTime();
    const todayUtc = new Date(todayStr + 'T00:00:00Z').getTime();
    return Math.round((todayUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  };

  // ── Period summary helpers ───────────────────────────────────────────────────
  const getAllMoods = () => {
    const cnt: Record<string, number> = {};
    periodLogs.forEach(l => (l.moods || []).forEach((m: string) => { cnt[m] = (cnt[m] || 0) + 1; }));
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  };

  const getAllSymptoms = () => {
    const cnt: Record<string, number> = {};
    periodLogs.forEach(l => (l.symptoms || []).forEach((s: string) => { cnt[s] = (cnt[s] || 0) + 1; }));
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  };

  const getPeriodNotes = () =>
    periodLogs.filter(l => l.notes && l.notes.trim().length > 0);

  const getPillPackPills = () => {
    if (!contraceptiveConfig.enabled || !contraceptiveConfig.startDate) return [];
    
    try {
      const start = new Date(contraceptiveConfig.startDate + 'T00:00:00');
      const today = new Date(todayStr + 'T00:00:00');
      const diffTime = today.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return []; // Future start date
      
      const pillsCount = contraceptiveConfig.pillsInPack; // 21 or 28
      const totalCycleDays = contraceptiveConfig.packModel === '21_7' ? 28 : pillsCount;
      
      const currentPackNumber = Math.floor(diffDays / totalCycleDays);
      const currentPackStart = new Date(start.getTime());
      currentPackStart.setDate(currentPackStart.getDate() + currentPackNumber * totalCycleDays);
      
      const pills = [];
      for (let i = 1; i <= pillsCount; i++) {
        const pillDate = new Date(currentPackStart.getTime());
        pillDate.setDate(pillDate.getDate() + (i - 1));
        
        const pillDateStr = pillDate.toISOString().split('T')[0];
        const isToday = pillDateStr === todayStr;
        const isFuture = pillDate.getTime() > today.getTime();
        
        // Find log for this date in recentLogs
        const log = recentLogs.find(l => l.date === pillDateStr);
        const isTaken = !!(log && log.symptoms && log.symptoms.includes('Doğum Kontrol Hapı'));
        
        pills.push({
          index: i,
          dateStr: pillDateStr,
          isToday,
          isFuture,
          isTaken,
        });
      }
      return pills;
    } catch (e) {
      console.error('Error generating contraceptive pack layout:', e);
      return [];
    }
  };

  const handleToggleTodayPill = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let currentSymptoms = todayLog?.symptoms ? [...todayLog.symptoms] : [];
      const hasPill = currentSymptoms.includes('Doğum Kontrol Hapı');
      
      if (hasPill) {
        currentSymptoms = currentSymptoms.filter(s => s !== 'Doğum Kontrol Hapı');
      } else {
        currentSymptoms.push('Doğum Kontrol Hapı');
      }
      
      const updatedLog = {
        ...todayLog,
        date: todayStr,
        symptoms: currentSymptoms,
      };
      
      await saveDailyLog(updatedLog);
      setTodayLog(updatedLog);
      
      // Update recentLogs list for the pack visual grid representation
      setRecentLogs(prev => {
        const filtered = prev.filter(l => l.date !== todayStr);
        return [...filtered, updatedLog];
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Failed to toggle today pill status:', e);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <ExpoLinearGradient colors={theme.bgGradient} style={styles.container}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
        >
        {/* Header */}
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

        {/* Pregnancy notice card */}
        {isPregnancyMode && (
          <TouchableOpacity onPress={() => router.push('/pregnancy')} style={styles.pregnancyNoticeCard}>
            <ExpoLinearGradient colors={['#7209B7', '#560BAD']} style={styles.pregnancyNoticeGradient}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pregnancyNoticeTitle}>Gebelik Modu Aktif</Text>
                <Text style={styles.pregnancyNoticeSub}>
                  Haftalık bebek gelişimi, trimester raporları ve doğum geri sayımını inceleyin.
                </Text>
              </View>
              <Compass size={28} color="#fff" />
            </ExpoLinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Cycle Wheel ─────────────────────────────────────────────────────── */}
        {!isPregnancyMode && predictions && (
          <View style={styles.wheelContainer}>

            {/* Pulsing rings (active period only) */}
            {activeCycle && (
              <>
                <Animated.View
                  style={[
                    styles.pulseRing,
                    { transform: [{ scale: pulse1Scale }], opacity: pulse1Opacity },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.pulseRing,
                    { transform: [{ scale: pulse2Scale }], opacity: pulse2Opacity },
                  ]}
                />
              </>
            )}

            <ExpoLinearGradient
              colors={
                activeCycle
                  ? [theme.primary + '59', theme.primary + 'A6']
                  : [theme.primary + '14', 'rgba(30, 30, 35, 0.6)']
              }
              style={[styles.wheelBorder, { borderColor: theme.primary + '33' }, activeCycle && [styles.wheelBorderActive, { borderColor: theme.primary + 'C0' }]]}
            >
              <View style={[styles.wheelInner, activeCycle && styles.wheelInnerActive]}>
                {activeCycle ? (
                  <>
                    <Text style={[styles.wheelLabel, styles.wheelLabelActive]}>🩸 Regl Dönemi</Text>
                    <Text style={styles.wheelNumber}>{getActivePeriodDay()}</Text>
                    <Text style={styles.wheelUnit}>. Gün</Text>
                    <Text style={styles.wheelSub}>
                      Başladı:{' '}
                      {new Date(activeCycle.start_date + 'T12:00:00').toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'short',
                      })}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.wheelLabel}>{getCyclePhaseText()}</Text>
                    <Text style={styles.wheelNumber}>{getDaysLeftCount()}</Text>
                    <Text style={styles.wheelUnit}>Gün Kaldı</Text>
                    <Text style={styles.wheelSub}>
                      Tahmini Başlangıç:{' '}
                      {new Date(predictions.nextPeriodDate + 'T12:00:00').toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'short',
                      })}
                    </Text>
                  </>
                )}
              </View>
            </ExpoLinearGradient>

            {/* Action row */}
            <View style={styles.quickActionRow}>
              {activeCycle ? (
                <TouchableOpacity
                  onPress={handleEndPeriod}
                  style={[styles.logTodayBtn, styles.endPeriodBtn]}
                >
                  <CheckCircle size={16} color="#FFF" style={{ marginRight: 5 }} />
                  <Text style={styles.logTodayBtnText}>Regli Bitir</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleStartPeriod}
                  style={[styles.logTodayBtn, { backgroundColor: theme.primary }]}
                >
                  <Droplet size={16} color="#FFF" style={{ marginRight: 5 }} />
                  <Text style={styles.logTodayBtnText}>Regli Başlat</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/tracker')}
                style={[styles.logTodayBtn, { backgroundColor: '#9B5DE5' }]}
              >
                <Activity size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.logTodayBtnText}>Takip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/log-day')}
                style={[styles.logTodayBtn, { backgroundColor: '#333' }]}
              >
                <Plus size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.logTodayBtnText}>Belirti</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Today's moods / symptoms */}
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
                <View key={s} style={[styles.logTag, styles.symptomTag, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '33' }]}>
                  <Text style={styles.logTagText}>🌸 {s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* =========================================================================
            HEALTH INDICATORS (2x2 Grid)
            ========================================================================= */}
        <Text style={styles.sectionTitle}>Bugünkü Sağlık Göstergeleri</Text>
        <View style={styles.widgetGrid}>
          {/* Su Tüketimi */}
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Droplet size={16} color="#00B4D8" />
              <Text style={styles.widgetTitle}>Su Tüketimi</Text>
            </View>
            <Text style={styles.widgetValue}>
              {todayLog?.water_ml || 0} <Text style={styles.widgetUnitText}>ml</Text>
            </Text>
            <Text style={styles.widgetTarget}>Hedef: 2000 ml</Text>
            <TouchableOpacity onPress={incrementWater} style={styles.widgetBtn}>
              <Plus size={12} color="#00B4D8" style={{ marginRight: 4 }} />
              <Text style={styles.widgetBtnText}>+250 ml</Text>
            </TouchableOpacity>
          </View>

          {/* Uyku Süresi */}
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Moon size={16} color="#9B5DE5" />
              <Text style={styles.widgetTitle}>Uyku Süresi</Text>
            </View>
            <Text style={styles.widgetValue}>
              {todayLog?.sleep_hours || 0} <Text style={styles.widgetUnitText}>Saat</Text>
            </Text>
            <Text style={styles.widgetTarget}>Hedef: 8 Saat</Text>
            <TouchableOpacity
              onPress={incrementSleep}
              style={[
                styles.widgetBtn,
                { backgroundColor: 'rgba(155,93,229,0.08)', borderColor: 'rgba(155,93,229,0.15)' },
              ]}
            >
              <Plus size={12} color="#9B5DE5" style={{ marginRight: 4 }} />
              <Text style={[styles.widgetBtnText, { color: '#9B5DE5' }]}>+1 Saat</Text>
            </TouchableOpacity>
          </View>

          {/* Günlük Adım */}
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Flame size={16} color="#FF9F1C" />
              <Text style={styles.widgetTitle}>Günlük Adım</Text>
            </View>
            <Text style={styles.widgetValue}>
              {todayLog?.steps || 0} <Text style={styles.widgetUnitText}>Adım</Text>
            </Text>
            <Text style={styles.widgetTarget}>Hedef: 10 Bin</Text>
            <TouchableOpacity
              onPress={incrementSteps}
              style={[
                styles.widgetBtn,
                { backgroundColor: 'rgba(255,159,28,0.08)', borderColor: 'rgba(255,159,28,0.15)' },
              ]}
            >
              <Plus size={12} color="#FF9F1C" style={{ marginRight: 4 }} />
              <Text style={[styles.widgetBtnText, { color: '#FF9F1C' }]}>+1000</Text>
            </TouchableOpacity>
          </View>

          {/* Kilo Takibi */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/tracker')}
            style={styles.widget}
          >
            <View style={styles.widgetHeader}>
              <TrendingUp size={16} color="#06D6A0" />
              <Text style={styles.widgetTitle}>Kilo & BMI</Text>
            </View>
            <Text style={styles.widgetValue}>
              {todayLog?.weight_kg || '-'} <Text style={styles.widgetUnitText}>kg</Text>
            </Text>
            <Text style={styles.widgetTarget}>
              VKI:{' '}
              {todayLog?.weight_kg && todayLog?.height_cm
                ? (todayLog.weight_kg / Math.pow(todayLog.height_cm / 100, 2)).toFixed(1)
                : '-'}
            </Text>
            <View
              style={[
                styles.widgetBtn,
                { backgroundColor: 'rgba(6,214,160,0.08)', borderColor: 'rgba(6,214,160,0.15)' },
              ]}
            >
              <Text style={[styles.widgetBtnText, { color: '#06D6A0' }]}>Giriş Yap ⚖️</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Doğum Kontrol Takip Widget'ı */}
        {contraceptiveConfig.enabled && contraceptiveConfig.startDate && (
          <View style={[styles.pillCard, { borderColor: theme.primary + '22' }]}>
            <View style={styles.pillCardHeader}>
              <View style={styles.pillCardHeaderLeft}>
                <Activity size={18} color={theme.primary} />
                <Text style={styles.pillCardHeaderTitle}>
                  {contraceptiveConfig.type === 'pill' ? 'Doğum Kontrol Hapı' : 
                   contraceptiveConfig.type === 'ring' ? 'Kontraseptif Halka' : 
                   contraceptiveConfig.type === 'patch' ? 'Kontraseptif Plaster' : 'Doğum Kontrol İğnesi'}
                </Text>
              </View>
              <Text style={[styles.pillCardTime, { color: theme.primary }]}>
                {contraceptiveConfig.reminderTime}
              </Text>
            </View>

            {/* Grid of Pills */}
            {contraceptiveConfig.type === 'pill' && (
              <View style={styles.pillGrid}>
                {getPillPackPills().map((pill) => {
                  let circleStyle: any[] = [styles.pillCircle];
                  let textStyle: any[] = [styles.pillCircleText];
                  
                  if (pill.isTaken) {
                    circleStyle.push({ backgroundColor: theme.primary, borderColor: theme.primary });
                    textStyle.push({ color: '#fff', fontWeight: 'bold' });
                  } else if (pill.isToday) {
                    circleStyle.push({ borderColor: theme.primary, borderStyle: 'dashed', borderWidth: 2 });
                    textStyle.push({ color: theme.primary, fontWeight: 'bold' });
                  } else if (pill.isFuture) {
                    circleStyle.push({ borderColor: 'rgba(255, 255, 255, 0.05)' });
                    textStyle.push({ color: '#444' });
                  } else {
                    // Missed pill (past and not taken)
                    circleStyle.push({ borderColor: '#ff4d6d44', backgroundColor: 'rgba(255, 77, 109, 0.04)' });
                    textStyle.push({ color: '#ff4d6d' });
                  }
                  
                  return (
                    <View key={pill.index} style={circleStyle}>
                      <Text style={textStyle}>{pill.index}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Actions & Info Footer */}
            <View style={styles.pillCardFooter}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.pillCardFooterInfo}>
                  Paket Durumu:{' '}
                  {(() => {
                    const pills = getPillPackPills();
                    const takenCount = pills.filter(p => p.isTaken).length;
                    const totalPills = contraceptiveConfig.pillsInPack;
                    return `${takenCount} / ${totalPills} Alındı`;
                  })()}
                </Text>
                {contraceptiveConfig.packModel === '21_7' && contraceptiveConfig.type === 'pill' && (
                  <Text style={styles.pillCardFooterSub}>
                    Döngü Modeli: 21 Gün Aktif + 7 Gün Ara
                  </Text>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.pillActionBtn,
                  todayLog?.symptoms?.includes('Doğum Kontrol Hapı')
                    ? { backgroundColor: 'rgba(6, 214, 160, 0.08)', borderColor: 'rgba(6, 214, 160, 0.2)', borderWidth: 1 }
                    : { backgroundColor: theme.primary },
                ]}
                onPress={handleToggleTodayPill}
              >
                <Text
                  style={[
                    styles.pillActionBtnText,
                    todayLog?.symptoms?.includes('Doğum Kontrol Hapı')
                      ? { color: '#06D6A0' }
                      : { color: '#fff' },
                  ]}
                >
                  {todayLog?.symptoms?.includes('Doğum Kontrol Hapı')
                    ? 'Hap Alındı ✓'
                    : 'Hapı Al 💊'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Daily tip */}
        {dailyTipText ? (
          <View style={styles.tipCard}>
            <ExpoLinearGradient
              colors={[theme.primary + '10', theme.primary + '05']}
              style={[styles.tipGradient, { borderColor: theme.primary + '1F' }]}
            >
              <View style={styles.tipHeader}>
                <Flame size={16} color={theme.primary} />
                <Text style={[styles.tipHeaderTitle, { color: theme.primary }]}>GÜNÜN SAĞLIK TAVSİYESİ</Text>
              </View>
              <Text style={styles.tipBody}>{dailyTipText}</Text>
            </ExpoLinearGradient>
          </View>
        ) : null}

        {/* AI insights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={20} color="#FF2366" />
            <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>
              Yapay Zeka Analizleri
            </Text>
          </View>
          {aiInsights.map((insight, idx) => (
            <View
              key={idx}
              style={[styles.insightCard, { borderColor: theme.primary + '26' }, (styles as any)[`insight_${insight.type}`]]}
            >
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDesc}>{insight.description}</Text>
            </View>
          ))}
        </View>

        {/* Upcoming alerts */}
        {upcomingAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Brain size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>
                Yapay Zeka Analizleri
              </Text>
            </View>
          </View>
        )}

        {/* Upcoming alerts list */}
        {upcomingAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>
                Yaklaşan Hatırlatıcılar
              </Text>
            </View>
            <View style={styles.alertsContainer}>
              {upcomingAlerts.map((alert, idx) => (
                <View key={idx} style={styles.alertRow}>
                  <View style={[styles.alertCircle, { backgroundColor: theme.primary }]} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertTrigger}>{alert.triggerTime}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Period Summary Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showSummaryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalEmoji}>🌸</Text>
                <Text style={styles.modalTitle}>Regl Dönemi Tamamlandı</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSummaryModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Duration badge */}
            <View style={[styles.summaryDurationCard, { borderColor: theme.primary + '33' }]}>
              <Text style={[styles.summaryDurationNum, { color: theme.primary }]}>{periodDuration}</Text>
              <Text style={styles.summaryDurationLabel}>Gün Sürdü</Text>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {/* Moods */}
              {getAllMoods().length > 0 && (
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>😊 Ruh Hali Kayıtları</Text>
                  <View style={styles.summaryTags}>
                    {getAllMoods().map(([mood, count]) => (
                      <View key={mood} style={styles.summaryMoodTag}>
                        <Text style={styles.summaryTagText}>{mood}</Text>
                        <Text style={styles.summaryTagCount}> ×{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Symptoms */}
              {getAllSymptoms().length > 0 && (
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>🌸 Belirtiler</Text>
                  <View style={styles.summaryTags}>
                    {getAllSymptoms().map(([sym, count]) => (
                      <View key={sym} style={[styles.summarySymptomTag, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '33' }]}>
                        <Text style={styles.summaryTagText}>{sym}</Text>
                        <Text style={styles.summaryTagCount}> ×{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              {getPeriodNotes().length > 0 && (
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>📝 Notlarınız</Text>
                  {getPeriodNotes().map((log, idx) => (
                    <View key={idx} style={styles.summaryNoteRow}>
                      <Text style={[styles.summaryNoteDate, { color: theme.primary }]}>
                        {new Date(log.date + 'T12:00:00').toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'short',
                        })}
                      </Text>
                      <Text style={styles.summaryNoteText}>{log.notes}</Text>
                    </View>
                  ))}
                </View>
              )}

              {getAllMoods().length === 0 &&
                getAllSymptoms().length === 0 &&
                getPeriodNotes().length === 0 && (
                  <Text style={styles.summaryEmpty}>
                    Bu dönem için kayıt bulunmuyor.{'\n'}Belirti ve ruh hali kaydetmek için
                    günlük takibi kullanın. 📋
                  </Text>
                )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalDoneBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
              onPress={() => setShowSummaryModal(false)}
            >
              <Text style={styles.modalDoneBtnText}>Harika! Kapat 🌸</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Modern Confirmation Modal */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={[styles.confirmModalCard, { borderColor: theme.primary + '40' }]}>
            <ExpoLinearGradient
              colors={theme.bgGradient}
              style={styles.confirmModalGradient}
            >
              {/* Emoji header circle */}
              <View style={styles.confirmEmojiWrapper}>
                <Text style={styles.confirmEmoji}>{confirmModal.emoji}</Text>
              </View>

              {/* Text info */}
              <Text style={styles.confirmModalTitle}>{confirmModal.title}</Text>
              <Text style={styles.confirmModalMessage}>{confirmModal.message}</Text>

              {/* Actions row */}
              <View style={styles.confirmActionRow}>
                <TouchableOpacity
                  onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                  style={[styles.confirmBtn, styles.confirmCancelBtn]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmCancelText}>{confirmModal.cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmModal.onConfirm}
                  style={[styles.confirmBtn, styles.confirmOkBtn, { backgroundColor: theme.primary }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmOkText}>{confirmModal.confirmText}</Text>
                </TouchableOpacity>
              </View>
            </ExpoLinearGradient>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </ExpoLinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121214' },
  loadingContainer: {
    flex: 1, backgroundColor: '#121214', justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: '#aaa', fontSize: 14, marginTop: 10 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerWelcome: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerDate: { fontSize: 13, color: '#888', marginTop: 4 },

  pregnancyBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#7209B7',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  pregnancyBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  pregnancyNoticeCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  pregnancyNoticeGradient: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  pregnancyNoticeTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  pregnancyNoticeSub: { color: '#e0d0f5', fontSize: 12, marginTop: 4, paddingRight: 10 },

  // ── Cycle wheel ──
  wheelContainer: { alignItems: 'center', marginBottom: 24 },

  pulseRing: {
    position: 'absolute',
    width: 234,
    height: 234,
    borderRadius: 117,
    borderWidth: 3,
    borderColor: '#FF2366',
    backgroundColor: 'transparent',
  },

  wheelBorder: {
    width: 230, height: 230, borderRadius: 115,
    borderWidth: 1.5, borderColor: 'rgba(255, 35, 102, 0.2)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 6,
  },
  wheelBorderActive: { borderColor: 'rgba(255, 35, 102, 0.75)', borderWidth: 2.5 },

  wheelInner: {
    width: 206, height: 206, borderRadius: 103,
    backgroundColor: '#16161a',
    justifyContent: 'center', alignItems: 'center', padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.01)',
  },
  wheelInnerActive: { backgroundColor: '#1a0a0e' },

  wheelLabel: {
    fontSize: 12, color: '#FF2366', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  wheelLabelActive: { color: '#FF6B8A', fontSize: 13 },
  wheelNumber: { fontSize: 60, fontWeight: 'bold', color: '#fff', marginVertical: 2 },
  wheelUnit: { fontSize: 13, color: '#888', fontWeight: '600' },
  wheelSub: { fontSize: 11, color: '#555', marginTop: 8, textAlign: 'center' },

  quickActionRow: { flexDirection: 'row', marginTop: 20, gap: 10 },

  logTodayBtn: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  endPeriodBtn: { backgroundColor: '#8B0000', flex: 1, justifyContent: 'center' },
  logTodayBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 12 },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  logTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  moodTag: { backgroundColor: 'rgba(155,93,229,0.08)', borderColor: 'rgba(155,93,229,0.2)' },
  symptomTag: { backgroundColor: 'rgba(255,35,102,0.08)', borderColor: 'rgba(255,35,102,0.2)' },
  logTagText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // 2x2 Premium Grid Widget styles
  widgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  widget: {
    width: (Dimensions.get('window').width - 52) / 2,
    backgroundColor: '#18181c',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  widgetTitle: { fontSize: 12, color: '#888', fontWeight: '600', marginLeft: 6 },
  widgetValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  widgetUnitText: { fontSize: 13, color: '#888', fontWeight: 'normal' },
  widgetTarget: { fontSize: 11, color: '#555', marginTop: 4 },
  widgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(0,180,216,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,180,216,0.15)',
    borderRadius: 12,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  widgetBtnText: { color: '#00B4D8', fontSize: 11, fontWeight: 'bold' },

  // Daily tip
  tipCard: {
    borderRadius: 18, overflow: 'hidden', marginBottom: 24,
    borderWidth: 1.5, borderColor: 'rgba(255,35,102,0.12)',
  },
  tipGradient: { padding: 18 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  tipHeaderTitle: { fontSize: 10, color: '#FF2366', fontWeight: 'bold', letterSpacing: 1, marginLeft: 6 },
  tipBody: { fontSize: 13, color: '#ddd', lineHeight: 18 },

  // AI insights with premium border left accents
  insightCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  insight_success: {
    backgroundColor: 'rgba(6,214,160,0.04)',
    borderColor: 'rgba(6,214,160,0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#06D6A0',
  },
  insight_warning: {
    backgroundColor: 'rgba(255,183,3,0.04)',
    borderColor: 'rgba(255,183,3,0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB703',
  },
  insight_info: {
    backgroundColor: 'rgba(0,180,216,0.04)',
    borderColor: 'rgba(0,180,216,0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#00B4D8',
  },
  insightTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  insightDesc:  { fontSize: 12, color: '#aaa', lineHeight: 16 },

  // Alerts
  alertsContainer: {
    backgroundColor: '#18181c', borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
  },
  alertRow:    { flexDirection: 'row', alignItems: 'center' },
  alertCircle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF2366' },
  alertTitle:  { fontSize: 13, color: '#fff', fontWeight: '600' },
  alertTrigger:{ fontSize: 11, color: '#666', marginTop: 2 },

  // ── Period Summary Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#18181c', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1, borderColor: 'rgba(255,35,102,0.15)',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalEmoji: { fontSize: 22 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },

  summaryDurationCard: {
    backgroundColor: 'rgba(255,35,102,0.08)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,35,102,0.2)',
    padding: 16, alignItems: 'center', marginBottom: 20,
  },
  summaryDurationNum:  { fontSize: 52, fontWeight: 'bold', color: '#FF2366' },
  summaryDurationLabel:{ fontSize: 14, color: '#aaa', fontWeight: '600', marginTop: -4 },

  summarySection: { marginBottom: 20 },
  summarySectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 10 },

  summaryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryMoodTag: {
    flexDirection: 'row', backgroundColor: 'rgba(155,93,229,0.1)',
    borderWidth: 1, borderColor: 'rgba(155,93,229,0.25)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  summarySymptomTag: {
    flexDirection: 'row', backgroundColor: 'rgba(255,35,102,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,35,102,0.2)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  summaryTagText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  summaryTagCount: { color: '#888', fontSize: 12 },

  summaryNoteRow: {
    backgroundColor: '#131316', borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryNoteDate: { fontSize: 11, color: '#FF2366', fontWeight: 'bold', marginBottom: 4 },
  summaryNoteText: { fontSize: 13, color: '#ccc', lineHeight: 18 },

  summaryEmpty: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20, marginVertical: 16 },

  modalDoneBtn: {
    marginTop: 20, backgroundColor: '#FF2366', borderRadius: 16,
    height: 52, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF2366', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  modalDoneBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // ── Custom Confirmation Modal Styles ──
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.25)',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  confirmModalGradient: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  confirmEmojiWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 35, 102, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmEmoji: {
    fontSize: 32,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  confirmOkBtn: {
    backgroundColor: '#FF2366',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmCancelText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmOkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pillCard: {
    backgroundColor: '#18181c',
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  pillCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 12,
    marginBottom: 14,
  },
  pillCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillCardHeaderTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  pillCardTime: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  pillCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillCircleText: {
    fontSize: 11,
    color: '#888',
  },
  pillCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillCardFooterInfo: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pillCardFooterSub: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  pillActionBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
