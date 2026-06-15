import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Key, Bell, ShieldAlert, Sparkles, MessageSquare, Terminal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

export default function AdminPanelScreen() {
  const router = useRouter();

  // Mock Admin States
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [logs, setLogs] = useState([
    { time: '09:02:11', type: 'INFO', msg: 'SQLite DB connected successfully.' },
    { time: '09:02:14', type: 'WARN', msg: 'FCM push registration: token cached locally.' },
    { time: '09:03:00', type: 'INFO', msg: 'Zustand state store successfully hydrated.' },
    { time: '09:05:44', type: 'INFO', msg: 'AES notes encryption completed.' }
  ]);

  const handleSendPush = async () => {
    if (!pushTitle || !pushBody) {
      Alert.alert('Hata', 'Lütfen başlık ve mesaj girin.');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // Trigger a local notification immediately to simulate the FCM push alert!
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📣 [Kampanya] ${pushTitle}`,
          body: pushBody,
          data: { type: 'admin_push' },
        },
        trigger: null, // immediate
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Kampanya Bildirimi Gönderildi', 'Bildirim tüm aktif kullanıcılara ve cihazlara kuyruklandı.');
      setPushTitle('');
      setPushBody('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAnnouncement = () => {
    if (!announcement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulated dashboard update
    Alert.alert('Duyuru Yayınlandı', 'Duyuru ana sayfada Günün Tavsiyesi bandına eklendi.');
    setAnnouncement('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Firebase Yönetici Paneli</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 1. System Metrics Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Sparkles size={18} color="#FFD166" />
            <Text style={[styles.cardTitle, { color: '#FFD166' }]}>Sistem Metrikleri</Text>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>24.19K</Text>
              <Text style={styles.metricLabel}>Aktif Kullanıcı</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>%7.6</Text>
              <Text style={styles.metricLabel}>Premium Oranı</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>452</Text>
              <Text style={styles.metricLabel}>Gebelik Takibi</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#06D6A0' }]}>0</Text>
              <Text style={styles.metricLabel}>Hata Raporu</Text>
            </View>
          </View>
        </View>

        {/* 2. Send Push Notification Form */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Bell size={18} color="#FF2366" />
            <Text style={styles.cardTitle}>Push Bildirim Kampanyası</Text>
          </View>
          
          <TextInput
            placeholder="Bildirim Başlığı"
            placeholderTextColor="#555"
            style={styles.input}
            value={pushTitle}
            onChangeText={setPushTitle}
          />
          <TextInput
            placeholder="Bildirim Mesajı (Kampanya detayları...)"
            placeholderTextColor="#555"
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
            value={pushBody}
            onChangeText={setPushBody}
          />
          <TouchableOpacity onPress={handleSendPush} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Bildirimi Yayına Al</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Create System Announcement Form */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MessageSquare size={18} color="#00B4D8" />
            <Text style={styles.cardTitle}>Sistem İçi Duyuru</Text>
          </View>
          
          <TextInput
            placeholder="Ana sayfa tavsiyelerine eklenecek duyuru..."
            placeholderTextColor="#555"
            style={styles.input}
            value={announcement}
            onChangeText={setAnnouncement}
          />
          <TouchableOpacity onPress={handleCreateAnnouncement} style={[styles.actionBtn, { backgroundColor: '#00B4D8' }]}>
            <Text style={styles.actionBtnText}>Duyuruyu Yayınla</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Live Server Console Logs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Terminal size={18} color="#06D6A0" />
            <Text style={styles.cardTitle}>Sunucu Hata Günlüğü & Logs</Text>
          </View>
          
          <View style={styles.consoleBox}>
            {logs.map((l, idx) => (
              <Text key={idx} style={styles.consoleLine}>
                [{l.time}] <Text style={l.type === 'WARN' ? { color: '#FFB703' } : { color: '#06D6A0' }}>{l.type}</Text>: {l.msg}
              </Text>
            ))}
          </View>
        </View>

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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#131316',
    borderWidth: 1,
    borderColor: '#222228',
    borderRadius: 12,
    height: 48,
    color: '#fff',
    paddingHorizontal: 16,
    fontSize: 13,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  actionBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  consoleBox: {
    backgroundColor: '#0d0d0f',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f25',
    fontFamily: 'monospace',
  },
  consoleLine: {
    color: '#bbb',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});
