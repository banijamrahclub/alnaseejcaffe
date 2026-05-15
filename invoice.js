const money = (n) => Number(n || 0).toFixed(3) + " د.ب";

function qs(k) {
  return new URLSearchParams(window.location.search).get(k);
}

function fmtDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mo}/${yy} ${hh}:${mm}`;
}

async function load() {
  const orderId = qs("orderId");
  if (!orderId) {
    alert("الرجاء اختيار طلب أولاً");
    window.location.href = "/admin.html";
    return;
  }

  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json();
    if (!data.ok) {
      alert("الطلب غير موجود");
      window.location.href = "/admin.html";
      return;
    }

    const o = data.order;
    const items = data.items || [];

    // تعبئة البيانات الأساسية
    document.getElementById("invDate").textContent = fmtDate(o.created_at);
    document.getElementById("invPickup").textContent = o.pickup_time || "—";
    document.getElementById("cPhone").textContent = (o.customer_name ? o.customer_name + " - " : "") + o.customer_phone;
    document.getElementById("cCar").textContent = o.car_no || "—";

    // تعبئة الأصناف
    const tbody = document.getElementById("invItems");
    tbody.innerHTML = items.map(it => `
      <tr>
        <td style="padding: 8px 0;">
          <div style="font-weight:bold;">${it.item_name}</div>
          <div style="font-size:0.75rem; color:#666;">سعر الوحدة: ${Number(it.unit_price).toFixed(3)}</div>
        </td>
        <td style="text-align:center; vertical-align:middle;">${it.qty}</td>
        <td style="text-align:left; vertical-align:middle; font-weight:bold;">${Number(it.line_total).toFixed(3)}</td>
      </tr>
    `).join("");

    // المجاميع
    document.getElementById("tSub").textContent = Number(o.subtotal).toFixed(3) + " د.ب";
    // document.getElementById("tVat").textContent = Number(o.vat_amount).toFixed(3) + ` (${Math.round(o.vat_rate * 100)}%)`;
    document.getElementById("tTotal").textContent = Number(o.total).toFixed(3) + " د.ب";

    // إنشاء QR Code بسيط للفاتورة
    const qrEl = document.getElementById("qrCode");
    if (qrEl) {
      const qrData = `NSJ_INV_${o.id}_TOTAL_${o.total}`;
      qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    }

    // ملاحظة إضافية (اختياري)
    if (o.note) {
      const noteDiv = document.createElement("div");
      noteDiv.style.marginTop = "10px";
      noteDiv.style.fontSize = "0.8rem";
      noteDiv.style.borderTop = "1px solid #eee";
      noteDiv.style.paddingTop = "5px";
      noteDiv.innerHTML = `<b>ملاحظة:</b> ${o.note}`;
      document.querySelector(".totals-area").appendChild(noteDiv);
    }

    // تفعيل زر الطباعة
    document.getElementById("btnPrint").onclick = () => window.print();

  } catch (e) {
    console.error(e);
    alert("خطأ في تحميل بيانات الفاتورة");
  }
}

load();
