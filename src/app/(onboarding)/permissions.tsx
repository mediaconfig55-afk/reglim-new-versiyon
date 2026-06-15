import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { BellRing } from 'lucide-react-native';
import { requestNotificationPermissions, scheduleDailyReminders } from '../../services/notifications';

export default function PermissionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAllow = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleDailyReminders();
      }
    } catch (e) {
      console.warn('Bildirim izni alınırken hata oluştu:', e);
    } finally {
      setLoading(false);
      router.push('/(onboarding)/setup');
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/setup');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <BellRing size={56} color="#FF2366" />
        </View>
        <Text style={styles.title}>Hiçbir Günü Kaçırmayın</Text>
        <Text style={styles.subtitle}>
          Regl döneminizin yaklaştığını, su içmeniz gerektiğini ve önemli sağlık güncellemelerinizi size hatırlatmamız için bildirimlere izin verin.
        </Text>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleAllow} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Bildirimlere İzin Ver</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={loading}>
          <Text style={styles.skipButtonText}>Şimdilik Geç</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 35, 102, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaaaaa',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: '#FF2366',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
});
