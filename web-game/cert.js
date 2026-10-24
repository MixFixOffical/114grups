// Общий генератор сертификата: рисует на canvas в стиле «Изи квиз» и сохраняет PDF (jsPDF).
// Используется на quize.html (сертификат участника) и certificates.html (кабинет).

const W = 1754; // A4 альбомный, 150 dpi
const H = 1240;

const C = {
  pDark: '#3b0f8c',
  p: '#6c2bd9',
  pLight: '#9b3fe8',
  yellow: '#ffd23f',
  orange: '#ff7a1a',
  white: '#ffffff'
};

// Уникальный номер: ИК-ГОД-XXXX-XXXXXX (без похожих символов)
export function makeCertNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += chars[b % chars.length];
  return `ИК-${new Date().getFullYear()}-${s.slice(0, 4)}-${s.slice(4, 10)}`;
}

// Оценка по баллам (СКР): берём самую высокую оценку, порог которой не выше набранных баллов
export function gradeFor(score, grades) {
  if (!grades) return 1;
  for (const g of [5, 4, 3, 2, 1]) {
    if (score >= Number(grades[g])) return g;
  }
  return 1;
}

// Сумма баллов всех вопросов квиза (максимум для сертификата)
export function maxScoreOf(quiz) {
  return (quiz.questions || []).reduce((s, q) => s + (q.points ?? 1), 0);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Подбираем размер шрифта, чтобы текст влез в ширину
function fitFont(ctx, text, weight, family, maxW, start) {
  let size = start;
  while (size > 28) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 4;
  }
  return size;
}

function esc(s) {
  return String(s);
}

export async function drawCertificate(canvas, d) {
  await Promise.all([
    document.fonts.load('900 60px Unbounded'),
    document.fonts.load('700 40px Manrope'),
    document.fonts.load('400 40px Manrope')
  ]).catch(() => {});

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const HEAD = 'Unbounded, Manrope, sans-serif';
  const BODY = 'Manrope, sans-serif';
  const cx = W / 2;

  // Фон
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, C.pDark);
  g.addColorStop(0.5, C.p);
  g.addColorStop(1, C.pLight);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Декор
  circle(ctx, W - 120, 60, 340, C.yellow, 0.16);
  circle(ctx, 100, H - 80, 240, C.orange, 0.2);
  circle(ctx, cx, H / 2, 560, C.white, 0.07);
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = C.white;
  ctx.font = `900 300px ${HEAD}`;
  ctx.fillText('?', 70, 430);
  ctx.fillText('!', W - 300, H - 40);
  ctx.restore();

  // Рамка
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.yellow;
  roundRect(ctx, 52, 52, W - 104, H - 104, 44);
  ctx.stroke();
  ctx.save();
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = C.white;
  roundRect(ctx, 76, 76, W - 152, H - 152, 32);
  ctx.stroke();
  ctx.restore();

  // Логотип
  const logoSize = 80;
  const logoX = cx - 190;
  const logoY = 150 - logoSize / 2;
  ctx.fillStyle = C.yellow;
  roundRect(ctx, logoX, logoY, logoSize, logoSize, 24);
  ctx.fill();
  ctx.fillStyle = C.pDark;
  ctx.font = `900 46px ${HEAD}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', logoX + logoSize / 2, logoY + logoSize / 2 + 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.white;
  ctx.font = `900 46px ${HEAD}`;
  ctx.fillText('Изи квиз', logoX + logoSize + 24, logoY + logoSize / 2 + 2);
  ctx.textBaseline = 'alphabetic';

  // Заголовок
  ctx.textAlign = 'center';
  ctx.fillStyle = C.yellow;
  ctx.font = `900 96px ${HEAD}`;
  ctx.fillText('СЕРТИФИКАТ', cx, 330);

  ctx.fillStyle = C.white;
  ctx.globalAlpha = 0.85;
  ctx.font = `600 34px ${BODY}`;
  ctx.fillText('подтверждает, что', cx, 395);
  ctx.globalAlpha = 1;

  // Имя участника
  const nameSize = fitFont(ctx, d.name, '900', HEAD, W - 360, 120);
  ctx.fillStyle = C.white;
  ctx.font = `900 ${nameSize}px ${HEAD}`;
  ctx.fillText(esc(d.name), cx, 540);
  ctx.strokeStyle = C.yellow;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 430, 570);
  ctx.lineTo(cx + 430, 570);
  ctx.stroke();

  ctx.fillStyle = C.white;
  ctx.globalAlpha = 0.9;
  ctx.font = `600 34px ${BODY}`;
  const sub = d.attempt > 1
    ? `принял(а) участие в квизе · попытка ${d.attempt}`
    : 'принял(а) участие в квизе';
  ctx.fillText(sub, cx, 640);
  ctx.globalAlpha = 1;

  // Название квиза в жёлтой плашке
  const quizText = `«${d.quiz}»`;
  const qSize = fitFont(ctx, quizText, '900', BODY, W - 500, 56);
  ctx.font = `900 ${qSize}px ${BODY}`;
  const tw = ctx.measureText(quizText).width;
  const pw = tw + 90;
  const ph = 96;
  const py = 700 - ph / 2;
  ctx.fillStyle = C.yellow;
  roundRect(ctx, cx - pw / 2, py, pw, ph, 30);
  ctx.fill();
  ctx.fillStyle = C.pDark;
  ctx.textBaseline = 'middle';
  ctx.fillText(quizText, cx, py + ph / 2 + 2);
  ctx.textBaseline = 'alphabetic';

  // Три карточки с результатом
  const stats = d.grade != null
    ? [
        { value: String(d.grade), label: 'оценка' },
        { value: `${d.score} из ${d.maxScore}`, label: 'баллов' },
        { value: d.date, label: 'дата игры' }
      ]
    : [
        { value: String(d.score), label: 'баллов' },
        { value: `${d.place} место`, label: `из ${d.total} игроков` },
        { value: d.date, label: 'дата игры' }
      ];

  const bw = 370;
  const bh = 134;
  const gap = 42;
  const total = stats.length * bw + (stats.length - 1) * gap;
  const x0 = cx - total / 2;
  const by = 830;
  stats.forEach((s, i) => {
    const x = x0 + i * (bw + gap);
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = C.white;
    roundRect(ctx, x, by, bw, bh, 34);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 2;
    roundRect(ctx, x, by, bw, bh, 34);
    ctx.stroke();
    ctx.restore();

    const vSize = fitFont(ctx, s.value, '900', HEAD, bw - 40, 46);
    ctx.fillStyle = C.yellow;
    ctx.font = `900 ${vSize}px ${HEAD}`;
    ctx.textAlign = 'center';
    ctx.fillText(s.value, x + bw / 2, by + 68);
    ctx.fillStyle = C.white;
    ctx.globalAlpha = 0.8;
    ctx.font = `600 26px ${BODY}`;
    ctx.fillText(s.label, x + bw / 2, by + 110);
    ctx.globalAlpha = 1;
  });

  // Подписи
  ctx.save();
  ctx.strokeStyle = C.white;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(230, 1000);
  ctx.lineTo(690, 1000);
  ctx.moveTo(W - 690, 1000);
  ctx.lineTo(W - 230, 1000);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = C.white;
  ctx.globalAlpha = 0.85;
  ctx.font = `600 24px ${BODY}`;
  ctx.fillText('Организатор квиза', 460, 1036);
  ctx.fillText(`Код квиза: ${d.quizCode}`, W - 460, 1036);
  ctx.globalAlpha = 1;

  // Номер сертификата — внизу, крупно
  ctx.fillStyle = C.yellow;
  ctx.font = `900 34px ${HEAD}`;
  ctx.fillText(`№ ${d.certNo}`, cx, 1130);
  ctx.fillStyle = C.white;
  ctx.globalAlpha = 0.7;
  ctx.font = `600 22px ${BODY}`;
  ctx.fillText('Изи квиз · проверить подлинность можно по номеру', cx, 1170);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// Собирает PDF-файл (A4 альбомный) из нарисованного сертификата
export async function certificatePdf(d) {
  const canvas = document.createElement('canvas');
  await drawCertificate(canvas, d);
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('Библиотека PDF не загрузилась. Проверьте интернет');
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
  pdf.setProperties({ title: `Сертификат ${d.certNo}`, author: 'Изи квиз' });
  return pdf;
}

export async function downloadCertificate(d) {
  const pdf = await certificatePdf(d);
  pdf.save(`sertifikat-${d.certNo}.pdf`);
}
