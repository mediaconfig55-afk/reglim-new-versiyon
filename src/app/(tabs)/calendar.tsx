import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getCycles, getDailyLogsRange, DailyLogInput } from '../../database/db';
import { calculatePredictions, PredictionResult } from '../../utils/periodEngine';
import { ChevronLeft, ChevronRight, Filter, Plus, Calendar as CalendarIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../../utils/date';

export default function CalendarScreen() {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(getLocalDateString());
  const [cycles, setCycles] = useState<any[]>([]);
  const [logs, setLogs] = useState<{ [key: string]: DailyLogInput }>({});
  const [predictions, setPredictions] = useState<PredictionResult | null>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<'all' | 'period' | 'symptoms'>('all');

  const loadCalendarData = async () => {
    try {
      const dbCycles = await getCycles();
      setCycles(dbCycles);

      // Predictions
      const todayStr = getLocalDateString();
      const result = calculatePredictions(dbCycles, todayStr);
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
    if (!predictions) return { isPeriod: false, isFertile: false, isOvulation: false, hasLog: false };

    const todayVal = new Date(dateStr).getTime();
    
    // Check local database cycles to see if period occurred
    const isLoggedPeriod = cycles.some(c => {
      const start = new Date(c.start_date).getTime();
      const end = c.end_date ? new Date(c.end_date).getTime() : new Date(c.start_date).getTime() + 4*24*60*60*1000;
      return todayVal >= start && todayVal <= end;
    });

    // Check future predictions
    let isPredPeriod = false;
    let isFertile = false;
    let isOvulation = false;

    predictions.futureCycles.forEach(fc => {
      const start = new Date(fc.startDate).getTime();
      const end = new Date(fc.endDate).getTime();
      const fertS = new Date(fc.fertileStart).getTime();
      const fertE = new Date(fc.fertileEnd).getTime();
      const ov = new Date(fc.ovulationDate).getTime();

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
    const hasLog = !!log && ((log.moods && log.moods.length > 0) || (log.symptoms && log.symptoms.length > 0));

    return {
      isPeriod: isLoggedPeriod || isPredPeriod,
      isFertile,
      isOvulation,
      hasLog,
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

        {/* Filter Bar */}
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
                  {status.hasLog && !status.isPeriod && (
                    <View style={styles.logDot} />
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
              {new Date(selectedDateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
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
        <View style={{ height: 140 }} />
      </ScrollView>
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
});
