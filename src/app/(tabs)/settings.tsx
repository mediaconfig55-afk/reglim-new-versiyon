import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomAlert } from '../../components/ui/custom-alert';
import { useRouter } from 'expo-router';
import { useAppStore, PremiumTier } from '../../store/store';
import { getUnsyncedData, markCycleSynced, markLogSynced, clearDatabase } from '../../database/db';
import { savePIN, clearPIN } from '../../utils/security';
import { Shield, Sparkles, CloudRain, ToggleLeft, UserCheck, Key, HelpCircle, UserX, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { auth, syncCyclesAndLogsToCloud, restoreCyclesAndLogsFromCloud } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import CryptoJS from 'crypto-js';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const {
    user,
    logout,
    isPregnancyMode,
    setPregnancyMode,
    isPremium,
    premiumTier,
    setPremium,
    pinEnabled,
    biometricsEnabled,
    setSecurityConfig,
    lastSyncTime,
    setLastSyncTime,
    syncStatus,
    setSyncStatus,
  } = useAppStore();

  const [syncing, setSyncing] = useState(false);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

  // Custom PIN states
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  // Admin secret modal state
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');

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

  const handlePregnancyToggle = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPregnancyMode(val);
    if (val) {
      setAlertConfig({
        visible: true,
        title: 'Gebelik Modu Aktif 👶',
        message: 'Uygulama gebelik takibi moduna geçirildi. Ana sayfada bebek gelişimini görebilirsiniz.',
        type: 'success',
        confirmText: 'Tamam',
        onConfirm: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          router.push('/pregnancy');
        }
      });
    }
  };

  const handlePinToggle = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (val) {
      setPinModalVisible(true);
    } else {
      await clearPIN();
      setSecurityConfig(false, false);
      setAlertConfig({
        visible: true,
        title: 'PIN Kodu Kaldırıldı',
        message: 'Şifre koruması devre dışı bırakıldı.',
        type: 'info',
        onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
      });
    }
  };

  const handleBiometricsToggle = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSecurityConfig(pinEnabled, val);
  };

  const handleSyncData = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user?.uid) {
      setAlertConfig({
        visible: true,
        title: 'Giriş Yapılmadı',
        message: 'Bulut senkronizasyonu için lütfen önce giriş yapın.',
        type: 'warning',
        onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    setSyncing(true);
    setSyncStatus('syncing');

    try {
      const success = await syncCyclesAndLogsToCloud(user.uid);
      if (success) {
        const dateStr = new Date().toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        setLastSyncTime(dateStr);
        setSyncStatus('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAlertConfig({
          visible: true,
          title: 'Senkronizasyon Başarılı',
          message: 'Yerel verileriniz Firebase bulut sunucularına yedeklendi.',
          type: 'success',
          confirmText: 'Harika',
          onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
        });
      } else {
        throw new Error('Sync failed');
      }
    } catch (e) {
      setSyncStatus('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAlertConfig({
        visible: true,
        title: 'Hata',
        message: 'Bulut senkronizasyonu sırasında bir hata oluştu. Lütfen bağlantınızı kontrol edin.',
        type: 'error',
        onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
      });
    } finally {
      setSyncing(false);
    }
  };

  const [restoring, setRestoring] = useState(false);

  const handleRestoreData = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user?.uid) {
      setAlertConfig({
        visible: true,
        title: 'Giriş Yapılmadı',
        message: 'Verileri buluttan geri yüklemek için lütfen önce giriş yapın.',
        type: 'warning',
        onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    setAlertConfig({
      visible: true,
      title: '📥 Verileri Geri Yükle',
      message: 'Buluttaki yedeklerinizi indirmek istiyor musunuz? Cihazınızdaki mevcut yerel veriler silinip üzerine yazılacaktır.',
      type: 'question',
      confirmText: 'Evet, Yükle',
      cancelText: 'İptal',
      onCancel: () => setAlertConfig(prev => ({ ...prev, visible: false })),
      onConfirm: async () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        setRestoring(true);
        try {
          const success = await restoreCyclesAndLogsFromCloud(user.uid);
          if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setAlertConfig({
              visible: true,
              title: 'Başarılı',
              message: 'Döngü ve sağlık verileriniz buluttan başarıyla geri yüklendi.',
              type: 'success',
              onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
            });
          } else {
            throw new Error('Restore failed');
          }
        } catch (e) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setAlertConfig({
            visible: true,
            title: 'Hata',
            message: 'Geri yükleme sırasında bir sorun oluştu. Bulutta yedeğiniz olmayabilir.',
            type: 'error',
            onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
          });
        } finally {
          setRestoring(false);
        }
      }
    });
  };

  const handlePurchaseMock = (tier: PremiumTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBillingLoading(tier);

    // Mock Google Play Billing Sandbox transaction
    setTimeout(() => {
      setPremium(tier);
      setBillingLoading(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlertConfig({
        visible: true,
        title: 'Abonelik Başarılı 🌟',
        message: `Tebrikler! ${tier === 'premium' ? 'Premium' : 'Premium Plus'} paketiniz başarıyla tanımlandı.`,
        type: 'success',
        confirmText: 'Kullanmaya Başla',
        onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
      });
    }, 1200);
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAlertConfig({
      visible: true,
      title: 'Çıkış Yap',
      message: 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      type: 'question',
      confirmText: 'Çıkış Yap',
      cancelText: 'İptal',
      onCancel: () => setAlertConfig(prev => ({ ...prev, visible: false })),
      onConfirm: async () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        try {
          await signOut(auth);
        } catch (err) {
          console.error('Firebase signout error:', err);
        }
        await clearDatabase();
        await logout();
        router.replace('/(auth)/login');
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={1}
            delayLongPress={3000}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setAdminModalVisible(true);
            }}
          >
            <Text style={styles.headerTitle}>Ayarlar & Güvenlik</Text>
          </TouchableOpacity>
          <Text style={styles.headerSub}>Profilinizi ve güvenlik tercihlerinizi özelleştirin</Text>
        </View>

        {/* 1. Account Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.profileName}>{user?.displayName || 'Kayıtlı Kullanıcı'}</Text>
              <Text style={styles.profileEmail}>
                {user?.isAnonymous ? 'Çevrimdışı Misafir Hesabı' : user?.email}
              </Text>
            </View>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Sparkles size={10} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.premiumBadgeText}>
                  {premiumTier === 'premium' ? 'Premium' : 'Plus'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 2. App Mode Configuration */}
        <View style={styles.card}>
          <View style={styles.settingHeaderRow}>
            <UserCheck size={18} color="#FF2366" />
            <Text style={styles.settingHeaderTitle}>Mod Seçimi</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.settingLabel}>Hamilelik Modu</Text>
              <Text style={styles.settingDesc}>
                Gebelik takibi, trimester bilgileri ve hafta hafta bebek gelişimini aktif edin.
              </Text>
            </View>
            <Switch
              value={isPregnancyMode}
              onValueChange={handlePregnancyToggle}
              trackColor={{ false: '#3a3a40', true: '#FF2366' }}
              thumbColor={isPregnancyMode ? '#fff' : '#888'}
            />
          </View>
        </View>

        {/* 3. Security (PIN & Biometrics) */}
        <View style={styles.card}>
          <View style={styles.settingHeaderRow}>
            <Shield size={18} color="#FF2366" />
            <Text style={styles.settingHeaderTitle}>Güvenlik & Gizlilik</Text>
          </View>

          {/* PIN Toggle */}
          <View style={styles.settingItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>PIN Kodu Kilidi</Text>
              <Text style={styles.settingDesc}>Uygulama açılışında 4 haneli güvenlik şifresi iste.</Text>
            </View>
            <Switch
              value={pinEnabled}
              onValueChange={handlePinToggle}
              trackColor={{ false: '#3a3a40', true: '#FF2366' }}
              thumbColor={pinEnabled ? '#fff' : '#888'}
            />
          </View>

          {/* Change PIN Button */}
          {pinEnabled && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPinModalVisible(true);
              }}
              style={styles.changePinBtn}
            >
              <Key size={16} color="#FF2366" style={{ marginRight: 6 }} />
              <Text style={styles.changePinBtnText}>PIN Kodunu Değiştir</Text>
            </TouchableOpacity>
          )}

          {/* Biometrics Toggle */}
          {pinEnabled && (
            <View style={styles.settingItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Biyometrik Giriş (Parmak İzi)</Text>
                <Text style={styles.settingDesc}>PIN kodu yerine parmak izi ile hızlı geçiş yap.</Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleBiometricsToggle}
                trackColor={{ false: '#3a3a40', true: '#FF2366' }}
                thumbColor={biometricsEnabled ? '#fff' : '#888'}
              />
            </View>
          )}
        </View>

        {/* 4. Backup & Sync Status (Firestore Sync) */}
        <View style={styles.card}>
          <View style={styles.settingHeaderRow}>
            <CloudRain size={18} color="#FF2366" />
            <Text style={styles.settingHeaderTitle}>Yedekleme & Eşitleme</Text>
          </View>

          <View style={[styles.syncContainer, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.syncLabel}>Bulut Senkronizasyonu</Text>
              <Text style={styles.syncDesc}>
                Son yedekleme: {lastSyncTime || 'Yedek Alınmadı'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={handleSyncData}
                style={[styles.syncBtn, { flex: 1, alignItems: 'center' }]}
                disabled={syncing || restoring}
              >
                {syncing ? (
                  <ActivityIndicator color="#FF2366" size="small" />
                ) : (
                  <Text style={styles.syncBtnText}>Şimdi Eşitle</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRestoreData}
                style={[styles.syncBtn, { flex: 1, alignItems: 'center', borderColor: '#9B5DE5' }]}
                disabled={syncing || restoring}
              >
                {restoring ? (
                  <ActivityIndicator color="#9B5DE5" size="small" />
                ) : (
                  <Text style={[styles.syncBtnText, { color: '#9B5DE5' }]}>Buluttan Yükle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 5. Subscription Hub (Billing mock triggers) - GİZLENDİ (Google Play Reddi Önlemek İçin)
        <View style={styles.card}>
          <View style={styles.settingHeaderRow}>
            <Sparkles size={18} color="#FFD166" />
            <Text style={[styles.settingHeaderTitle, { color: '#FFD166' }]}>Abonelik Paketleri</Text>
          </View>

          <Text style={styles.billingSub}>
            Uygulama deneyiminizi premium özellikler ile zenginleştirin:
          </Text>

          <View style={styles.billingGrid}>
            <View style={[styles.tierCard, premiumTier === 'free' && styles.tierCardActive]}>
              <Text style={styles.tierName}>Standart</Text>
              <Text style={styles.tierPrice}>Ücretsiz</Text>
              <Text style={styles.tierFeature}>✓ Temel Adet Takibi</Text>
              <Text style={styles.tierFeature}>✓ SQLite Lokal Depolama</Text>
            </View>

            <TouchableOpacity
              onPress={() => handlePurchaseMock('premium')}
              style={[styles.tierCard, premiumTier === 'premium' && styles.tierCardActive]}
              disabled={billingLoading !== null}
            >
              {billingLoading === 'premium' ? (
                <ActivityIndicator color="#FF2366" style={{ marginVertical: 20 }} />
              ) : (
                <>
                  <Text style={styles.tierName}>Premium</Text>
                  <Text style={styles.tierPrice}>₺59.90/ay</Text>
                  <Text style={styles.tierFeature}>✓ Reklamsız Deneyim</Text>
                  <Text style={styles.tierFeature}>✓ Akıllı Yapay Zeka</Text>
                  <Text style={styles.tierFeature}>✓ PDF Doktor Raporları</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePurchaseMock('premium_plus')}
              style={[styles.tierCard, premiumTier === 'premium_plus' && styles.tierCardActive]}
              disabled={billingLoading !== null}
            >
              {billingLoading === 'premium_plus' ? (
                <ActivityIndicator color="#FF2366" style={{ marginVertical: 20 }} />
              ) : (
                <>
                  <Text style={styles.tierName}>Plus</Text>
                  <Text style={styles.tierPrice}>₺99.90/ay</Text>
                  <Text style={styles.tierFeature}>✓ Gebelik Modu</Text>
                  <Text style={styles.tierFeature}>✓ Sınırsız Bulut Sync</Text>
                  <Text style={styles.tierFeature}>✓ 7/24 Doktor Desteği</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        */}


        {/* Logout Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <UserX size={18} color="#FF4D6D" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Oturumu Kapat</Text>
        </TouchableOpacity>

        {/* Padding for bottom tab bar */}
        <View style={{ height: Math.max(120, insets.bottom + 80) }} />
      </ScrollView>

      {/* PIN Setup Modal */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.pinModalBg}>
          <View style={styles.pinModalBox}>
            <Text style={styles.pinModalTitle}>Güvenlik PIN Kodu</Text>
            <Text style={styles.pinModalSub}>Giriş şifrenizi tanımlamak için 4 haneli bir şifre girin.</Text>
            
            <View style={styles.pinModalInputGroup}>
              <Text style={styles.pinModalInputLabel}>Yeni PIN Kodu</Text>
              <TextInput
                style={styles.pinModalInput}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                placeholder="••••"
                placeholderTextColor="#666"
                value={newPinInput}
                onChangeText={setNewPinInput}
              />
            </View>

            <View style={styles.pinModalInputGroup}>
              <Text style={styles.pinModalInputLabel}>Yeni PIN Kodu (Tekrar)</Text>
              <TextInput
                style={styles.pinModalInput}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                placeholder="••••"
                placeholderTextColor="#666"
                value={confirmPinInput}
                onChangeText={setConfirmPinInput}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.pinModalBtn, { backgroundColor: '#333' }]}
                onPress={() => {
                  setPinModalVisible(false);
                  setNewPinInput('');
                  setConfirmPinInput('');
                  if (!pinEnabled) {
                    setSecurityConfig(false, false);
                  }
                }}
              >
                <Text style={styles.pinModalBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinModalBtn, { backgroundColor: '#FF2366' }]}
                onPress={async () => {
                  const numRegex = /^\d{4}$/;
                  if (!numRegex.test(newPinInput)) {
                    setAlertConfig({
                      visible: true,
                      title: 'Hata',
                      message: 'Girdiğiniz PIN kodu tam olarak 4 haneli bir sayı olmalıdır.',
                      type: 'error',
                      onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                    });
                    return;
                  }
                  if (newPinInput !== confirmPinInput) {
                    setAlertConfig({
                      visible: true,
                      title: 'Hata',
                      message: 'Girdiğiniz PIN kodları birbiriyle uyuşmuyor.',
                      type: 'error',
                      onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                    });
                    return;
                  }
                  
                  await savePIN(newPinInput);
                  setSecurityConfig(true, biometricsEnabled);
                  setPinModalVisible(false);
                  setNewPinInput('');
                  setConfirmPinInput('');
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setAlertConfig({
                    visible: true,
                    title: 'Başarılı',
                    message: 'Giriş şifreniz başarıyla aktif edildi ve kaydedildi.',
                    type: 'success',
                    onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                  });
                }}
              >
                <Text style={styles.pinModalBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Secret Admin Modal */}
      <Modal visible={adminModalVisible} transparent animationType="fade">
        <View style={styles.adminModalBg}>
          <View style={styles.adminModalBox}>
            <Text style={styles.adminModalTitle}>Gizli Yönetici Paneli</Text>
            <Text style={styles.adminModalSub}>Bu alan sadece size özeldir. Lütfen şifrenizi girin.</Text>
            <TextInput
              style={styles.adminModalInput}
              secureTextEntry
              autoFocus
              placeholder="Yönetici Şifresi"
              placeholderTextColor="#666"
              value={adminPasscode}
              onChangeText={setAdminPasscode}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.adminModalBtn, { backgroundColor: '#333' }]}
                onPress={() => {
                  setAdminModalVisible(false);
                  setAdminPasscode('');
                }}
              >
                <Text style={styles.adminModalBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminModalBtn, { backgroundColor: '#FF2366' }]}
                onPress={() => {
                  const hashedInput = CryptoJS.SHA256(adminPasscode).toString();
                  if (hashedInput === '6e753a6b0a37cd1032c991ba167cee596db9adca33162ea9e48a0ba86c4daed3') {
                    setAdminModalVisible(false);
                    setAdminPasscode('');
                    router.push('/admin');
                  } else {
                    setAlertConfig({
                      visible: true,
                      title: 'Erişim Reddedildi',
                      message: 'Hatalı yönetici şifresi.',
                      type: 'error',
                      onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                    });
                    setAdminPasscode('');
                  }
                }}
              >
                <Text style={styles.adminModalBtnText}>Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  container: {
    flex: 1,
    backgroundColor: '#121214',
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
  card: {
    backgroundColor: '#18181c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#301520',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF2366',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF2366',
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileEmail: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD166',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  premiumBadgeText: {
    color: '#121214',
    fontSize: 10,
    fontWeight: 'bold',
  },
  settingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 12,
    marginBottom: 16,
  },
  settingHeaderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.02)',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  settingDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    lineHeight: 15,
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  syncDesc: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  syncBtn: {
    backgroundColor: 'rgba(255, 35, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  syncBtnText: {
    color: '#FF2366',
    fontSize: 12,
    fontWeight: 'bold',
  },
  billingSub: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 16,
    marginBottom: 16,
  },
  billingGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tierCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tierCardActive: {
    borderColor: '#FFD166',
    backgroundColor: 'rgba(255, 209, 102, 0.05)',
  },
  tierName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD166',
    marginVertical: 6,
  },
  tierFeature: {
    fontSize: 9,
    color: '#888',
    marginTop: 6,
    lineHeight: 12,
  },
  adminCard: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderStyle: 'dashed',
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#bbb',
    marginLeft: 8,
  },
  adminSub: {
    fontSize: 11,
    color: '#555',
    marginTop: 6,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: 'rgba(255, 77, 109, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.15)',
    borderRadius: 16,
    marginTop: 10,
  },
  logoutBtnText: {
    color: '#FF4D6D',
    fontSize: 14,
    fontWeight: 'bold',
  },
  adminModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  adminModalBox: {
    backgroundColor: '#18181c',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  adminModalTitle: {
    color: '#FF2366',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  adminModalSub: {
    color: '#888',
    fontSize: 12,
    marginBottom: 20,
  },
  adminModalInput: {
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    color: '#fff',
    padding: 16,
    fontSize: 16,
  },
  adminModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminModalBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  changePinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 8,
  },
  changePinBtnText: {
    color: '#FF2366',
    fontSize: 13,
    fontWeight: 'bold',
  },
  pinModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinModalBox: {
    backgroundColor: '#18181c',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  pinModalTitle: {
    color: '#FF2366',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pinModalSub: {
    color: '#888',
    fontSize: 12,
    marginBottom: 16,
  },
  pinModalInputGroup: {
    marginBottom: 12,
  },
  pinModalInputLabel: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '600',
  },
  pinModalInput: {
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    color: '#fff',
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinModalBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
