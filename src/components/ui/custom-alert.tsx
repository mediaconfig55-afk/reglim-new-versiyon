import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, AlertCircle, Info, HelpCircle, X } from 'lucide-react-native';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'question';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function CustomAlert({
  visible,
  title,
  message,
  type = 'info',
  confirmText = 'Tamam',
  cancelText = 'Vazgeç',
  onConfirm,
  onCancel,
}: CustomAlertProps) {
  // Select icon and colors based on type
  let IconComponent = Info;
  let iconColor = '#00B4D8';
  let gradientColors: [string, string] = ['#161c28', '#0f131a']; // defaults
  let borderColor = 'rgba(0, 180, 216, 0.25)';

  if (type === 'success') {
    IconComponent = CheckCircle;
    iconColor = '#06D6A0';
    gradientColors = ['#122421', '#0b1614'];
    borderColor = 'rgba(6, 214, 160, 0.25)';
  } else if (type === 'error') {
    IconComponent = AlertCircle;
    iconColor = '#FF4D6D';
    gradientColors = ['#2c161d', '#1a0b10'];
    borderColor = 'rgba(255, 77, 109, 0.25)';
  } else if (type === 'warning') {
    IconComponent = AlertCircle;
    iconColor = '#FFB703';
    gradientColors = ['#2b2210', '#1a140a'];
    borderColor = 'rgba(255, 183, 3, 0.25)';
  } else if (type === 'question') {
    IconComponent = HelpCircle;
    iconColor = '#9B5DE5';
    gradientColors = ['#22162c', '#140c1a'];
    borderColor = 'rgba(155, 93, 229, 0.25)';
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel || onConfirm}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { borderColor }]}>
          <LinearGradient colors={gradientColors} style={styles.gradient}>
            
            {/* Header Close button if cancelable */}
            {onCancel && (
              <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
                <X size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>
            )}

            {/* Icon Wrapper */}
            <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}15` }]}>
              <IconComponent size={32} color={iconColor} />
            </View>

            {/* Text Contents */}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {/* Buttons Row */}
            <View style={styles.actionRow}>
              {onCancel && (
                <TouchableOpacity
                  onPress={onCancel}
                  style={[styles.btn, styles.cancelBtn]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>{cancelText}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onConfirm}
                style={[styles.btn, styles.confirmBtn, { backgroundColor: iconColor }]}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gradient: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  cancelBtnText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
