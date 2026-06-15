import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

/**
 * Schedule a local notification for cycle alerts
 */
export async function scheduleCycleAlert(daysUntil: number, dateStr: string) {
  if (Platform.OS === 'web') return;
  try {
    await cancelNotificationById(`cycle-alert-${dateStr}`);
    
    // Set notification target date (2 days before)
    const targetDate = new Date(dateStr);
    targetDate.setDate(targetDate.getDate() - daysUntil);
    targetDate.setHours(9, 0, 0, 0); // 9:00 AM

    const now = new Date();
    if (targetDate.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `cycle-alert-${dateStr}`,
        content: {
          title: 'Regl Dönemi Yaklaşıyor 🌸',
          body: `Tahmini regl başlangıcınıza ${daysUntil} gün kaldı. Kendinizi hazırlamayı ve semptomlarınızı kaydetmeyi unutmayın!`,
          data: { type: 'cycle', targetDate: dateStr },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
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

    const targetDate = new Date(dateStr);
    targetDate.setHours(9, 0, 0, 0); // 9:00 AM

    const now = new Date();
    if (targetDate.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `ovulation-alert-${dateStr}`,
        content: {
          title: 'Yumurtlama Günü 🟣',
          body: 'Bugün yumurtlama gününüz! Hamilelik olasılığınız zirvede. Vücudunuzun işaretlerini takip edin.',
          data: { type: 'ovulation', targetDate: dateStr },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
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
    // Cancel first to prevent duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

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
      },
    });

    // 2. Daily Log Reminder (Daily at 20:30)
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-log-reminder',
      content: {
        title: 'Günün Nasıl Geçti? ✨',
        body: 'Bugünkü ruh halini ve fiziksel semptomlarını kaydederek döngü tahminlerini güçlendir.',
        data: { type: 'log' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 20,
        minute: 30,
        repeats: true,
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
      },
    });

    console.log('Daily notifications scheduled.');
  } catch (error) {
    console.error('Failed to schedule daily reminders:', error);
  }
}

/**
 * Get all upcoming scheduled notifications for display on dashboard
 */
export async function getUpcomingNotifications(): Promise<{ id: string; title: string; triggerTime: string; body: string }[]> {
  if (Platform.OS === 'web') {
    return [
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

async function cancelNotificationById(id: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    // safe ignore
  }
}
