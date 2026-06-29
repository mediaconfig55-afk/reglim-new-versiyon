import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/store';
import { authenticateWithBiometrics, verifyPIN } from '../../utils/security';
import { unlockSession } from '../_layout';
import { LinearGradient } from 'expo-linear-gradient';
import { Delete, Fingerprint, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function PinScreen() {
  const router = useRouter();
  const { biometricsEnabled } = useAppStore();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const maxPinLength = 4;
  const shakeAnimation = useState(new Animated.Value(0))[0];

  const handleBiometricAuth = async () => {
    const success = await authenticateWithBiometrics('Giriş yapmak için parmak izini okutun');
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      unlockSession();
      router.replace('/(tabs)');
    }
  };

  // Try biometrics on mount if enabled
  useEffect(() => {
    if (biometricsEnabled) {
      handleBiometricAuth();
    }
  }, [biometricsEnabled]);

  const handleKeyPress = (num: string) => {
    if (pin.length >= maxPinLength) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const newPin = pin + num;
    setPin(newPin);

    if (newPin.length === maxPinLength) {
      validatePin(newPin);
    }
  };

  const handleDelete = () => {
    if (pin.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin(pin.slice(0, -1));
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const validatePin = async (enteredPin: string) => {
    const isValid = await verifyPIN(enteredPin);
    if (isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      unlockSession();
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerShake();
      setPin('');
    }
  };

  const renderDot = (index: number) => {
    const isActive = pin.length > index;
    return (
      <View
        key={index}
        style={[
          styles.dot,
          isActive && styles.dotActive,
        ]}
      />
    );
  };

  return (
    <LinearGradient colors={['#1a1015', '#121214']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <View style={styles.lockIconCircle}>
            <Lock size={28} color="#FF2366" />
          </View>
          <Text style={styles.title}>Giriş Şifresi</Text>
          <Text style={styles.subtitle}>Uygulamayı açmak için PIN kodunuzu girin</Text>
        </View>

        {/* PIN Indicators */}
        <Animated.View 
          style={[
            styles.dotContainer, 
            { transform: [{ translateX: shakeAnimation }] }
          ]}
        >
          {Array(maxPinLength).fill(0).map((_, i) => renderDot(i))}
        </Animated.View>

        {/* Keyboard Layout */}
        <View style={[styles.keyboard, { marginBottom: Math.max(20, insets.bottom + 10) }]}>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => handleKeyPress('1')} style={styles.key}><Text style={styles.keyText}>1</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleKeyPress('2')} style={styles.key}><Text style={styles.keyText}>2</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleKeyPress('3')} style={styles.key}><Text style={styles.keyText}>3</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => handleKeyPress('4')} style={styles.key}><Text style={styles.keyText}>4</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleKeyPress('5')} style={styles.key}><Text style={styles.keyText}>5</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleKeyPress('6')} style={styles.key}><Text style={styles.keyText}>6</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => handleKeyPress('7')} style={styles.key}><Text style={styles.keyText}>7</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleKeyPress('8')} style={styles.key}><Text style={styles.keyText}>8</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleKeyPress('9')} style={styles.key}><Text style={styles.keyText}>9</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            {biometricsEnabled ? (
              <TouchableOpacity onPress={handleBiometricAuth} style={styles.keyAction}>
                <Fingerprint size={28} color="#FF2366" />
              </TouchableOpacity>
            ) : (
              <View style={styles.keyActionEmpty} />
            )}
            <TouchableOpacity onPress={() => handleKeyPress('0')} style={styles.key}><Text style={styles.keyText}>0</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.keyAction}>
              <Delete size={24} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  lockIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#301520',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
    gap: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3a3a40',
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: '#FF2366',
    borderColor: '#FF2366',
  },
  keyboard: {
    paddingHorizontal: 40,
    marginBottom: 20,
    gap: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  key: {
    flex: 1,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 26,
    color: '#fff',
    fontWeight: '500',
  },
  keyAction: {
    flex: 1,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyActionEmpty: {
    flex: 1,
  },
});
