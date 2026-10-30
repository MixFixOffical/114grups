const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** HTML-шаблон сертификата. d = { studentName, groupName, grade, workTitle, subject, date, number } */
export function certificateHTML(d) {
  return `
  <div class="cert">
    <div class="cert-frame">
      <div class="cert-inner">
        <div class="corner tl"></div><div class="corner tr"></div>
        <div class="corner bl"></div><div class="corner br"></div>

        <div class="cert-head">
          <div class="cert-badge">★</div>
          <h1 class="cert-title">Сертификат</h1>
          <div class="cert-sub">о выполнении учебной работы</div>
        </div>

        <p class="cert-text">Настоящим подтверждается, что</p>
        <div class="cert-name">${esc(d.studentName)}</div>
        <p class="cert-text">студент(ка) группы <b>${esc(d.groupName)}</b></p>
        <p class="cert-text">успешно выполнил(а) работу на тему</p>
        <div class="cert-work">«${esc(d.workTitle)}»</div>
        <p class="cert-text">по предмету <b>${esc(d.subject)}</b></p>

        <div class="cert-grade-wrap">
          <div class="cert-grade-label">Оценка</div>
          <div class="cert-grade">${esc(d.grade)}</div>
        </div>

        <div class="cert-footer">
          <div class="sig"><div class="sig-line"></div>Преподаватель</div>
          <div class="seal"><span>CERT</span></div>
          <div class="sig"><div class="sig-line"></div>Дата: ${esc(d.date)}</div>
        </div>

        <div class="cert-number">№ ${esc(d.number)}</div>
      </div>
    </div>
  </div>`;
}

/** Рендерит сертификат в PDF и возвращает Blob. */
export async function renderCertificatePdf(data) {
  const stage = document.getElementById("certStage");
  stage.innerHTML = certificateHTML(data);
  const node = stage.querySelector(".cert");

  // Дожидаемся загрузки шрифтов, иначе PDF получится с запасным шрифтом
  await Promise.all([
    document.fonts.load('700 60px "Playfair Display"'),
    document.fonts.load('400 20px "Montserrat"'),
    document.fonts.load('700 20px "Montserrat"')
  ]);

  const canvas = await window.html2canvas(node, {
    scale: 2,
    backgroundColor: "#fffdf7",
    useCORS: true,
    logging: false
  });
  stage.innerHTML = "";

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1123, 794] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 1123, 794);
  return pdf.output("blob");
}
