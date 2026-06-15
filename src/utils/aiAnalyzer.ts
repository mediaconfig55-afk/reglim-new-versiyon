import { DailyLogInput } from '../database/db';
import { Cycle } from './periodEngine';

export interface AIInsight {
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info';
  category: 'cycle' | 'sleep' | 'symptom' | 'mood';
}

/**
 * AI Health Insight Engine: Analyzes local logs and cycles to produce personalized clinical wellness cards.
 */
export function generateAIInsights(logs: DailyLogInput[], cycles: Cycle[]): AIInsight[] {
  const insights: AIInsight[] = [];

  // Default welcome insights if no data
  if (logs.length === 0 && cycles.length === 0) {
    return [
      {
        title: 'Akıllı Analize Hazırlık',
        description: 'Döngünüzü ve günlük semptomlarınızı kaydetmeye başladığınızda, yapay zeka buraya özel korelasyon analizleri ekleyecektir.',
        type: 'info',
        category: 'cycle',
      },
      {
        title: 'Öneri: Günlük Loglama',
        description: 'Daha yüksek tahmin gücü için her gün su tüketimi, uyku süresi ve duygu durumlarınızı kaydetmeyi unutmayın.',
        type: 'success',
        category: 'symptom',
      }
    ];
  }

  // 1. Cycle regularity analysis
  if (cycles.length >= 3) {
    const cycleLengths = cycles.filter(c => c.cycle_length !== null).map(c => c.cycle_length as number);
    const mean = cycleLengths.reduce((s, v) => s + v, 0) / cycleLengths.length;
    const dev = Math.sqrt(cycleLengths.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / cycleLengths.length);

    if (dev <= 1.8) {
      insights.push({
        title: 'Düzenli Döngü İstikrarı',
        description: `Döngünüz son ${cycles.length} ayda son derece düzenli ilerliyor. Ortalama döngü süreniz ${Math.round(mean)} gün olup, sapma oranı %${Math.round((dev / mean) * 100)}'nin altındadır.`,
        type: 'success',
        category: 'cycle',
      });
    } else if (dev > 3.5) {
      insights.push({
        title: 'Döngü Düzensizliği Tespit Edildi',
        description: `Döngü sürelerinizde ${Math.round(dev)} günlük bir dalgalanma gözlemlendi. Bu durum stres, beslenme düzeni veya hormonal değişimlerden etkilenebilir.`,
        type: 'warning',
        category: 'cycle',
      });
    }
  }

  // 2. Correlation between Stress and Symptoms
  const stressMoods = ['Stresli', 'Kaygılı', 'Gergin', 'Öfkeli'];
  const logsWithStress = logs.filter(l => l.moods && l.moods.some(m => stressMoods.includes(m)));
  const logsWithSymptoms = logs.filter(l => l.symptoms && l.symptoms.length > 0);

  if (logsWithStress.length > 0 && logsWithSymptoms.length > 0) {
    // Check if symptoms are more intense on stress days
    const symptomsOnStressDays = logsWithStress.filter(l => l.symptoms && l.symptoms.length > 0);
    const stressRatio = symptomsOnStressDays.length / logsWithStress.length;

    if (stressRatio > 0.6) {
      insights.push({
        title: 'Stres & Semptom Korelasyonu',
        description: 'Stresli veya kaygılı hissettiğiniz günlerin %' + Math.round(stressRatio * 100) + ' kısmında fiziksel semptomlarınızın arttığı tespit edildi. Stres yönetimi semptomlarınızı hafifletebilir.',
        type: 'warning',
        category: 'mood',
      });
    }
  }

  // 3. Sleep Correlation with Cycle Delay
  const lowSleepLogs = logs.filter(l => l.sleep_hours !== undefined && l.sleep_hours < 6);
  if (lowSleepLogs.length >= 3) {
    insights.push({
      title: 'Düşük Uyku Süresi Uyarısı',
      description: 'Son dönemde uyku sürenizin 6 saatin altına düştüğü günler sıklaşmış. Yetersiz uyku döngü düzenini doğrudan etkileyen hormonal dengesizliklere yol açabilir.',
      type: 'info',
      category: 'sleep',
    });
  }

  // 4. Recurrent Symptom Patterns before period start
  if (cycles.length > 0 && logs.length > 0) {
    const periodPreDaysSymptoms: { [key: string]: number } = {};
    let analyzedPeriods = 0;

    cycles.forEach(c => {
      if (!c.start_date) return;
      analyzedPeriods++;
      // Check logs 3 days before start_date
      for (let offset = -3; offset < 0; offset++) {
        const checkDate = new Date(c.start_date);
        checkDate.setDate(checkDate.getDate() + offset);
        const dateStr = checkDate.toISOString().split('T')[0];
        const log = logs.find(l => l.date === dateStr);
        if (log && log.symptoms) {
          log.symptoms.forEach(s => {
            periodPreDaysSymptoms[s] = (periodPreDaysSymptoms[s] || 0) + 1;
          });
        }
      }
    });

    // Find the most frequent symptom before period
    let topSymptom = '';
    let topCount = 0;
    Object.keys(periodPreDaysSymptoms).forEach(s => {
      if (periodPreDaysSymptoms[s] > topCount) {
        topCount = periodPreDaysSymptoms[s];
        topSymptom = s;
      }
    });

    if (topCount >= Math.max(2, Math.round(analyzedPeriods * 0.5))) {
      insights.push({
        title: `Pre-Menstrüel Semptom Kalıbı`,
        description: `Genellikle regl dönemlerinizin başlamasından 1-3 gün önce yoğun şekilde "${topSymptom}" semptomu yaşıyorsunuz. Bu dönemde bitki çayları ve hafif esneme hareketleri faydalı olabilir.`,
        type: 'success',
        category: 'symptom',
      });
    }
  }

  // 5. Water intake and hydration advice
  const avgWater = logs.reduce((sum, l) => sum + (l.water_ml || 0), 0) / logs.length;
  if (logs.length >= 3 && avgWater < 1500) {
    insights.push({
      title: 'Yetersiz Sıvı Tüketimi',
      description: `Ortalama günlük su tüketiminiz ${Math.round(avgWater)} ml civarındadır. Vücudunuzun hidrasyon seviyesini artırmak, regl sancılarını ve pre-menstrüel şişkinliği azaltmada etkilidir. Hedef: 2000 ml.`,
      type: 'warning',
      category: 'symptom',
    });
  }

  // Add a generic wellness wisdom insight if insights is sparse
  if (insights.length < 3) {
    insights.push({
      title: 'Hormonal Denge Tavsiyesi',
      description: 'Luteal fazda (ovülasyon sonrası) magnezyum ve B6 yönünden zengin gıdalar (ıspanak, muz, kuruyemiş) tüketmek, adet öncesi gerginlik sendromunu (PMS) minimize etmeye yardımcı olur.',
      type: 'info',
      category: 'cycle',
    });
  }

  return insights;
}

/**
 * Daily wellness tips catalog
 */
const dailyTips = [
  "Bugün bitki çayı içmek (papatya, rezene veya zencefil) karın kramplarınızı hafifletmeye yardımcı olabilir.",
  "Regl döneminde hafif yürüyüşler yapmak kan dolaşımını hızlandırır ve ağrıları azaltır.",
  "Yumurtlama dönemindesiniz! Vücudunuzun enerji seviyesi yüksektir, kardiyo antrenmanları için mükemmel bir gün.",
  "Şişkinliği önlemek için bugün tuz tüketimini sınırlamayı ve bol su içmeyi deneyin.",
  "Magnezyum takviyesi veya bitter çikolata tüketimi regl kramplarını doğal olarak azaltmaya yardımcı olur.",
  "Yatmadan önce hafif esneme egzersizleri yapmak uyku kalitenizi artıracak ve kaslarınızı gevşetecektir.",
  "Vücudunu dinle: Kendini yorgun hissediyorsan bugün ağır antrenmanlar yerine dinlenmeyi seçebilirsin.",
  "Demir emilimini artırmak için C vitamini yönünden zengin besinleri öğünlerinize ekleyin."
];

export function getDailyTip(dateStr: string): string {
  // Use simple hash of the date string to rotate tips daily
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % dailyTips.length;
  return dailyTips[index];
}
