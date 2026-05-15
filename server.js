const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
// ===== Admin Key Removed =====

function requireAdmin(req, res, next) {
  // تم إزالة التحقق من المفتاح بناءً على طلب المستخدم
  return next();
}


app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// مسار إضافي للتأكد من فتح الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const db = new Database(path.join(__dirname, "data.sqlite"));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    car_no TEXT,
    pickup_time TEXT,
    note TEXT,
    subtotal REAL NOT NULL,
    vat_rate REAL NOT NULL,
    vat_amount REAL NOT NULL,
    total REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    unit_price REAL NOT NULL,
    qty INTEGER NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    price REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    image_url TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS ice_flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  INSERT OR IGNORE INTO settings (key, value) VALUES ('cafe_open', 'true');
`);

try {
  db.exec("ALTER TABLE orders ADD COLUMN customer_name TEXT");
} catch (e) { }

//Migrate existing db if needed
try {
  db.exec("ALTER TABLE menu_items ADD COLUMN image_url TEXT");
} catch (e) { }
// ===== MIGRATION: ensure menu_items exists =====
db.exec(`
CREATE TABLE IF NOT EXISTS menu_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  price REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`);

// ===== FIX: ensure active flags =====
try {
  db.prepare(`UPDATE menu_items SET is_active = 1 WHERE is_active IS NULL`).run();
} catch { }

// ===== Seed Menu (insert full menu if table empty) =====
function seedMenuIfEmpty() {
  const n = db.prepare(`SELECT COUNT(*) AS n FROM menu_items`).get().n;
  if (n > 0) {
    console.log("Menu exists ✅ rows:", n);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO menu_items(tag, category, name, note, price, is_active, sort_order)
VALUES(@tag, @category, @name, @note, @price, 1, @sort_order)
  `);

  const rows = [
    // ===== الحلويات =====
    { tag: "الحلويات", category: "الكيك", name: "سان سيباستيان", note: null, price: 1.500, sort_order: 1 },
    { tag: "الحلويات", category: "الكيك", name: "بيستاشيو تشيز كيك", note: null, price: 1.300, sort_order: 2 },
    { tag: "الحلويات", category: "الكيك", name: "ريد فيلفيت كيك", note: null, price: 1.300, sort_order: 3 },
    { tag: "الحلويات", category: "الكيك", name: "تشوكليت هافن كيك", note: null, price: 1.300, sort_order: 4 },

    { tag: "الحلويات", category: "المفن", name: "مفن بالشوكليت", note: null, price: 0.550, sort_order: 1 },
    { tag: "الحلويات", category: "المفن", name: "مفن بالفانيلا", note: null, price: 0.550, sort_order: 2 },
    { tag: "الحلويات", category: "المفن", name: "مفن بالتوت الأزرق", note: null, price: 0.550, sort_order: 3 },

    { tag: "الحلويات", category: "الكرواسون الجامبو", name: "كرواسون سادة", note: null, price: 0.600, sort_order: 1 },
    { tag: "الحلويات", category: "الكرواسون الجامبو", name: "كرواسون بالجبن", note: null, price: 0.700, sort_order: 2 },
    { tag: "الحلويات", category: "الكرواسون الجامبو", name: "كرواسون بالزعتر", note: null, price: 0.650, sort_order: 3 },
    { tag: "الحلويات", category: "الكرواسون الجامبو", name: "كرواسون باللوز", note: null, price: 0.850, sort_order: 4 },
    { tag: "الحلويات", category: "الكرواسون الجامبو", name: "كرواسون بالشوكليت", note: null, price: 0.750, sort_order: 5 },

    { tag: "الحلويات", category: "السينامون", name: "الفاخر: مع كريمة الجبن والكراميل", note: "145 جرام", price: 1.000, sort_order: 1 },
    { tag: "الحلويات", category: "السينامون", name: "العادي: سادة", note: "110 جرام", price: 0.700, sort_order: 2 },
    { tag: "الحلويات", category: "السينامون", name: "سينامون بالزبيب", note: null, price: 0.500, sort_order: 3 },
    { tag: "الحلويات", category: "السينامون", name: "سينامون بالشوكولاته", note: null, price: 0.500, sort_order: 4 },
    { tag: "الحلويات", category: "السينامون", name: "سينامون بالقرفة والجوز", note: null, price: 0.600, sort_order: 5 },
    { tag: "الحلويات", category: "السينامون", name: "سينامون بابكا", note: null, price: 0.400, sort_order: 6 },

    { tag: "الحلويات", category: "الكوكيز", name: "كوكيز عادي (M)", note: null, price: 0.500, sort_order: 1 },
    { tag: "الحلويات", category: "الكوكيز", name: "كوكيز بقطع الشوكولاته (فاخر)", note: null, price: 0.800, sort_order: 2 },
    { tag: "الحلويات", category: "الكوكيز", name: "كوكيز الشوكولاته بقطع الشوكولاته", note: null, price: 0.800, sort_order: 3 },
    { tag: "الحلويات", category: "الكوكيز", name: "كوكيز البندق بقطع الشوكولاته", note: null, price: 0.800, sort_order: 4 },
    { tag: "الحلويات", category: "الكوكيز", name: "كوكيز بالفستق", note: null, price: 1.000, sort_order: 5 },

    { tag: "الحلويات", category: "أصناف أخرى", name: "براونيز كبير (L)", note: null, price: 0.650, sort_order: 1 },
    { tag: "الحلويات", category: "أصناف أخرى", name: "براونيز صغير", note: null, price: 0.500, sort_order: 2 },
    { tag: "الحلويات", category: "أصناف أخرى", name: "ورق عنب", note: null, price: 0.850, sort_order: 3 },

    { tag: "الحلويات", category: "أصناف أخرى", name: "نفيش (Popcorn) - 0.200", note: null, price: 0.200, sort_order: 10 },
    { tag: "الحلويات", category: "أصناف أخرى", name: "نفيش (Popcorn) - 0.300", note: null, price: 0.300, sort_order: 11 },
    { tag: "الحلويات", category: "أصناف أخرى", name: "نفيش (Popcorn) - 0.400", note: null, price: 0.400, sort_order: 12 },
    { tag: "الحلويات", category: "أصناف أخرى", name: "نفيش (Popcorn) - 0.500", note: null, price: 0.500, sort_order: 13 },

    // ===== المشروبات =====
    { tag: "المشروبات", category: "القهوة الحارة", name: "اسبريسو (XS)", note: null, price: 0.700, sort_order: 1 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "أمريكانو (S)", note: null, price: 0.800, sort_order: 2 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "أمريكانو (M)", note: null, price: 1.000, sort_order: 3 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "لاتيه (S)", note: null, price: 0.900, sort_order: 4 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "لاتيه (M)", note: null, price: 1.100, sort_order: 5 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "سبانش لاتيه (S)", note: null, price: 1.000, sort_order: 6 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "سبانش لاتيه (M)", note: null, price: 1.200, sort_order: 7 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "كراميل لاتيه (S)", note: null, price: 1.000, sort_order: 8 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "كراميل لاتيه (M)", note: null, price: 1.200, sort_order: 9 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "روز لاتيه (S)", note: null, price: 1.000, sort_order: 10 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "روز لاتيه (M)", note: null, price: 1.200, sort_order: 11 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "فانيلا لاتيه (S)", note: null, price: 1.000, sort_order: 12 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "فانيلا لاتيه (M)", note: null, price: 1.200, sort_order: 13 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "كابتشينو (S)", note: null, price: 0.900, sort_order: 14 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "كابتشينو (M)", note: null, price: 1.100, sort_order: 15 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "موكا (S)", note: null, price: 1.100, sort_order: 16 },
    { tag: "المشروبات", category: "القهوة الحارة", name: "موكا (M)", note: null, price: 1.300, sort_order: 17 },

    { tag: "المشروبات", category: "الشاي والحليب", name: "شاي أحمر", note: null, price: 0.200, sort_order: 1 },
    { tag: "المشروبات", category: "الشاي والحليب", name: "شاي كرك", note: null, price: 0.200, sort_order: 2 },
    { tag: "المشروبات", category: "الشاي والحليب", name: "شاي ليمون", note: null, price: 0.200, sort_order: 3 },
    { tag: "المشروبات", category: "الشاي والحليب", name: "حليب أبيض", note: null, price: 0.300, sort_order: 4 },

    { tag: "المشروبات", category: "مشروبات باردة أخرى", name: "السلاش - 0.500", note: null, price: 0.500, sort_order: 1 },
    { tag: "المشروبات", category: "مشروبات باردة أخرى", name: "السلاش - 0.700", note: null, price: 0.700, sort_order: 2 },
    { tag: "المشروبات", category: "مشروبات باردة أخرى", name: "الشربت (فمتو) - صغير", note: null, price: 0.300, sort_order: 3 },
    { tag: "المشروبات", category: "مشروبات باردة أخرى", name: "الشربت (فمتو) - كبير", note: null, price: 0.500, sort_order: 4 },
  ];

  const tx = db.transaction(() => {
    for (const r of rows) insert.run(r);
  });

  tx();
  console.log("Menu seeded ✅ rows:", rows.length);
}

seedMenuIfEmpty();

const makeOrderNo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NSJ-${y}${m}${d}-${r}`;
};

const money3 = (n) => Number(n || 0).toFixed(3);

const phoneOk = (s) => /^[0-9+\s-]{8,}$/.test(String(s || "").trim());

function validateOrderPayload(body) {
  const errors = [];
  if (!phoneOk(body.customer_phone)) errors.push("رقم الهاتف غير صحيح");
  // pickup_time removed from customer order flow
  if (!Array.isArray(body.items) || body.items.length === 0) errors.push("لا يوجد أصناف");
  else {
    for (const it of body.items) {
      if (!it.item_name || String(it.item_name).trim() === "") errors.push("اسم الصنف ناقص");
      if (Number(it.unit_price) <= 0) errors.push("سعر الصنف غير صحيح");
      if (!Number.isInteger(it.qty) || it.qty <= 0) errors.push("الكمية غير صحيحة");
    }
  }
  return errors;
}

// ============ API (داخل نفس السيرفر) ============
// جلب حالة الطلب بواسطة رقم الطلب (للـ Tracking)
app.get("/api/orders/by-no/:orderNo", (req, res) => {
  const orderNo = String(req.params.orderNo || "").trim();
  if (!orderNo) return res.status(400).json({ ok: false, error: "order_no required" });

  const order = db.prepare(`
    SELECT id, order_no, created_at, status, total
    FROM orders
    WHERE order_no = ?
  `).get(orderNo);

  if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

  res.json({
    ok: true,
    order: {
      id: order.id,
      order_no: order.order_no,
      created_at: order.created_at,
      status: order.status,
      total: order.total
    }
  });
});

// ===== Settings =====
app.get("/api/settings", (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'cafe_open'").get();
  res.json({ cafe_open: row ? row.value === 'true' : true });
});

app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const open = !!req.body.cafe_open;
  db.prepare("UPDATE settings SET value = ? WHERE key = 'cafe_open'").run(String(open));
  res.json({ ok: true });
  io.emit("settings_updated", { cafe_open: open });
});

// ===== Menu for normal site =====
app.get("/api/menu", (req, res) => {
  const rows = db.prepare(`
    SELECT id, tag, category, name, note, price, is_active, sort_order, image_url
    FROM menu_items
    WHERE is_active = 1
    ORDER BY tag ASC, category ASC, sort_order ASC, id ASC
  `).all();

  const map = new Map();
  for (const r of rows) {
    const key = `${r.tag}|| ${r.category} `;
    if (!map.has(key)) map.set(key, { tag: r.tag, name: r.category, items: [] });
    map.get(key).items.push({
      id: r.id,
      name: r.name,
      note: r.note || undefined,
      price: Number(r.price || 0),
      image_url: r.image_url || null
    });
  }

  res.json({ ok: true, menu: Array.from(map.values()) });
});
// Tracking by ID (أضمن من order_no)
app.get("/api/orders/by-id/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "id required" });

  const order = db.prepare(`
    SELECT id, order_no, created_at, status, total
    FROM orders
    WHERE id = ?
  `).get(id);

  if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

  res.json({ ok: true, order });
});


// إنشاء طلب من موقع الطلب
app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  const errors = validateOrderPayload(body);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const orderNo = makeOrderNo();
  const createdAt = new Date().toISOString();
  const status = "new";

  const items = body.items.map((it) => {
    const unit = Number(it.unit_price);
    const qty = Number(it.qty);
    return {
      item_name: String(it.item_name).trim(),
      unit_price: unit,
      qty,
      line_total: unit * qty
    };
  });

  const subtotal = items.reduce((a, b) => a + b.line_total, 0);
  const vatRate = 0;
  const vatAmount = 0;
  const total = subtotal;

  const insertOrder = db.prepare(`
    INSERT INTO orders
  (order_no, created_at, status, customer_phone, customer_name, car_no, pickup_time, note, subtotal, vat_rate, vat_amount, total)
VALUES
  (@order_no, @created_at, @status, @customer_phone, @customer_name, @car_no, @pickup_time, @note, @subtotal, @vat_rate, @vat_amount, @total)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items(order_id, item_name, unit_price, qty, line_total)
VALUES(@order_id, @item_name, @unit_price, @qty, @line_total)
  `);

  const tx = db.transaction(() => {
    const info = insertOrder.run({
      order_no: orderNo,
      created_at: createdAt,
      status,
      customer_phone: String(body.customer_phone).trim(),
      customer_name: body.customer_name ? String(body.customer_name).trim() : null,
      car_no: body.car_no ? String(body.car_no).trim() : null,
      pickup_time: body.pickup_time ? String(body.pickup_time).trim() : "—",
      note: body.note ? String(body.note).trim() : null,
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total
    });

    const orderId = info.lastInsertRowid;

    for (const it of items) {
      insertItem.run({ order_id: orderId, ...it });
    }

    return orderId;
  });

  try {
    const orderId = tx();
    res.json({
      ok: true,
      order_id: orderId,
      order_no: orderNo,
      totals: {
        subtotal: Number(money3(subtotal)),
        vat_rate: vatRate,
        vat_amount: Number(money3(vatAmount)),
        total: Number(money3(total))
      }
    });
    io.emit("new_order");
  } catch (e) {
    res.status(500).json({ ok: false, error: "فشل حفظ الطلب" });
  }
});

// جلب كل الطلبات (للوحة الإدارة)
app.get("/api/orders", (req, res) => {
  const status = (req.query.status || "all").toString();
  const q = (req.query.q || "").toString().trim();

  let where = "1=1";
  const params = {};

  if (status !== "all") {
    where += " AND status = @status";
    params.status = status;
  }
  if (q) {
    where += " AND (order_no LIKE @q OR customer_phone LIKE @q OR IFNULL(car_no,'') LIKE @q)";
    params.q = `% ${q}% `;
  }

  const rows = db.prepare(`
    SELECT id, order_no, created_at, status, customer_phone, customer_name, car_no, pickup_time, note, subtotal, vat_rate, vat_amount, total
    FROM orders
    WHERE ${where}
    ORDER BY id DESC
    LIMIT 200
  `).all(params);

  // جلب الأصناف لكل طلب لتسريع العرض في لوحة الإدارة
  const ordersWithItems = rows.map(order => {
    const items = db.prepare(`
      SELECT item_name, unit_price, qty, line_total
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `).all(order.id);
    return { ...order, items };
  });

  res.json({ ok: true, orders: ordersWithItems });
});

// جلب طلب واحد + أصنافه (للفاتورة/التفاصيل)
app.get("/api/orders/:id", (req, res) => {
  const id = Number(req.params.id);
  const order = db.prepare(`
    SELECT id, order_no, created_at, status, customer_phone, customer_name, car_no, pickup_time, note, subtotal, vat_rate, vat_amount, total
    FROM orders WHERE id = ?
  `).get(id);

  if (!order) return res.status(404).json({ ok: false, error: "الطلب غير موجود" });

  const items = db.prepare(`
    SELECT item_name, unit_price, qty, line_total
    FROM order_items
    WHERE order_id = ?
  ORDER BY id ASC
  `).all(id);

  res.json({ ok: true, order, items });
});

// تحديث حالة الطلب
app.patch("/api/orders/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "").trim();
  const allowed = new Set(["new", "preparing", "ready", "done"]);
  if (!allowed.has(status)) return res.status(400).json({ ok: false, error: "حالة غير صالحة" });

  const info = db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, id);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
  res.json({ ok: true });
});

app.get("/api/orders/info", (req, res) => {
  const orderId = req.query.orderId;
  const orderNo = req.query.orderNo;

  let order;
  if (orderId) {
    order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(orderId));
  } else if (orderNo) {
    order = db.prepare(`SELECT * FROM orders WHERE TRIM(order_no) = ?`).get(String(orderNo).trim());
  }

  if (!order) return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(order.id);
  res.json({ ok: true, order, items });
});

// حذف طلب
app.delete("/api/orders/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare(`DELETE FROM orders WHERE id = ? `).run(id);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
  res.json({ ok: true });
});


// ===== Admin Menu Management =====
app.get("/api/admin/menu/categories", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT DISTINCT category FROM menu_items ORDER BY category ASC").all();
  res.json({ ok: true, categories: rows.map(r => r.category) });
});

app.get("/api/admin/menu/items", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM menu_items ORDER BY id DESC").all();
  res.json({ ok: true, items: rows });
});

app.post("/api/admin/menu/items", requireAdmin, (req, res) => {
  const { tag, category, name, price, note, sort_order, image_url } = req.body;
  const info = db.prepare(`
    INSERT INTO menu_items(tag, category, name, note, price, sort_order, is_active, image_url)
VALUES(?, ?, ?, ?, ?, ?, 1, ?)
  `).run(tag, category, name, note || null, Number(price), Number(sort_order || 0), image_url || null);
  res.json({ ok: true, id: info.lastInsertRowid });
  io.emit("menu_updated");
});

app.put("/api/admin/menu/items/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, price, is_active, image_url } = req.body;

  // نستخدم COALESCE للحقول التي لا نريد مسحها بالخطأ، 
  // أما رابط الصورة فنريد السماح بمسحه (إرسال null أو نص فارغ)
  db.prepare(`
    UPDATE menu_items 
    SET name = COALESCE(?, name),
        price = COALESCE(?, price),
        is_active = COALESCE(?, is_active),
        image_url = ?
    WHERE id = ?
  `).run(
    name || null,
    price !== undefined ? Number(price) : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    image_url ? (() => {
      let url = image_url.trim();
      if (url.includes("github.com") && url.includes("/blob/")) {
        url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
      }
      return url;
    })() : null,
    id
  );

  res.json({ ok: true });
  io.emit("menu_updated");
});

// === نكهات الأيسكريم ===
app.get("/api/flavors", (req, res) => {
  const rows = db.prepare(`SELECT * FROM ice_flavors WHERE is_active = 1`).all();
  res.json({ ok: true, flavors: rows });
});

app.get("/api/admin/flavors", requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM ice_flavors`).all();
  res.json({ ok: true, flavors: rows });
});

app.post("/api/admin/flavors", requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ ok: false });
  db.prepare(`INSERT INTO ice_flavors (name) VALUES (?)`).run(name);
  res.json({ ok: true });
  io.emit("menu_updated");
});

app.post("/api/admin/flavors/set", requireAdmin, (req, res) => {
  const { flavors } = req.body;
  if (!Array.isArray(flavors)) return res.status(400).json({ ok: false });
  
  db.transaction(() => {
    db.prepare("DELETE FROM ice_flavors").run();
    const stmt = db.prepare("INSERT INTO ice_flavors (name) VALUES (?)");
    for (const f of flavors) {
      if (f && f.trim()) stmt.run(f.trim());
    }
  })();
  
  res.json({ ok: true });
  io.emit("menu_updated");
});

app.patch("/api/admin/flavors/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  db.prepare(`UPDATE ice_flavors SET is_active = ? WHERE id = ?`).run(is_active ? 1 : 0, id);
  res.json({ ok: true });
  io.emit("menu_updated");
});

app.delete("/api/admin/flavors/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM ice_flavors WHERE id = ?`).run(id);
  res.json({ ok: true });
  io.emit("menu_updated");
});

app.delete("/api/admin/menu/items/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
  res.json({ ok: true });
  io.emit("menu_updated");
});

// تشغيل
server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
