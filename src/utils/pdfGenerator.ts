import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DailyLogInput } from '../database/db';
import { Cycle } from './periodEngine';

interface ReportData {
  userName: string;
  cycles: Cycle[];
  logs: DailyLogInput[];
  averageCycleLength: number;
  averagePeriodLength: number;
  confidenceScore: number;
  isIrregular: boolean;
}

/**
 * PDF Doctor Report Generator: Compiles user health records into a print-ready PDF and triggers system sharing.
 */
export async function generateDoctorReport(data: ReportData): Promise<boolean> {
  try {
    const todayStr = new Date().toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Compute health statistics
    const validWeights = data.logs.filter(l => l.weight_kg !== undefined).map(l => l.weight_kg as number);
    const avgWeight = validWeights.length > 0
      ? (validWeights.reduce((s, w) => s + w, 0) / validWeights.length).toFixed(1)
      : 'Kayıt Yok';

    const validPulse = data.logs.filter(l => l.pulse !== undefined).map(l => l.pulse as number);
    const avgPulse = validPulse.length > 0
      ? Math.round(validPulse.reduce((s, p) => s + p, 0) / validPulse.length)
      : 'Kayıt Yok';

    const validBloodPressure = data.logs.filter(l => l.systolic !== undefined && l.diastolic !== undefined);
    const avgBP = validBloodPressure.length > 0
      ? `${Math.round(validBloodPressure.reduce((s, p) => s + (p.systolic || 0), 0) / validBloodPressure.length)}/${Math.round(
          validBloodPressure.reduce((s, p) => s + (p.diastolic || 0), 0) / validBloodPressure.length
        )}`
      : 'Kayıt Yok';

    const validSugar = data.logs.filter(l => l.blood_sugar !== undefined).map(l => l.blood_sugar as number);
    const avgSugar = validSugar.length > 0
      ? (validSugar.reduce((s, g) => s + g, 0) / validSugar.length).toFixed(1)
      : 'Kayıt Yok';

    // Group active symptoms
    const symptomFrequencies: { [key: string]: number } = {};
    data.logs.forEach(l => {
      if (l.symptoms) {
        l.symptoms.forEach(s => {
          symptomFrequencies[s] = (symptomFrequencies[s] || 0) + 1;
        });
      }
    });
    const symptomsList = Object.entries(symptomFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Build cycle table HTML
    const cycleRows = data.cycles.slice(0, 6).map((c, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${new Date(c.start_date + 'T12:00:00').toLocaleDateString('tr-TR')}</td>
          <td>${c.end_date ? new Date(c.end_date + 'T12:00:00').toLocaleDateString('tr-TR') : 'Devam Ediyor'}</td>
          <td>${c.cycle_length ? `${c.cycle_length} Gün` : '-'}</td>
          <td>${c.period_length ? `${c.period_length} Gün` : '-'}</td>
        </tr>
      `;
    }).join('');

    // Build symptoms list HTML
    const symptomsRows = symptomsList.length > 0
      ? symptomsList.map(([name, count]) => {
          return `
            <div class="symptom-tag">
              <span class="name">${name}</span>
              <span class="count">${count} Kere</span>
            </div>
          `;
        }).join('')
      : '<p class="no-data">Semptom kaydı bulunamadı.</p>';

    // Assemble the complete HTML document
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Döngü ve Sağlık Raporu</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #333333;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #FF2366;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header-title h1 {
              color: #FF2366;
              margin: 0;
              font-size: 26px;
              font-weight: 700;
            }
            .header-title p {
              margin: 5px 0 0 0;
              color: #666;
              font-size: 14px;
            }
            .qr-code {
              text-align: right;
            }
            .qr-code img {
              width: 90px;
              height: 90px;
              border: 1px solid #ddd;
              padding: 5px;
              border-radius: 5px;
            }
            .qr-code p {
              margin: 3px 0 0 0;
              font-size: 10px;
              color: #888;
            }
            .patient-info {
              background-color: #FFF0F4;
              border-left: 5px solid #FF2366;
              padding: 15px;
              border-radius: 4px;
              margin-bottom: 35px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
            }
            .info-block h4 {
              margin: 0 0 5px 0;
              font-size: 11px;
              text-transform: uppercase;
              color: #FF2366;
              letter-spacing: 0.5px;
            }
            .info-block p {
              margin: 0;
              font-size: 15px;
              font-weight: bold;
              color: #222;
            }
            .section-title {
              font-size: 18px;
              color: #121214;
              border-bottom: 1px solid #eee;
              padding-bottom: 8px;
              margin-top: 30px;
              margin-bottom: 15px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th, td {
              border: 1px solid #EFEFEF;
              padding: 12px;
              text-align: left;
              font-size: 13px;
            }
            th {
              background-color: #F8F8F8;
              color: #555;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #FCFCFC;
            }
            .grid-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
            .card {
              border: 1px solid #ECECEC;
              border-radius: 6px;
              padding: 20px;
              background-color: #FAFAFA;
            }
            .card-title {
              font-size: 15px;
              font-weight: bold;
              margin-top: 0;
              margin-bottom: 15px;
              color: #FF2366;
            }
            .symptom-tag {
              display: flex;
              justify-content: space-between;
              padding: 8px 12px;
              background-color: #FFFFFF;
              border: 1px solid #EAEAEA;
              border-radius: 4px;
              margin-bottom: 8px;
              font-size: 12px;
            }
            .symptom-tag .name {
              font-weight: bold;
            }
            .symptom-tag .count {
              color: #666;
            }
            .vitals-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .vital-card {
              background: #fff;
              border: 1px solid #e0e0e0;
              padding: 10px;
              border-radius: 4px;
              text-align: center;
            }
            .vital-card h5 {
              margin: 0 0 5px 0;
              font-size: 10px;
              color: #888;
              text-transform: uppercase;
            }
            .vital-card p {
              margin: 0;
              font-size: 16px;
              font-weight: bold;
              color: #333;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              color: #999999;
              border-top: 1px solid #eee;
              padding-top: 20px;
              margin-top: 50px;
            }
            .no-data {
              color: #999;
              font-style: italic;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-title">
              <h1>Reglim & Takvim</h1>
              <p>Kadın Sağlığı & Adet Döngüsü Doktor Raporu</p>
            </div>
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://regliyiz.app/verify/report-hash-${new Date().getTime()}" alt="QR Code" />
              <p>Rapor Doğrulama QR Kodu</p>
            </div>
          </div>

          <div class="patient-info">
            <div class="info-block">
              <h4>KULLANICI</h4>
              <p>${data.userName || 'Kayıtlı Kullanıcı'}</p>
            </div>
            <div class="info-block">
              <h4>OLUŞTURULMA TARİHİ</h4>
              <p>${todayStr}</p>
            </div>
            <div class="info-block">
              <h4>DÖNGÜ GÜVEN PUANI</h4>
              <p>%${data.confidenceScore} ${data.isIrregular ? '(Düzensiz)' : '(Düzenli)'}</p>
            </div>
          </div>

          <div class="section-title">Adet Döngüsü Geçmişi (Son 6 Ay)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Başlangıç Tarihi</th>
                <th>Bitiş Tarihi</th>
                <th>Döngü Süresi</th>
                <th>Regl Süresi</th>
              </tr>
            </thead>
            <tbody>
              ${cycleRows || '<tr><td colspan="5" class="no-data">Döngü geçmişi kaydı bulunamadı.</td></tr>'}
            </tbody>
          </table>

          <div class="grid-container">
            <div class="card">
              <div class="card-title">En Sık Görülen Semptomlar</div>
              ${symptomsRows}
            </div>
            
            <div class="card">
              <div class="card-title">Hayati Sağlık Göstergeleri (Ortalama)</div>
              <div class="vitals-grid">
                <div class="vital-card">
                  <h5>Ortalama Kilo</h5>
                  <p>${avgWeight} ${avgWeight !== 'Kayıt Yok' ? 'kg' : ''}</p>
                </div>
                <div class="vital-card">
                  <h5>Kan Basıncı</h5>
                  <p>${avgBP} ${avgBP !== 'Kayıt Yok' ? 'mmHg' : ''}</p>
                </div>
                <div class="vital-card">
                  <h5>Ortalama Nabız</h5>
                  <p>${avgPulse} ${avgPulse !== 'Kayıt Yok' ? 'bpm' : ''}</p>
                </div>
                <div class="vital-card">
                  <h5>Açlık Şekeri</h5>
                  <p>${avgSugar} ${avgSugar !== 'Kayıt Yok' ? 'mg/dL' : ''}</p>
                </div>
              </div>
              
              <div style="margin-top: 20px; font-size: 11px; color: #666; line-height: 1.4;">
                <p><strong>Not:</strong> Ortalama döngü süreniz <strong>${data.averageCycleLength} gün</strong>, ortalama regl kanama süreniz <strong>${data.averagePeriodLength} gün</strong> olarak hesaplanmıştır.</p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Bu rapor <strong>Reglim & Takvim</strong> uygulaması aracılığıyla kullanıcının kendi rızası ve beyanı ile doldurulmuş veriler ışığında üretilmiştir. Tanı ve teşhis amaçlı kullanılmaz.</p>
            <p>&copy; ${new Date().getFullYear()} com.regliyiz.app. Tüm Hakları Saklıdır.</p>
          </div>
        </body>
      </html>
    `;

    // 1. Generate PDF
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // 2. Share PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Reglim Takvim Doktor Raporu',
        UTI: 'com.adobe.pdf',
      });
      return true;
    } else {
      console.warn('Sharing is not available on this device');
      return false;
    }
  } catch (error) {
    console.error('Failed to generate doctor report:', error);
    return false;
  }
}
