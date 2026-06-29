import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { getCycles, getDailyLogsRange, DailyLogInput, addCycle, updateCycle, deleteCycle } from '../../database/db';
import { calculatePredictions, PredictionResult } from '../../utils/periodEngine';
import { useAppStore } from '../../store/store';
import { ChevronLeft, ChevronRight, Filter, Plus, Calendar as CalendarIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../../utils/date';

const parseUtcDate = (dateStr: string) => {
  return new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`).getTime();
};

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAppStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(getLocalDateString());
  const [cycles, setCycles] = useState<any[]>([]);
  const [logs, setLogs] = useState<{ [key: string]: DailyLogInput }>({});
  const [predictions, setPredictions] = useState<PredictionResult | null>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<'all' | 'period' | 'symptoms'>('all');

  // History CRUD States
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [editingCycle, setEditingCycle] = useState<any | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  
  const [isAddingNewCycle, setIsAddingNewCycle] = useState(false);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const handleDeleteCycle = async (id: number) => {
    Alert.alert(
      'Döngüyü Sil',
      'Bu döngü kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const ok = await deleteCycle(id);
            if (ok) {
              await loadCalendarData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        }
      ]
    );
  };

  const handleSaveCycleEdit = async () => {
    if (!editingCycle) return;
    const start = editStartDate.trim();
    const end = editEndDate.trim() || undefined;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || (end && !dateRegex.test(end))) {
      Alert.alert('Hata', 'Tarih formatı YYYY-AA-GG (Örn: 2026-06-25) şeklinde olmalıdır.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await updateCycle(editingCycle.id, start, end);
    if (ok) {
      setEditingCycle(null);
      await loadCalendarData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Hata', 'Döngü güncellenirken hata oluştu.');
    }
  };

  const handleAddNewCycle = async () => {
    const start = newStartDate.trim();
    const end = newEndDate.trim() || undefined;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || (end && !dateRegex.test(end))) {
      Alert.alert('Hata', 'Tarih formatı YYYY-AA-GG (Örn: 2026-06-25) şeklinde olmalıdır.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await addCycle(start, end);
    if (ok) {
      setIsAddingNewCycle(false);
      setNewStartDate('');
      setNewEndDate('');
      await loadCalendarData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Hata', 'Aynı başlangıç tarihine sahip bir döngü zaten mevcut olabilir veya işlem başarısız oldu.');
    }
  };

  const loadCalendarData = async () => {
    try {
      const dbCycles = await getCycles();
      setCycles(dbCycles);

      // Predictions
      const todayStr = getLocalDateString();
      const result = calculatePredictions(dbCycles, todayStr, user?.avgCycleLength, user?.avgPeriodLength);
      setPredictions(result);

      // Fetch logs for current month (plus boundaries to be safe)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startRange = getLocalDateString(new Date(year, month - 1, 1));
      const endRange = getLocalDateString(new Date(year, month + 2, 0));

      const rangeLogs = await getDailyLogsRange(startRange, endRange);
      const logsMap: { [key: string]: DailyLogInput } = {};
      rangeLogs.forEach(l => {
        logsMap[l.date] = l;
      });
      setLogs(logsMap);
    } catch (e) {
      console.error('Failed to load calendar data:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCalendarData();
    }, [currentDate])
  );

  const handlePrevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Calendar rendering helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    // Shift so Monday is index 0 (0: Mon, 1: Tue ... 6: Sun)
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const generateMonthDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayIndex = getFirstDayOfMonth(currentDate);
    
    const dayCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const daysInPrevMonth = getDaysInMonth(prevMonthDate);
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, dayNum);
      dayCells.push({
        dateStr: getLocalDateString(d),
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      dayCells.push({
        dateStr: getLocalDateString(d),
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill grid to 42 cells (6 rows)
    const totalCells = 42;
    const nextMonthPadding = totalCells - dayCells.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
      dayCells.push({
        dateStr: getLocalDateString(d),
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return dayCells;
  };

  // Styles days depending on phase
  const getDayStatus = (dateStr: string) => {
    if (!predictions) return { isPeriod: false, isFertile: false, isOvulation: false, hasLog: false, hasPill: false, hasIntimacy: false, hasNotes: false, hasSymptoms: false };

    const todayVal = parseUtcDate(dateStr);
    
    // Check local database cycles to see if period occurred
    const isLoggedPeriod = cycles.some(c => {
      const start = parseUtcDate(c.start_date);
      const end = c.end_date ? parseUtcDate(c.end_date) : parseUtcDate(c.start_date) + 4*24*60*60*1000;
      return todayVal >= start && todayVal <= end;
    });

    // Check future predictions
    let isPredPeriod = false;
    let isFertile = false;
    let isOvulation = false;

    predictions.futureCycles.forEach(fc => {
      const start = parseUtcDate(fc.startDate);
      const end = parseUtcDate(fc.endDate);
      const fertS = parseUtcDate(fc.fertileStart);
      const fertE = parseUtcDate(fc.fertileEnd);
      const ov = parseUtcDate(fc.ovulationDate);

      if (todayVal >= start && todayVal <= end) {
        isPredPeriod = true;
      }
      if (todayVal >= fertS && todayVal <= fertE) {
        isFertile = true;
      }
      if (Math.abs(todayVal - ov) < 12 * 60 * 60 * 1000) {
        isOvulation = true;
      }
    });

    const log = logs[dateStr];
    const hasLog = !!log && ((log.moods && log.moods.length > 0) || (log.symptoms && log.symptoms.length > 0) || !!log.notes);
    const hasPill = !!(log && log.symptoms && log.symptoms.includes('Doğum Kontrol Hapı'));
    const hasIntimacy = !!(log && log.symptoms && (log.symptoms.includes('Cinsel İlişki') || log.symptoms.includes('Korunmasız İlişki') || log.symptoms.includes('Orgazm')));
    const hasNotes = !!(log && log.notes && log.notes.trim().length > 0);
    const hasSymptoms = !!(log && log.symptoms && log.symptoms.filter(s => s !== 'Doğum Kontrol Hapı' && s !== 'Cinsel İlişki' && s !== 'Korunmasız İlişki' && s !== 'Orgazm').length > 0);

    return {
      isPeriod: isLoggedPeriod || isPredPeriod,
      isFertile,
      isOvulation,
      hasLog,
      hasPill,
      hasIntimacy,
      hasNotes,
      hasSymptoms,
    };
  };

  const handleDayPress = (dateStr: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDateStr(dateStr);
  };

  const getFilteredDays = (cells: any[]) => {
    if (activeFilter === 'all') return cells;
    return cells.map(c => {
      const status = getDayStatus(c.dateStr);
      if (activeFilter === 'period' && !status.isPeriod) {
        return { ...c, isFilteredOut: true };
      }
      if (activeFilter === 'symptoms' && !status.hasLog) {
        return { ...c, isFilteredOut: true };
      }
      return c;
    });
  };

  const monthCells = generateMonthDays();
  const filteredCells = getFilteredDays(monthCells);
  const selectedLog = logs[selectedDateStr];

  const weekdayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Takvim & Günlük</Text>
          <Text style={styles.headerSub}>Döngü günlerinizi işaretleyin</Text>
        </View>

        {/* Filter Bar and Action Button */}
        <View style={styles.actionHeaderRow}>
          <View style={styles.filterBar}>
            <Filter size={14} color="#888" style={{ marginRight: 6 }} />
            <TouchableOpacity
              onPress={() => setActiveFilter('all')}
              style={[styles.filterBtn, activeFilter === 'all' && styles.filterBtnActive]}
            >
              <Text style={[styles.filterBtnText, activeFilter === 'all' && styles.filterBtnTextActive]}>Tümü</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveFilter('period')}
              style={[styles.filterBtn, activeFilter === 'period' && styles.filterBtnActive]}
            >
              <Text style={[styles.filterBtnText, activeFilter === 'period' && styles.filterBtnTextActive]}>Regl</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveFilter('symptoms')}
              style={[styles.filterBtn, activeFilter === 'symptoms' && styles.filterBtnActive]}
            >
              <Text style={[styles.filterBtnText, activeFilter === 'symptoms' && styles.filterBtnTextActive]}>Belirtiler</Text>
            </TouchableOpacity>
          </View>

          {/* Manage History Button */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setHistoryModalVisible(true);
            }}
            style={styles.manageHistoryBtn}
          >
            <Text style={styles.manageHistoryBtnText}>Geçmişi Yönet</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowBtn}>
              <ChevronLeft size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.calendarHeaderTitle}>
              {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.arrowBtn}>
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Weekday Titles */}
          <View style={styles.weekdayRow}>
            {weekdayLabels.map(w => (
              <Text key={w} style={styles.weekdayLabel}>{w}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.gridContainer}>
            {filteredCells.map((cell, idx) => {
              const status = getDayStatus(cell.dateStr);
              const isSelected = selectedDateStr === cell.dateStr;
              
              // Colors based on state
              let dayStyle: any[] = [styles.dayCell];
              let textStyle: any[] = [styles.dayText];
              
              if (!cell.isCurrentMonth) {
                dayStyle.push(styles.dayCellOutside);
                textStyle.push(styles.dayTextOutside);
              }

              if (status.isPeriod) {
                dayStyle.push(styles.dayPeriod);
                textStyle.push(styles.dayTextPeriod);
              } else if (status.isOvulation) {
                dayStyle.push(styles.dayOvulation);
                textStyle.push(styles.dayTextOvulation);
              } else if (status.isFertile) {
                dayStyle.push(styles.dayFertile);
                textStyle.push(styles.dayTextFertile);
              }

              if (isSelected) {
                dayStyle.push(styles.daySelected);
              }

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleDayPress(cell.dateStr)}
                  style={[dayStyle, cell.isFilteredOut && { opacity: 0.15 }]}
                >
                  <Text style={[textStyle, isSelected && styles.dayTextSelected]}>
                    {cell.dayNum}
                  </Text>
                  {status.hasLog && (
                    <View style={styles.badgeRow}>
                      {status.hasIntimacy && <Text style={styles.microBadge}>💖</Text>}
                      {status.hasPill && <Text style={styles.microBadge}>💊</Text>}
                      {status.hasNotes && <Text style={styles.microBadge}>📝</Text>}
                      {status.hasSymptoms && <Text style={styles.microBadge}>🌸</Text>}
                      {!status.hasIntimacy && !status.hasPill && !status.hasNotes && !status.hasSymptoms && (
                        <View style={styles.logDot} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend indicator key */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.legendIndicator, { backgroundColor: '#FF2366' }]} /><Text style={styles.legendLabel}>Regl</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendIndicator, { backgroundColor: '#7209B7' }]} /><Text style={styles.legendLabel}>Ovülasyon</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendIndicator, { backgroundColor: 'rgba(155, 93, 229, 0.25)', borderColor: '#9B5DE5', borderWidth: 1 }]} /><Text style={styles.legendLabel}>Doğurgan</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendIndicator, { backgroundColor: '#FFD166', borderRadius: 4 }]} /><Text style={styles.legendLabel}>Log</Text></View>
          </View>
        </View>

        {/* Selected Day Logs Panel */}
        <View style={styles.logsPanel}>
          <View style={styles.logsPanelHeader}>
            <CalendarIcon size={18} color="#FF2366" />
            <Text style={styles.logsPanelTitle}>
              {new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>

          {selectedLog ? (
            <View style={styles.logContainer}>
              {/* Mood list */}
              {selectedLog.moods && selectedLog.moods.length > 0 && (
                <View style={styles.logSubSection}>
                  <Text style={styles.logSubTitle}>Duygu Durumu</Text>
                  <View style={styles.tagsRow}>
                    {selectedLog.moods.map((m: string) => (
                      <View key={m} style={[styles.logTag, styles.moodTag]}><Text style={styles.tagText}>😊 {m}</Text></View>
                    ))}
                  </View>
                </View>
              )}

              {/* Symptoms list */}
              {selectedLog.symptoms && selectedLog.symptoms.length > 0 && (
                <View style={styles.logSubSection}>
                  <Text style={styles.logSubTitle}>Belirtiler</Text>
                  <View style={styles.tagsRow}>
                    {selectedLog.symptoms.map((s: string) => (
                      <View key={s} style={[styles.logTag, styles.symptomTag]}><Text style={styles.tagText}>🌸 {s}</Text></View>
                    ))}
                  </View>
                </View>
              )}

              {/* Water, Sleep, Notes summary */}
              <View style={styles.logHealthGrid}>
                {(selectedLog.water_ml ?? 0) > 0 && (
                  <View style={styles.healthLogCard}>
                    <Text style={styles.healthLogLabel}>Su</Text>
                    <Text style={styles.healthLogVal}>{selectedLog.water_ml} ml</Text>
                  </View>
                )}
                {(selectedLog.sleep_hours ?? 0) > 0 && (
                  <View style={styles.healthLogCard}>
                    <Text style={styles.healthLogLabel}>Uyku</Text>
                    <Text style={styles.healthLogVal}>{selectedLog.sleep_hours} Sa</Text>
                  </View>
                )}
                {selectedLog.weight_kg !== undefined && (
                  <View style={styles.healthLogCard}>
                    <Text style={styles.healthLogLabel}>Kilo</Text>
                    <Text style={styles.healthLogVal}>{selectedLog.weight_kg} kg</Text>
                  </View>
                )}
              </View>

              {selectedLog.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Özel Sağlık Notu:</Text>
                  <Text style={styles.notesText}>{selectedLog.notes}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noLogsText}>Bu güne ait herhangi bir kayıt eklenmemiş.</Text>
          )}

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/log-day', params: { date: selectedDateStr } })}
            style={styles.addLogBtn}
          >
            <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.addLogBtnText}>
              {selectedLog ? 'Kaydı Güncelle' : 'Belirtileri Ekle'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Padding for bottom tab bar */}
        <View style={{ height: Math.max(140, insets.bottom + 90) }} />
      </ScrollView>

      {/* Cycle History CRUD Modal */}
      <Modal visible={historyModalVisible} transparent animationType="slide" onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.historyModalBg}>
          <View style={styles.historyModalBox}>
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle}>Adet Döngüsü Geçmişi</Text>
              <TouchableOpacity onPress={() => { setHistoryModalVisible(false); setEditingCycle(null); setIsAddingNewCycle(false); }}>
                <Text style={styles.closeModalText}>Kapat</Text>
              </TouchableOpacity>
            </View>

            {/* Toggle Add Form */}
            {!isAddingNewCycle && !editingCycle && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsAddingNewCycle(true);
                  setNewStartDate(getLocalDateString());
                  setNewEndDate('');
                }}
                style={styles.addCycleToggleBtn}
              >
                <Text style={styles.addCycleToggleBtnText}>+ Yeni Döngü Ekle</Text>
              </TouchableOpacity>
            )}

            {/* Add New Cycle Form */}
            {isAddingNewCycle && (
              <View style={[styles.cycleHistoryItem, styles.historyEditBox]}>
                <Text style={[styles.historyModalTitle, { fontSize: 13, marginBottom: 8 }]}>Yeni Döngü Ekle</Text>
                
                <View style={styles.historyInputRow}>
                  <View style={styles.historyInputContainer}>
                    <Text style={styles.historyInputLabel}>Başlangıç (YYYY-AA-GG)</Text>
                    <TextInput
                      style={styles.historyInput}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor="#666"
                      value={newStartDate}
                      onChangeText={setNewStartDate}
                    />
                  </View>
                  <View style={styles.historyInputContainer}>
                    <Text style={styles.historyInputLabel}>Bitiş (YYYY-AA-GG - Opsiyonel)</Text>
                    <TextInput
                      style={styles.historyInput}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor="#666"
                      value={newEndDate}
                      onChangeText={setNewEndDate}
                    />
                  </View>
                </View>

                <View style={[styles.cycleHistoryActions, { marginTop: 8 }]}>
                  <TouchableOpacity
                    style={[styles.cycleHistoryBtn, { backgroundColor: '#333' }]}
                    onPress={() => setIsAddingNewCycle(false)}
                  >
                    <Text style={[styles.cycleHistoryBtnText, { color: '#fff' }]}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cycleHistoryBtn, { backgroundColor: '#06D6A0' }]}
                    onPress={handleAddNewCycle}
                  >
                    <Text style={[styles.cycleHistoryBtnText, { color: '#fff' }]}>Ekle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Edit Cycle Form */}
            {editingCycle && (
              <View style={[styles.cycleHistoryItem, styles.historyEditBox]}>
                <Text style={[styles.historyModalTitle, { fontSize: 13, marginBottom: 8 }]}>Döngüyü Düzenle</Text>
                
                <View style={styles.historyInputRow}>
                  <View style={styles.historyInputContainer}>
                    <Text style={styles.historyInputLabel}>Başlangıç (YYYY-AA-GG)</Text>
                    <TextInput
                      style={styles.historyInput}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor="#666"
                      value={editStartDate}
                      onChangeText={setEditStartDate}
                    />
                  </View>
                  <View style={styles.historyInputContainer}>
                    <Text style={styles.historyInputLabel}>Bitiş (YYYY-AA-GG - Opsiyonel)</Text>
                    <TextInput
                      style={styles.historyInput}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor="#666"
                      value={editEndDate}
                      onChangeText={setEditEndDate}
                    />
                  </View>
                </View>

                <View style={[styles.cycleHistoryActions, { marginTop: 8 }]}>
                  <TouchableOpacity
                    style={[styles.cycleHistoryBtn, { backgroundColor: '#333' }]}
                    onPress={() => setEditingCycle(null)}
                  >
                    <Text style={[styles.cycleHistoryBtnText, { color: '#fff' }]}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cycleHistoryBtn, { backgroundColor: '#FF2366' }]}
                    onPress={handleSaveCycleEdit}
                  >
                    <Text style={[styles.cycleHistoryBtnText, { color: '#fff' }]}>Kaydet</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* History List */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {cycles.length === 0 ? (
                <Text style={[styles.noLogsText, { marginVertical: 40 }]}>Kayıtlı döngü verisi bulunamadı.</Text>
              ) : (
                cycles.map((c, idx) => (
                  <View key={c.id || idx} style={styles.cycleHistoryItem}>
                    <Text style={styles.cycleHistoryDates}>
                      📅 {c.start_date} {c.end_date ? `➔ ${c.end_date}` : '➔ (Devam Ediyor)'}
                    </Text>
                    <View style={styles.cycleHistoryMetaRow}>
                      <Text style={styles.cycleHistoryMetaText}>
                        🩸 Adet: {c.period_length ? `${c.period_length} Gün` : '-'}
                      </Text>
                      <Text style={styles.cycleHistoryMetaText}>
                        🔄 Döngü: {c.cycle_length ? `${c.cycle_length} Gün` : '-'}
                      </Text>
                    </View>
                    <View style={styles.cycleHistoryActions}>
                      <TouchableOpacity
                        style={[styles.cycleHistoryBtn, { backgroundColor: '#222' }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditingCycle(c);
                          setEditStartDate(c.start_date);
                          setEditEndDate(c.end_date || '');
                        }}
                      >
                        <Text style={[styles.cycleHistoryBtnText, { color: '#aaa' }]}>Düzenle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cycleHistoryBtn, { backgroundColor: 'rgba(255, 77, 109, 0.1)' }]}
                        onPress={() => handleDeleteCycle(c.id)}
                      >
                        <Text style={[styles.cycleHistoryBtnText, { color: '#FF4D6D' }]}>Sil</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    marginBottom: 16,
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  filterBtn: {
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterBtnActive: {
    backgroundColor: '#FF2366',
    borderColor: '#FF2366',
  },
  filterBtnText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  calendarCard: {
    backgroundColor: '#18181c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    marginBottom: 24,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'capitalize',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#555',
    fontWeight: 'bold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  dayCell: {
    width: '14.28%', // 7 days in week
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    position: 'relative',
  },
  dayCellOutside: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  dayTextOutside: {
    color: '#888',
  },
  dayPeriod: {
    backgroundColor: '#FF2366',
  },
  dayTextPeriod: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dayFertile: {
    backgroundColor: 'rgba(155, 93, 229, 0.15)',
    borderWidth: 1,
    borderColor: '#9B5DE5',
  },
  dayTextFertile: {
    color: '#9B5DE5',
  },
  dayOvulation: {
    backgroundColor: '#7209B7',
  },
  dayTextOvulation: {
    color: '#fff',
    fontWeight: 'bold',
  },
  daySelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  dayTextSelected: {
    color: '#fff',
  },
  logDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD166',
    position: 'absolute',
    bottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  logsPanel: {
    backgroundColor: '#18181c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
  },
  logsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 10,
  },
  logsPanelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  noLogsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  logContainer: {
    gap: 12,
  },
  logSubSection: {
    marginBottom: 8,
  },
  logSubTitle: {
    fontSize: 11,
    color: '#888',
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  logTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  moodTag: {
    backgroundColor: 'rgba(155, 93, 229, 0.08)',
    borderColor: 'rgba(155, 93, 229, 0.15)',
  },
  symptomTag: {
    backgroundColor: 'rgba(255, 35, 102, 0.08)',
    borderColor: 'rgba(255, 35, 102, 0.15)',
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  logHealthGrid: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  healthLogCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  healthLogLabel: {
    fontSize: 9,
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  healthLogVal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: 'rgba(255, 35, 102, 0.03)',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF2366',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FF2366',
  },
  notesText: {
    fontSize: 12,
    color: '#ddd',
    marginTop: 4,
    lineHeight: 16,
  },
  addLogBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
  },
  addLogBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  manageHistoryBtn: {
    backgroundColor: 'rgba(255, 35, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  manageHistoryBtnText: {
    color: '#FF2366',
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  historyModalBox: {
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyModalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeModalText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  addCycleToggleBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addCycleToggleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cycleHistoryItem: {
    backgroundColor: '#1e1e24',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
  },
  cycleHistoryDates: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cycleHistoryMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  cycleHistoryMetaText: {
    fontSize: 11,
    color: '#888',
  },
  cycleHistoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cycleHistoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cycleHistoryBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyEditBox: {
    backgroundColor: '#131316',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  historyInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  historyInputContainer: {
    flex: 1,
  },
  historyInputLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  historyInput: {
    backgroundColor: '#1e1e24',
    borderWidth: 1,
    borderColor: '#2d2d35',
    borderRadius: 8,
    height: 38,
    color: '#fff',
    paddingHorizontal: 10,
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
    marginTop: 2,
    height: 10,
    width: '100%',
  },
  microBadge: {
    fontSize: 7,
    lineHeight: 8,
  },
});
