import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/store';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Mail, Lock, User, Sparkles, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithCredential, 
  GoogleAuthProvider, 
  signInAnonymously, 
  updateProfile 
} from 'firebase/auth';
import { auth, restoreCyclesAndLogsFromCloud, restoreUserProfile } from '../../services/firebase';

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAppStore(state => state.setUser);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successUserName, setSuccessUserName] = useState('');
  const [pendingSessionUser, setPendingSessionUser] = useState<any>(null);

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pendingSessionUser) {
      setUser(pendingSessionUser);
    } else {
      router.replace('/(tabs)');
    }
  };

  // Configure Google Sign-In once on mount (native only)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({
        webClientId: '393754770159-37gitini3bo06i37vk1bjmmaup3qicrt.apps.googleusercontent.com',
        offlineAccess: false,
      });
    }
  }, []);

  const handleAuthenticate = async () => {
    if (!email || !password || (!isLogin && !name)) {
      setError('Lütfen tüm alanları doldurun.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
        await updateProfile(userCredential.user, { displayName: name });
      }

      const fbUser = userCredential.user;
      const sessionUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || name || 'Kullanıcı',
        isAnonymous: false,
      };

      let cloudProfile = null;
      if (isLogin) {
        await restoreCyclesAndLogsFromCloud(fbUser.uid);
        cloudProfile = await restoreUserProfile(fbUser.uid);
      }

      const mergedSessionUser = {
        ...sessionUser,
        displayName: cloudProfile?.displayName || sessionUser.displayName,
        birthDate: cloudProfile?.birthDate || undefined,
        avgCycleLength: cloudProfile?.avgCycleLength || undefined,
        avgPeriodLength: cloudProfile?.avgPeriodLength || undefined,
      };

      await AsyncStorage.setItem('user_session', JSON.stringify(mergedSessionUser));
      setUser(mergedSessionUser);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('Auth Error:', e);
      let errMsg = 'Giriş/Kayıt sırasında hata oluştu.';
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        errMsg = 'E-posta veya şifre hatalı.';
      } else if (e.code === 'auth/email-already-in-use') {
        errMsg = 'Bu e-posta adresi zaten kullanımda.';
      } else if (e.code === 'auth/weak-password') {
        errMsg = 'Şifre en az 6 karakter olmalıdır.';
      } else if (e.code === 'auth/invalid-email') {
        errMsg = 'Geçersiz e-posta adresi.';
      }
      setError(errMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') return;
    setLoading(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      let user = null;
      let isCancelled = false;

      if (response && typeof response === 'object') {
        if ('type' in response) {
          // New v16+ response structure
          if (response.type === 'success') {
            user = response.data;
          } else if (response.type === 'cancelled') {
            isCancelled = true;
          }
        } else {
          // Legacy pre-v16 response structure (response is directly the user object)
          user = response as any;
        }
      }

      if (isCancelled) {
        setError('');
        setLoading(false);
        return;
      }

      if (!user) {
        throw new Error('Google Sign-In başarısız: Kullanıcı verisi alınamadı.');
      }

      const idToken = user.idToken;

      if (!idToken) {
        throw new Error(
          'Google Sign-In başarısız: ID Token alınamadı.\n' +
          'Google Cloud/Firebase Console\'da OAuth Web Client ID yapılandırmasını kontrol edin.'
        );
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const fbUser = userCredential.user;

      const sessionUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || 'Google Kullanıcısı',
        isAnonymous: false,
      };

      await restoreCyclesAndLogsFromCloud(fbUser.uid);
      const cloudProfile = await restoreUserProfile(fbUser.uid);

      const mergedSessionUser = {
        ...sessionUser,
        displayName: cloudProfile?.displayName || fbUser.displayName || sessionUser.displayName,
        birthDate: cloudProfile?.birthDate || undefined,
        avgCycleLength: cloudProfile?.avgCycleLength || undefined,
        avgPeriodLength: cloudProfile?.avgPeriodLength || undefined,
      };

      await AsyncStorage.setItem('user_session', JSON.stringify(mergedSessionUser));
      // Save user session in pending state and show modal first (do NOT call setUser yet)
      setPendingSessionUser(mergedSessionUser);
      setSuccessUserName(mergedSessionUser.displayName);
      setShowSuccessModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error('Google Sign-In error:', e?.code, e?.message);
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // Kullanıcı iptal etti – sessizce geç
        setError('');
      } else if (e.code === statusCodes.IN_PROGRESS) {
        setError('Giriş işlemi devam ediyor, lütfen bekleyin.');
      } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Hizmetleri kullanılamıyor. Lütfen güncelleyin.');
      } else {
        // Show specific help for Developer Error 10 (mismatched/missing SHA-1 fingerprint)
        let message = 'Google ile giriş yapılırken hata oluştu. Lütfen tekrar deneyin.';
        if (e.code === '10' || e.code === 'DEVELOPER_ERROR') {
          message = 'Google Sign-In Geliştirici Hatası (Hata Kodu: 10).\n' +
                    'Bu hata genellikle uygulamanın SHA-1 parmak izi ile Firebase Console\'daki SHA-1 kaydının eşleşmemesinden kaynaklanır.\n' +
                    'Lütfen hem debug (yerel test) hem de release (canlı/eas) SHA-1 parmak izlerinizin Firebase\'e eklendiğinden emin olun.';
        } else if (e.message && (e.message.includes('ID Token') || e.message.includes('Web Client ID'))) {
          message = e.message;
        }
        setError(message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineMode = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const userCredential = await signInAnonymously(auth);
      const fbUser = userCredential.user;

      const offlineUser = {
        uid: fbUser.uid,
        email: null,
        displayName: 'Misafir Kullanıcı',
        isAnonymous: true,
      };

      await AsyncStorage.setItem('user_session', JSON.stringify(offlineUser));
      setUser(offlineUser);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e) {
      console.error('Anonymous Auth Error:', e);
      setError('Misafir girişi sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1015', '#121214']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          {/* Logo / Title */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Heart size={44} color="#FF2366" fill="#FF2366" />
            </View>
            <Text style={styles.appName}>Reglim & Takvim</Text>
            <Text style={styles.appTagline}>Kadın Sağlığı ve Adet Takip Asistanı</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Form Toggle Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={() => {
                  setIsLogin(true);
                  setError('');
                }}
                style={[styles.tabButton, isLogin && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Giriş Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsLogin(false);
                  setError('');
                }}
                style={[styles.tabButton, !isLogin && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Kayıt Ol</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Form Inputs */}
            {!isLogin && (
              <View style={styles.inputWrapper}>
                <User size={18} color="#888" style={styles.inputIcon} />
                <TextInput
                  placeholder="Adınız Soyadınız"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Mail size={18} color="#888" style={styles.inputIcon} />
              <TextInput
                placeholder="E-posta Adresi"
                placeholderTextColor="#666"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Lock size={18} color="#888" style={styles.inputIcon} />
              <TextInput
                placeholder="Şifre"
                placeholderTextColor="#666"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              onPress={handleAuthenticate}
              style={styles.authButton}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.authButtonText}>
                  {isLogin ? 'Giriş Yap' : 'Hesap Oluştur'}
                </Text>
              )}
            </TouchableOpacity>

            {Platform.OS !== 'web' && (
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                style={styles.googleButton}
                disabled={loading}
              >
                <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
              </TouchableOpacity>
            )}

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>VEYA</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Offline Onboarding Button */}
            <TouchableOpacity
              onPress={handleOfflineMode}
              style={styles.offlineButton}
              disabled={loading}
            >
              <Sparkles size={16} color="#FF2366" style={{ marginRight: 6 }} />
              <Text style={styles.offlineButtonText}>Giriş Yapmadan Devam Et (Çevrimdışı)</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legalText}>
            Devam ederek, Kullanım Koşullarını ve KVKK/GDPR Aydınlatma Metnini kabul etmiş olursunuz.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <LinearGradient
              colors={['#2c1622', '#181216']}
              style={styles.modalGradient}
            >
              {/* Success Checkmark with Glowing Ring */}
              <View style={styles.successIconWrapper}>
                <View style={styles.successIconOuterRing}>
                  <View style={styles.successIconInnerRing}>
                    <Check size={36} color="#fff" strokeWidth={3} />
                  </View>
                </View>
              </View>

              {/* Title & Description */}
              <Text style={styles.modalTitle}>Giriş Başarılı!</Text>
              <Text style={styles.modalMessage}>
                Hoş geldin, <Text style={styles.modalUserHighlight}>{successUserName || 'Google Kullanıcısı'}</Text>!{'\n'}
                Sağlık asistanın ve döngü takvimin senin için hazırlandı.
              </Text>

              {/* Action Button */}
              <TouchableOpacity
                onPress={handleSuccessModalClose}
                style={styles.modalButton}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>Hemen Başla</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#301520',
    borderWidth: 2,
    borderColor: '#FF2366',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  appTagline: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 6,
  },
  card: {
    backgroundColor: 'rgba(30, 30, 35, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.15)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#151518',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FF2366',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  errorText: {
    color: '#FF4D6D',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151518',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a30',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#fff',
    fontSize: 14,
  },
  authButton: {
    height: 50,
    backgroundColor: '#FF2366',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  googleButton: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    flexDirection: 'row',
  },
  googleButtonText: {
    color: '#121214',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a30',
  },
  dividerText: {
    color: '#666',
    fontSize: 11,
    paddingHorizontal: 12,
    fontWeight: '600',
  },
  offlineButton: {
    height: 50,
    borderWidth: 1,
    borderColor: '#FF2366',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 35, 102, 0.05)',
  },
  offlineButtonText: {
    color: '#FF2366',
    fontSize: 13,
    fontWeight: 'bold',
  },
  legalText: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 35, 102, 0.25)',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  modalGradient: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  successIconWrapper: {
    marginBottom: 20,
  },
  successIconOuterRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 35, 102, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIconInnerRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FF2366',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modalUserHighlight: {
    color: '#FF2366',
    fontWeight: 'bold',
  },
  modalButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FF2366',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
