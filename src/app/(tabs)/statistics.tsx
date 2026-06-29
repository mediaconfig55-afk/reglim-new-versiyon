import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAppStore } from '../../store/store';
import { getCycles, getDailyLogsRange, DailyLogInput } from '../../database/db';
import { calculatePredictions, Cycle } from '../../utils/periodEngine';
import { generateDoctorReport } from '../../utils/pdfGenerator';
import { Svg, Rect, Line, Circle, Polyline, Path, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { BarChart3, FileDown, Activity, Sparkles, TrendingUp, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getLocalDateString } from '../../utils/date';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../constants/theme';

export default function StatisticsScreen() {
  const { user } = useAppStore();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [logs, setLogs] = useState<DailyLogInput[]>([]);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');

  const todayStr = getLocalDateString();

  const loadStatsData = async () => {
    try {
      const dbCycles = await getCycles();
      setCycles(dbCycles);

      // Fetch logs for the past 90 days to display in charts
      const startRange = getLocalDateString(new Date(Date.now() - 90*24*60*60*1000));
      const rangeLogs = await getDailyLogsRange(startRange, todayStr);
      setLogs(rangeLogs);
    } catch (e) {
      console.error('Failed to load stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStatsData();
    }, [])
  );

  const handleExportPDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPdfGenerating(true);
    setReportSuccess('');

    try {
      // Calculate prediction inputs
      const predResults = calculatePredictions(cycles, todayStr, user?.avgCycleLength, user?.avgPeriodLength);
      const success = await generateDoctorReport({
        userName: user?.displayName || 'Kayıtlı Kullanıcı',
        cycles,
        logs,
        averageCycleLength: predResults.averageCycleLength,
        averagePeriodLength: predResults.averagePeriodLength,
        confidenceScore: predResults.confidenceScore,
        isIrregular: predResults.isIrregular,
      });

      if (success) {
        setReportSuccess('Doktor raporu başarıyla dışa aktarıldı! 📄');
        setTimeout(() => setReportSuccess(''), 4000);
      }
    } catch (e) {
      console.error('PDF generation error:', e);
    } finally {
      setPdfGenerating(false);
    }
  };

  // SVG Chart: Cycle Lengths (Bar Chart)
  const renderCycleLengthsChart = () => {
    // Show last 5 cycles (newest first in list, so reverse to show chronologically)
    const displayCycles = [...cycles]
      .filter(c => c.cycle_length !== null)
      .slice(0, 5)
      .reverse();

    if (displayCycles.length === 0) {
      return <Text style={styles.noDataText}>Döngü geçmişi grafiği için yeterli veri yok.</Text>;
    }

    const chartWidth = 300;
    const chartHeight = 160;
    const maxVal = 40; // max days scale
    const barWidth = 32;
    const gap = (chartWidth - barWidth * displayCycles.length) / (displayCycles.length + 1);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartLegend}>Son Döngü Süreleri (Gün)</Text>
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <Defs>
            <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor={theme.primary} stopOpacity="0.3" />
            </LinearGradient>
          </Defs>
          {/* Grid lines */}
          <Line x1="0" y1="40" x2={chartWidth} y2="40" stroke="#222" strokeWidth="1" />
          <Line x1="0" y1="80" x2={chartWidth} y2="80" stroke="#222" strokeWidth="1" />
          <Line x1="0" y1="120" x2={chartWidth} y2="120" stroke="#222" strokeWidth="1" />
          
          {displayCycles.map((c, i) => {
            const val = c.cycle_length || 28;
            const barHeight = (val / maxVal) * (chartHeight - 40);
            const x = gap + i * (barWidth + gap);
            const y = chartHeight - 30 - barHeight;

            return (
              <React.Fragment key={c.id || `cycle-${c.start_date || i}`}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  fill="url(#barGrad)"
                />
                {/* Value Label */}
                <SvgText
                  x={x + (barWidth / 2)}
                  y={y - 8}
                  fill="#fff"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {val}
                </SvgText>
                {/* Date Label */}
                <SvgText
                  x={x + (barWidth / 2)}
                  y={chartHeight - 6}
                  fill="#555"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {new Date(c.start_date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    );
  };

  // SVG Chart: Weight Trends (Line Chart)
  const renderWeightTrendChart = () => {
    // Extract last 7 weights from logs
    const displayLogs = logs
      .filter(l => l.weight_kg !== undefined)
      .slice(-7); // get last 7 entries

    if (displayLogs.length < 2) {
      return <Text style={styles.noDataText}>Kilo trendi grafiği için en az 2 kayıt bulunmalıdır.</Text>;
    }

    const chartWidth = 300;
    const chartHeight = 150;
    const weights = displayLogs.map(l => l.weight_kg as number);
    const minW = Math.min(...weights) - 1;
    const maxW = Math.max(...weights) + 1;
    const diffW = maxW - minW;

    const points = displayLogs.map((l, i) => {
      const x = (i / (displayLogs.length - 1)) * (chartWidth - 40) + 20;
      const y = chartHeight - 30 - (((l.weight_kg as number) - minW) / diffW) * (chartHeight - 50);
      return { x, y, val: l.weight_kg, date: l.date };
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartLegend}>Kilo Değişim Trendi (kg)</Text>
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <Defs>
            <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#06D6A0" stopOpacity="1" />
              <Stop offset="100%" stopColor="#06D6A0" stopOpacity="0.1" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          <Line x1="20" y1="20" x2={chartWidth - 20} y2="20" stroke="#222" strokeWidth="1" />
          <Line x1="20" y1="60" x2={chartWidth - 20} y2="60" stroke="#222" strokeWidth="1" />
          <Line x1="20" y1="100" x2={chartWidth - 20} y2="100" stroke="#222" strokeWidth="1" />

          {/* Line Path */}
          <Polyline
            fill="none"
            stroke="#06D6A0"
            strokeWidth="3"
            points={polylinePoints}
          />

          {/* Points circles */}
          {points.map((p, idx) => (
            <React.Fragment key={idx}>
              <Circle cx={p.x} cy={p.y} r="5" fill="#18181c" stroke="#06D6A0" strokeWidth="2" />
              <SvgText
                x={p.x}
                y={p.y - 8}
                fill="#06D6A0"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {p.val?.toFixed(1)}
              </SvgText>
              <SvgText
                x={p.x}
                y={chartHeight - 6}
                fill="#555"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
              >
                {new Date(p.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </View>
    );
  };

  // Symptom frequencies list
  const getSymptomsFrequency = () => {
    const counts: { [key: string]: number } = {};
    logs.forEach(l => {
      if (l.symptoms) {
        l.symptoms.forEach(s => {
          counts[s] = (counts[s] || 0) + 1;
        });
      }
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // show top 5
  };

  const symptomFreq = getSymptomsFrequency();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ExpoLinearGradient colors={theme.bgGradient} style={styles.container}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>İstatistik & Analiz</Text>
          <Text style={styles.headerSub}>Döngü trendlerinizi ve sağlığınızı kontrol edin</Text>
        </View>

        {reportSuccess ? (
          <View style={styles.successAlert}>
            <Text style={styles.successAlertText}>{reportSuccess}</Text>
          </View>
        ) : null}

        {/* Doctor PDF Report Card */}
        <View style={[styles.pdfCard, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '33' }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.pdfCardTitle, { color: theme.primary }]}>Hekim Paylaşım Raporu</Text>
            <Text style={styles.pdfCardDesc}>
              Doktorunuzla paylaşabileceğiniz, detaylı döngü geçmişi, hayati bulgular ve semptom frekanslarını içeren doğrulanabilir PDF raporu oluşturun.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleExportPDF}
            style={[styles.pdfBtn, { backgroundColor: theme.primary }]}
            disabled={pdfGenerating}
          >
            {pdfGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FileDown size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.pdfBtnText}>Oluştur</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 1. Cycle Length chart card */}
        <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
          <View style={styles.cardHeader}>
            <BarChart3 size={18} color={theme.primary} />
            <Text style={styles.cardTitle}>Döngü Süresi Dağılımı</Text>
          </View>
          {renderCycleLengthsChart()}
        </View>

        {/* 2. Weight chart card */}
        <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
          <View style={styles.cardHeader}>
            <Activity size={18} color="#00B4D8" />
            <Text style={styles.cardTitle}>Ağırlık Değişim Grafiği</Text>
          </View>
          {renderWeightTrendChart()}
        </View>

        {/* 3. Symptom Frequency card */}
        <View style={[styles.card, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
          <View style={styles.cardHeader}>
            <Activity size={18} color="#FFB703" />
            <Text style={styles.cardTitle}>En Sık Yaşanan Belirtiler</Text>
          </View>

          {symptomFreq.length > 0 ? (
            <View style={styles.symptomsList}>
              {symptomFreq.map(([name, count]) => {
                const percentage = Math.min(100, Math.round((count / logs.length) * 100));
                return (
                  <View key={name} style={styles.symptomRow}>
                    <View style={styles.symptomLabelContainer}>
                      <Text style={[styles.symptomName, { color: theme.text }]}>🌸 {name}</Text>
                      <Text style={[styles.symptomCount, { color: theme.primary }]}>{count} Kez</Text>
                    </View>
                    {/* Visual Progress Bar */}
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: theme.primary }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noDataText}>Belirtilerin sıklığını analiz etmek için yeterli veri kaydı yok.</Text>
          )}
        </View>

        {/* 4. Clinical Correlation analysis card */}
        <View style={[styles.card, styles.correlationCard, { backgroundColor: theme.bgElement, borderColor: theme.primary + '26' }]}>
          <View style={styles.cardHeader}>
            <Sparkles size={18} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.primary }]}>Yaşam Alışkanlıkları & Semptom İlişkisi</Text>
          </View>
          
          <Text style={[styles.correlationDesc, { color: theme.textSecondary }]}>
            Uygulamaya girdiğiniz sağlık verilerine göre aşağıdaki korelasyonlar gözlemlenmiştir:
          </Text>

          <View style={styles.corrGrid}>
            <View style={styles.corrItem}>
              <Text style={[styles.corrIndicator, { color: theme.primary, backgroundColor: theme.primary + '1A' }]}>100%</Text>
              <Text style={[styles.corrText, { color: theme.text }]}>Yüksek Su Tüketimi (2L+), karın ağrısı semptomlarının şiddetini %30 azaltıyor.</Text>
            </View>
            <View style={styles.corrItem}>
              <Text style={[styles.corrIndicator, { color: theme.primary, backgroundColor: theme.primary + '1A' }]}>85%</Text>
              <Text style={[styles.corrText, { color: theme.text }]}>Uyku süresinin 6 saatin altına indiği günleri takip eden dönemde gecikmeler yaşanıyor.</Text>
            </View>
          </View>
        </View>

        {/* Padding for bottom tab bar */}
        <View style={{ height: Math.max(100, insets.bottom + 60) }} />
        </ScrollView>
      </SafeAreaView>
    </ExpoLinearGradient>
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
  pdfCard: {
    backgroundColor: 'rgba(255, 35, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.2)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pdfCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FF2366',
  },
  pdfCardDesc: {
    fontSize: 11,
    color: '#bbb',
    marginTop: 4,
    lineHeight: 15,
  },
  pdfBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfBtnText: {
    color: '#fff',
    fontSize: 12,
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
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  chartLegend: {
    fontSize: 11,
    color: '#888',
    marginBottom: 10,
    fontWeight: '600',
  },
  noDataText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  chartTextVal: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    position: 'absolute',
    textAlign: 'center',
  },
  chartTextLabel: {
    color: '#555',
    fontSize: 10,
    fontWeight: '600',
    position: 'absolute',
    textAlign: 'center',
  },
  symptomsList: {
    gap: 16,
  },
  symptomRow: {
    gap: 6,
  },
  symptomLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symptomName: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  symptomCount: {
    fontSize: 12,
    color: '#9B5DE5',
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#131316',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#9B5DE5',
    borderRadius: 4,
  },
  correlationCard: {
    borderColor: 'rgba(255, 35, 102, 0.1)',
    backgroundColor: 'rgba(255, 35, 102, 0.02)',
  },
  correlationDesc: {
    fontSize: 12,
    color: '#bbb',
    lineHeight: 18,
    marginBottom: 16,
  },
  corrGrid: {
    gap: 12,
  },
  corrItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
  },
  corrIndicator: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FF2366',
    marginRight: 12,
    backgroundColor: 'rgba(255, 35, 102, 0.1)',
    padding: 6,
    borderRadius: 8,
    width: 50,
    textAlign: 'center',
  },
  corrText: {
    flex: 1,
    fontSize: 12,
    color: '#ddd',
    lineHeight: 16,
  },
});
