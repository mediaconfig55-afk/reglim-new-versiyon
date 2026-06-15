import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/store';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Mail, Lock, User, Sparkles } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithCredential, 
  GoogleAuthProvider, 
  signInAnonymously, 
  updateProfile 
} from 'firebase/auth';
import { auth } from '../../services/firebase';

if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: '393754770159-37gitini3bo06i37vk1bjmmaup3qicrt.apps.googleusercontent.com',
    offlineAccess: true,
  });
}

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAppStore(state => state.setUser);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      await AsyncStorage.setItem('user_session', JSON.stringify(sessionUser));
      setUser(sessionUser);

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
    setLoading(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In failed: No ID Token found');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      
      const sessionUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Google Kullanıcısı',
        isAnonymous: false,
      };
      
      await AsyncStorage.setItem('user_session', JSON.stringify(sessionUser));
      setUser(sessionUser);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('Google Sign-In error:', e);
      setError('Google ile giriş yapılırken hata oluştu.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
});
