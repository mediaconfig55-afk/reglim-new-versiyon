import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ShieldCheck } from 'lucide-react-native';

export default function TermsScreen() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ShieldCheck size={32} color="#FF2366" />
        <Text style={styles.headerTitle}>Gizlilik ve Kullanım Koşulları</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.termsText}>
          Hoş geldiniz. Uygulamamızı kullanmadan önce aşağıdaki koşulları okumanız ve kabul etmeniz gerekmektedir.{'\n\n'}
          1. Veri Gizliliği: Uygulamaya girdiğiniz sağlık verileri (regl tarihleri, kilo, boy vb.) cihazınızda saklanır ve onayınız olmadan üçüncü şahıslarla paylaşılmaz.{'\n\n'}
          2. Tıbbi Tavsiye Değildir: Bu uygulama tıbbi bir teşhis veya tedavi aracı değildir. Sadece döngünüzü takip etmenize ve tahmini yumurtlama günlerinizi anlamanıza yardımcı olmayı amaçlar. Ciddi sağlık durumlarında mutlaka bir hekime başvurmalısınız.{'\n\n'}
          3. Yapay Zeka Analizleri: Uygulama içindeki yapay zeka tavsiyeleri sadece bilgilendirme amaçlıdır. Kullanıcı, bu bilgilere dayanarak alacağı aksiyonlardan tamamen kendisi sorumludur.{'\n\n'}
          4. İzinler: Uygulamanın tam işlevsel çalışabilmesi için bildirim ve gerekirse biyometrik güvenlik izinlerine ihtiyaç duyulabilir.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.checkboxContainer} 
          onPress={() => setAccepted(!accepted)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
            {accepted && <Check size={14} color="#FFF" />}
          </View>
          <Text style={styles.checkboxLabel}>Okudum, anladım ve kabul ediyorum.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, !accepted && styles.buttonDisabled]} 
          disabled={!accepted}
          onPress={() => router.push('/(onboarding)/permissions')}
        >
          <Text style={styles.buttonText}>Devam Et</Text>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  termsText: {
    fontSize: 15,
    color: '#aaa',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: '#FF2366',
    borderColor: '#FF2366',
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  button: {
    backgroundColor: '#FF2366',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
