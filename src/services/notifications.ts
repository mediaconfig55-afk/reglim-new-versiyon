import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAppStore } from '../store/store';

// Set up the default handler for when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Check if notification permissions are already granted (without prompting)
 */
export async function hasNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for notification!');
    return false;
  }

  // Config Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF2366',
    });
  }

  return true;
}

function getCamouflagedTexts(type: 'cycle' | 'ovulation', details?: string) {
  const store = useAppStore.getState();
  const mode = store.discreetNotificationMode || 'standard';
  const customText = store.customDiscreetText || '';

  if (mode === 'water') {
    return {
      title: 'Su Zamanı! 💧',
      body: type === 'cycle'
        ? 'Vücudunuzu nemli tutmak regl kramplarını azaltır. Haydi büyük bir bardak su içelim!'
        : 'Bugün bol bol su içtiğinizden emin olun! Sağlıklı bir gün geçirelim.',
    };
  } else if (mode === 'flower') {
    return {
      title: 'Çiçekleri Sulama Zamanı! 🌸',
      body: type === 'cycle'
        ? 'Evdeki çiçekleri kontrol etme vakti. Onları sulamayı ve ilgilenmeyi unutmayın!'
        : 'Çiçeğinizin güneşe ve taze havaya ihtiyacı var. Bugün ilgilenin!',
    };
  } else if (mode === 'custom' && customText.trim().length > 0) {
    return {
      title: 'Kişisel Hatırlatıcı ✨',
      body: customText,
    };
  }

  // Default Standard
  if (type === 'cycle') {
    return {
      title: 'Regl Dönemi Yaklaşıyor 🌸',
      body: details || 'Tahmini regl başlangıcınıza az kaldı. Semptomlarınızı kaydetmeyi unutmayın!',
    };
  } else {
    return {
      title: 'Yumurtlama Günü 🟣',
      body: 'Bugün yumurtlama gününüz! Hamilelik olasılığınız zirvede. Vücudunuzun işaretlerini takip edin.',
    };
  }
}

function getLogReminderTexts() {
  const store = useAppStore.getState();
  const mode = store.discreetNotificationMode || 'standard';
  const customText = store.customDiscreetText || '';

  if (mode === 'water') {
    return {
      title: 'Su Seviyesi Kontrolü 💧',
      body: 'Günü bitirmeden önce su tüketim hedefini kontrol etmeyi unutma!',
    };
  } else if (mode === 'flower') {
    return {
      title: 'Bahçe Günlüğü 🌸',
      body: 'Çiçeklerinin bugünkü gelişimini kaydetmeyi unutma!',
    };
  } else if (mode === 'custom' && customText.trim().length > 0) {
    return {
      title: 'Günün Notu 📝',
      body: 'Bugünkü günlüğü doldurmayı ve notlarını eklemeyi unutma!',
    };
  }

  return {
    title: 'Günün Nasıl Geçti? ✨',
    body: 'Bugünkü ruh halini ve fiziksel semptomlarını kaydederek döngü tahminlerini güçlendir.',
  };
}

/**
 * Schedule a local notification for cycle alerts
 */
export async function scheduleCycleAlert(daysUntil: number, dateStr: string) {
  if (Platform.OS === 'web') return;
  try {
    await cancelNotificationById(`cycle-alert-${dateStr}`);
    
    // Set notification target date (2 days before)
    const targetDate = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    targetDate.setDate(targetDate.getDate() - daysUntil);
    targetDate.setHours(9, 0, 0, 0); // 9:00 AM

    const now = new Date();
    if (targetDate.getTime() > now.getTime()) {
      const textInfo = getCamouflagedTexts('cycle', `Tahmini regl başlangıcınıza ${daysUntil} gün kaldı. Kendinizi hazırlamayı ve semptomlarınızı kaydetmeyi unutmayın!`);
      await Notifications.scheduleNotificationAsync({
        identifier: `cycle-alert-${dateStr}`,
        content: {
          title: textInfo.title,
          body: textInfo.body,
          data: { type: 'cycle', targetDate: dateStr },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: 'default',
        },
      });
    }
  } catch (error) {
    console.error('Failed to schedule cycle alert:', error);
  }
}

/**
 * Schedule ovulation alert
 */
export async function scheduleOvulationAlert(dateStr: string) {
  if (Platform.OS === 'web') return;
  try {
    await cancelNotificationById(`ovulation-alert-${dateStr}`);

    const targetDate = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    targetDate.setHours(9, 0, 0, 0); // 9:00 AM

    const now = new Date();
    if (targetDate.getTime() > now.getTime()) {
      const textInfo = getCamouflagedTexts('ovulation');
      await Notifications.scheduleNotificationAsync({
        identifier: `ovulation-alert-${dateStr}`,
        content: {
          title: textInfo.title,
          body: textInfo.body,
          data: { type: 'ovulation', targetDate: dateStr },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: 'default',
        },
      });
    }
  } catch (error) {
    console.error('Failed to schedule ovulation alert:', error);
  }
}

/**
 * Schedule recurrent daily reminders (Water, Sleep, Logging)
 */
export async function scheduleDailyReminders() {
  if (Platform.OS === 'web') return;
  try {
    // Cancel first to prevent duplicates (only daily reminders, keeping cycle and ovulation alerts intact)
    await cancelNotificationById('daily-water-reminder');
    await cancelNotificationById('daily-log-reminder');
    await cancelNotificationById('daily-sleep-reminder');

    // 1. Water Intake Reminder (Daily at 14:00)
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-water-reminder',
      content: {
        title: 'Su Zamanı! 💧',
        body: 'Vücudunuzu hidre tutmak regl kramplarını azaltır. Haydi bir bardak su içelim!',
        data: { type: 'water' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 14,
        minute: 0,
        repeats: true,
        channelId: 'default',
      },
    });

    // 2. Daily Log Reminder (Daily at 20:30)
    const logText = getLogReminderTexts();
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-log-reminder',
      content: {
        title: logText.title,
        body: logText.body,
        data: { type: 'log' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 20,
        minute: 30,
        repeats: true,
        channelId: 'default',
      },
    });

    // 3. Sleep Reminder (Daily at 22:30)
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-sleep-reminder',
      content: {
        title: 'Dinlenme Vakti 🛌',
        body: 'Hormonal dengenizi korumak için uyku zamanı yaklaşıyor. İyi dinlenmeler!',
        data: { type: 'sleep' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 22,
        minute: 30,
        repeats: true,
        channelId: 'default',
      },
    });

    console.log('Daily notifications scheduled.');
  } catch (error) {
    console.error('Failed to schedule daily reminders:', error);
  }
}

/**
 * Schedule daily birth control pill reminder
 */
export async function schedulePillReminder() {
  if (Platform.OS === 'web') return;
  try {
    await cancelNotificationById('contraceptive-pill-reminder');

    const store = useAppStore.getState();
    const config = store.contraceptiveConfig;

    if (!config || !config.enabled) return;

    // Parse reminderTime e.g. "21:00"
    const [hourStr, minuteStr] = config.reminderTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    let title = 'Hap Zamanı! 💊';
    let body = 'Günlük kontraseptif hapınızı alma zamanı geldi. Lütfen geciktirmeyin!';

    const mode = store.discreetNotificationMode || 'standard';
    if (mode === 'water') {
      title = 'Ekstra Hidrasyon Vakti 💧';
      body = 'Bugünkü vitamin ve hidrasyon takviyenizi almayı unutmayın!';
    } else if (mode === 'flower') {
      title = 'Bitki Besini 🌸';
      body = 'Özel bitki vitaminlerini ekleme zamanı geldi!';
    } else if (mode === 'custom' && store.customDiscreetText) {
      title = 'Günlük Rutin Hatırlatıcısı ✨';
      body = store.customDiscreetText;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: 'contraceptive-pill-reminder',
      content: {
        title,
        body,
        data: { type: 'pill' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
        channelId: 'default',
      },
    });

    console.log(`Pill reminder scheduled daily at ${config.reminderTime}`);
  } catch (error) {
    console.error('Failed to schedule pill reminder:', error);
  }
}

/**
 * Get all upcoming scheduled notifications for display on dashboard
 */
export async function getUpcomingNotifications(): Promise<{ id: string; title: string; triggerTime: string; body: string }[]> {
  if (Platform.OS === 'web') {
    const store = useAppStore.getState();
    const config = store.contraceptiveConfig;
    const reminders = [
      {
        id: 'daily-water-reminder',
        title: 'Su Zamanı! 💧',
        body: 'Vücudunuzu hidre tutmak regl kramplarını azaltır. Haydi bir bardak su içelim!',
        triggerTime: 'Her Gün 14:00',
      },
      {
        id: 'daily-log-reminder',
        title: 'Günün Nasıl Geçti? ✨',
        body: 'Bugünkü ruh halini ve fiziksel semptomlarını kaydederek döngü tahminlerini güçlendir.',
        triggerTime: 'Her Gün 20:30',
      },
      {
        id: 'daily-sleep-reminder',
        title: 'Dinlenme Vakti 🛌',
        body: 'Hormonal dengenizi korumak için uyku zamanı yaklaşıyor. İyi dinlenmeler!',
        triggerTime: 'Her Gün 22:30',
      },
    ];
    if (config && config.enabled) {
      reminders.push({
        id: 'contraceptive-pill-reminder',
        title: 'Hap Zamanı! 💊',
        body: 'Günlük kontraseptif hapınızı alma zamanı geldi. Lütfen geciktirmeyin!',
        triggerTime: `Her Gün ${config.reminderTime}`,
      });
    }
    return reminders;
  }

  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    const formatted = list.map(item => {
      let triggerTime = 'Günlük';
      const trigger = item.trigger as any;
      if (trigger.type === 'calendar' || trigger.type === 'date') {
        const dateVal = trigger.value ? new Date(trigger.value) : new Date();
        triggerTime = dateVal.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      } else if (trigger.hour !== undefined) {
        const minStr = trigger.minute < 10 ? `0${trigger.minute}` : trigger.minute;
        triggerTime = `Her Gün ${trigger.hour}:${minStr}`;
      }
      return {
        id: item.identifier,
        title: item.content.title || '',
        body: item.content.body || '',
        triggerTime,
      };
    });
    return formatted;
  } catch (error) {
    console.error('Failed to list notifications:', error);
    return [];
  }
}

export async function cancelNotificationById(id: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    // safe ignore
  }
}

export async function cancelAllCycleAlerts() {
  if (Platform.OS === 'web') return;
  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of list) {
      if (item.identifier.startsWith('cycle-alert-') || item.identifier.startsWith('ovulation-alert-')) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
  } catch (error) {
    console.error('Failed to cancel cycle alerts:', error);
  }
}
