require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const app = express();
app.use(cors());
app.use(express.json());

// =====================
// CONFIG (inline)
// =====================
const MONGO_URI = process.env.MONGO_URI;

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI || !JWT_SECRET) {
  console.error('Missing MONGO_URI or JWT_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// =====================
// Mongo Connect
// =====================
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB Atlas Connected'))
  .catch((err) => {
    console.error('MongoDB error:', err.message);
    process.exit(1);
  });

// =====================
// Helpers
// =====================
const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email, iat, exp }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid/expired token' });
  }
};

const signToken = (user) =>
  jwt.sign({ userId: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '2h' });

// =====================
// Schemas & Models (inline)
// =====================

// Users
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

// Vitals
const vitalsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    measuredAt: { type: Date, default: Date.now, index: true },
    bloodPressure: {
      systolic: { type: Number, default: null },
      diastolic: { type: Number, default: null },
    },
    heartRate: { type: Number, default: null },
    bloodSugar: { type: Number, default: null }, // mg/dL (افتراض)
    temperature: { type: Number, default: null }, // C
    notes: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);
const Vitals = mongoose.model('Vitals', vitalsSchema);

// Adult Reports
const adultReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    vitalsId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vitals', required: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
    summary: { type: String, required: true },
    warnings: [{ type: String }],
    recommendations: [{ type: String }],
    images: [{ title: String, url: String }],
    disclaimer: { type: String, required: true },
  },
  { timestamps: true }
);
const AdultReport = mongoose.model('AdultReport', adultReportSchema);

// Children Profiles
const childProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    childName: { type: String, required: true, trim: true },
    ageYears: { type: Number, required: true, min: 0, max: 18, index: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  },
  { timestamps: true }
);
const ChildProfile = mongoose.model('ChildProfile', childProfileSchema);

// Child Guides (content by age range)
const childGuideSchema = new mongoose.Schema(
  {
    ageMin: { type: Number, required: true, min: 0, max: 18, index: true },
    ageMax: { type: Number, required: true, min: 0, max: 18, index: true },
    title: { type: String, required: true },
    commonConditions: [
      {
        name: String,
        symptoms: [String],
        redFlags: [String],
        prevention: [String],
        images: [String],
      },
    ],
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const ChildGuide = mongoose.model('ChildGuide', childGuideSchema);
const CHILD_GUIDES_SAMPLE = [
  {
    ageMin: 0,
    ageMax: 2,
    title: '0-2 سنوات: مؤشرات شائعة ونصائح وقائية',
    commonConditions: [
      {
        name: 'نزلات البرد',
        symptoms: ['سيلان أنف', 'سعال خفيف', 'حرارة بسيطة'],
        redFlags: ['صعوبة تنفس', 'خمول شديد', 'رفض الرضاعة/الأكل'],
        prevention: ['غسل اليدين', 'تجنب المخالطة عند المرض', 'ترطيب الجو'],
        images: ['https://dummyimage.com/600x400&text=Cold+0-2'],
      },
      {
        name: 'جفاف',
        symptoms: ['قلة بلل الحفاض', 'جفاف الفم', 'بكاء بدون دموع'],
        redFlags: ['خمول', 'قلة استجابة', 'قيء مستمر'],
        prevention: ['سوائل كافية', 'مراقبة البلل', 'مراجعة الطبيب عند الشك'],
        images: ['https://dummyimage.com/600x400&text=Dehydration+0-2'],
      },
    ],
  },
  {
    ageMin: 3,
    ageMax: 6,
    title: '3-6 سنوات: صحة المدرسة والوقاية',
    commonConditions: [
      {
        name: 'التهاب حلق',
        symptoms: ['ألم حلق', 'حرارة', 'صعوبة بلع'],
        redFlags: ['حرارة عالية مستمرة', 'طفح جلدي', 'صعوبة تنفس'],
        prevention: ['تجنب مشاركة الأدوات', 'غسل اليدين', 'تغذية جيدة'],
        images: ['https://dummyimage.com/600x400&text=Throat+3-6'],
      },
    ],
  },
  {
    ageMin: 7,
    ageMax: 12,
    title: '7-12 سنة: نشاط بدني وغذاء',
    commonConditions: [
      {
        name: 'حساسية موسمية',
        symptoms: ['عطاس', 'حكة عين', 'سيلان أنف'],
        redFlags: ['صفير/ضيق نفس', 'تورم شديد', 'إغماء'],
        prevention: ['تجنب المحفزات', 'تهوية مناسبة', 'متابعة الطبيب عند التفاقم'],
        images: ['https://dummyimage.com/600x400&text=Allergy+7-12'],
      },
    ],
  },
  {
    ageMin: 13,
    ageMax: 18,
    title: '13-18 سنة: المراهقة والصحة العامة',
    commonConditions: [
      {
        name: 'حب الشباب',
        symptoms: ['بثور', 'التهاب جلد', 'آثار'],
        redFlags: ['التهاب شديد/قيح', 'ألم شديد', 'تأثير نفسي واضح'],
        prevention: ['روتين تنظيف لطيف', 'عدم العبث بالبثور', 'استشارة طبيب جلدية عند الشدة'],
        images: ['https://dummyimage.com/600x400&text=Acne+13-18'],
      },
    ],
  },
];

let guidesReady = false;

async function ensureChildGuides() {
  if (guidesReady) return;

  const count = await ChildGuide.countDocuments();
  if (count === 0) {
    await ChildGuide.insertMany(CHILD_GUIDES_SAMPLE);
    console.log('Child guides auto-seeded');
  }
  guidesReady = true;
}
// =====================
// Core Logic: Risk Rules (simple, expandable)
// =====================
function evaluateAdultRisk(v) {
  const warnings = [];
  const recommendations = [];
  let score = 0;

  const sys = toNum(v?.bloodPressure?.systolic);
  const dia = toNum(v?.bloodPressure?.diastolic);
  const hr = toNum(v?.heartRate);
  const sugar = toNum(v?.bloodSugar);
  const temp = toNum(v?.temperature);

  // Blood Pressure
  if (sys !== null && dia !== null) {
    if (sys >= 180 || dia >= 120) {
      score += 3;
      warnings.push('قراءات ضغط مرتفعة جدًا (قد تكون حالة طارئة).');
    } else if (sys >= 140 || dia >= 90) {
      score += 2;
      warnings.push('ضغط الدم أعلى من الطبيعي.');
    } else if (sys < 90 || dia < 60) {
      score += 2;
      warnings.push('ضغط الدم منخفض عن الطبيعي.');
    } else {
      recommendations.push('ضغط الدم ضمن نطاق مقبول. حافظ على نمط حياة صحي.');
    }
  }

  // Heart Rate
  if (hr !== null) {
    if (hr > 120) {
      score += 2;
      warnings.push('نبض مرتفع بشكل ملحوظ.');
    } else if (hr < 50) {
      score += 2;
      warnings.push('نبض منخفض بشكل ملحوظ.');
    } else {
      recommendations.push('النبض ضمن نطاق مقبول في الراحة.');
    }
  }

  // Blood Sugar (افتراض mg/dL)
  if (sugar !== null) {
    if (sugar >= 250) {
      score += 3;
      warnings.push('سكر مرتفع جدًا.');
    } else if (sugar >= 180) {
      score += 2;
      warnings.push('سكر مرتفع.');
    } else if (sugar < 70) {
      score += 2;
      warnings.push('سكر منخفض.');
    } else {
      recommendations.push('السكر ضمن نطاق مقبول، حافظ على الوجبات المتوازنة.');
    }
  }

  // Temperature (C)
  if (temp !== null) {
    if (temp >= 39) {
      score += 2;
      warnings.push('حرارة مرتفعة (حمّى).');
    } else if (temp <= 35) {
      score += 2;
      warnings.push('حرارة منخفضة عن الطبيعي.');
    } else {
      recommendations.push('الحرارة ضمن نطاق طبيعي تقريبًا.');
    }
  }

  // Generic recommendations
  recommendations.push('اشرب ماء كفاية، وراقب النوم، وقلّل المنبهات إذا كان النبض مرتفع.');
  if (warnings.length) recommendations.push('إذا الأعراض شديدة أو مستمرة، راجع طبيب/طوارئ.');

  let riskLevel = 'low';
  if (score >= 5) riskLevel = 'high';
  else if (score >= 3) riskLevel = 'medium';

  const summary =
    riskLevel === 'low'
      ? 'المؤشرات تبدو مستقرة نسبيًا بناءً على البيانات المُدخلة.'
      : riskLevel === 'medium'
      ? 'هناك مؤشرات تحتاج متابعة واحتياط بناءً على البيانات المُدخلة.'
      : 'هناك مؤشرات عالية الخطورة وقد تستدعي تقييمًا طبيًا عاجلًا حسب الأعراض.';

  const disclaimer =
    'هذا التقرير معلومات توعوية مبنية على بيانات مُدخلة ذاتيًا، ولا يُعد تشخيصًا طبيًا ولا يغني عن استشارة طبيب. في حال وجود أعراض مقلقة، راجع الطوارئ.';

  const images = [
    { title: 'Blood Pressure Info', url: 'https://dummyimage.com/600x400&text=Blood+Pressure' },
    { title: 'Blood Sugar Info', url: 'https://dummyimage.com/600x400&text=Blood+Sugar' },
  ];

  return { riskLevel, summary, warnings, recommendations, images, disclaimer };
}

//====================
// Swagger Setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vitalyze API',
      version: '1.0.0',
      description: 'Health Awareness & Reports API',
    },
    servers: [
      {
        url: 'http://localhost:5000',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['index.js'], // نستخدم نفس الملف
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

//=====================

// =====================
// Routes
// =====================

// Health check
/**
 * @swagger
 * /:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 */
app.get('/', (req, res) => res.json({ status: 'ok', app: 'Vitalyze API' }));

// ---------- AUTH ----------
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register new user
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'fullName, email, password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      fullName: String(fullName).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash,
    });

    const token = signToken(user);
    return res.status(201).json({
      message: 'Registered',
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    return res.json({
      message: 'Logged in',
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.userId).select('_id fullName email createdAt');
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user });
});

// ---------- VITALS ----------
/**
 * @swagger
 * /api/vitals:
 *   post:
 *     tags: [Vitals]
 *     summary: Add vitals reading
 *     security:
 *       - bearerAuth: []
 *   get:
 *     tags: [Vitals]
 *     summary: List vitals
 *     security:
 *       - bearerAuth: []
 */
app.post('/api/vitals', auth, async (req, res) => {
  try {
    const {
      measuredAt,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      heartRate,
      bloodSugar,
      temperature,
      notes,
    } = req.body;

    // Basic sanity checks (خفيفة)
    const sys = toNum(bloodPressureSystolic);
    const dia = toNum(bloodPressureDiastolic);
    const hr = toNum(heartRate);
    const sugar = toNum(bloodSugar);
    const temp = toNum(temperature);

    if (sys !== null && (sys < 50 || sys > 260))
      return res.status(400).json({ message: 'Invalid systolic value' });
    if (dia !== null && (dia < 30 || dia > 180))
      return res.status(400).json({ message: 'Invalid diastolic value' });
    if (hr !== null && (hr < 30 || hr > 220))
      return res.status(400).json({ message: 'Invalid heartRate value' });
    if (sugar !== null && (sugar < 30 || sugar > 600))
      return res.status(400).json({ message: 'Invalid bloodSugar value' });
    if (temp !== null && (temp < 30 || temp > 43))
      return res.status(400).json({ message: 'Invalid temperature value' });

    const v = await Vitals.create({
      userId: req.user.userId,
      measuredAt: measuredAt ? new Date(measuredAt) : new Date(),
      bloodPressure: { systolic: sys, diastolic: dia },
      heartRate: hr,
      bloodSugar: sugar,
      temperature: temp,
      notes: notes ? String(notes) : '',
    });

    return res.status(201).json({ message: 'Vitals saved', vitals: v });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/vitals', auth, async (req, res) => {
  const { from, to, limit } = req.query;

  const q = { userId: req.user.userId };
  if (from || to) {
    q.measuredAt = {};
    if (from) q.measuredAt.$gte = new Date(from);
    if (to) q.measuredAt.$lte = new Date(to);
  }

  const items = await Vitals.find(q)
    .sort({ measuredAt: -1 })
    .limit(Math.min(Number(limit || 50), 200));

  return res.json({ count: items.length, items });
});
/**
 * @swagger
 * /api/vitals/latest:
 *   get:
 *     tags: [Vitals]
 *     summary: Get latest vitals
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/vitals/latest', auth, async (req, res) => {
  const latest = await Vitals.findOne({ userId: req.user.userId }).sort({ measuredAt: -1 });
  if (!latest) return res.status(404).json({ message: 'No vitals found' });
  return res.json({ latest });
});

// Insights: compare last 2 readings
/**
 * @swagger
 * /api/vitals/insights/latest:
 *   get:
 *     tags: [Vitals]
 *     summary: Compare latest two readings (insights)
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/vitals/insights/latest', auth, async (req, res) => {
  const lastTwo = await Vitals.find({ userId: req.user.userId })
    .sort({ measuredAt: -1 })
    .limit(2);

  if (lastTwo.length < 2) {
    return res.json({ message: 'Need at least two readings', insights: null });
  }

  const [a, b] = lastTwo; // a latest, b previous
  const delta = (x, y) => {
    if (x === null || x === undefined || y === null || y === undefined) return null;
    return Number(x) - Number(y);
  };

  const insights = {
    comparedAt: new Date(),
    latestAt: a.measuredAt,
    previousAt: b.measuredAt,
    heartRateDelta: delta(a.heartRate, b.heartRate),
    bloodSugarDelta: delta(a.bloodSugar, b.bloodSugar),
    temperatureDelta: delta(a.temperature, b.temperature),
    systolicDelta: delta(a.bloodPressure?.systolic, b.bloodPressure?.systolic),
    diastolicDelta: delta(a.bloodPressure?.diastolic, b.bloodPressure?.diastolic),
    bpTrend:
      delta(a.bloodPressure?.systolic, b.bloodPressure?.systolic) === null
        ? 'unknown'
        : delta(a.bloodPressure?.systolic, b.bloodPressure?.systolic) > 0
        ? 'up'
        : delta(a.bloodPressure?.systolic, b.bloodPressure?.systolic) < 0
        ? 'down'
        : 'stable',
  };

  return res.json({ insights });
});

// ---------- ADULT REPORTS ----------
/**
 * @swagger
 * /api/reports/adult/generate:
 *   post:
 *     tags: [Reports]
 *     summary: Generate adult report (latest vitals or by vitalsId)
 *     security:
 *       - bearerAuth: []
 */
app.post('/api/reports/adult/generate', auth, async (req, res) => {
  try {
    const { vitalsId } = req.body;

    let v;
    if (vitalsId) {
      v = await Vitals.findOne({ _id: vitalsId, userId: req.user.userId });
      if (!v) return res.status(404).json({ message: 'Vitals not found for this user' });
    } else {
      v = await Vitals.findOne({ userId: req.user.userId }).sort({ measuredAt: -1 });
      if (!v) return res.status(404).json({ message: 'No vitals to generate report' });
    }

    const evaluated = evaluateAdultRisk(v);

    const report = await AdultReport.create({
      userId: req.user.userId,
      vitalsId: v._id,
      riskLevel: evaluated.riskLevel,
      summary: evaluated.summary,
      warnings: evaluated.warnings,
      recommendations: evaluated.recommendations,
      images: evaluated.images,
      disclaimer: evaluated.disclaimer,
    });

    return res.status(201).json({ message: 'Report generated', report });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});
/**
 * @swagger
 * /api/reports/adult/latest:
 *   get:
 *     tags: [Reports]
 *     summary: Get latest adult report
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/reports/adult/latest', auth, async (req, res) => {
  const report = await AdultReport.findOne({ userId: req.user.userId }).sort({ generatedAt: -1 });
  if (!report) return res.status(404).json({ message: 'No reports found' });
  return res.json({ report });
});
/**
 * @swagger
 * /api/reports/adult:
 *   get:
 *     tags: [Reports]
 *     summary: List adult reports
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/reports/adult', auth, async (req, res) => {
  const { limit } = req.query;
  const items = await AdultReport.find({ userId: req.user.userId })
    .sort({ generatedAt: -1 })
    .limit(Math.min(Number(limit || 20), 200));
  return res.json({ count: items.length, items });
});

// ---------- CHILD PROFILES ----------
/**
 * @swagger
 * /api/children:
 *   post:
 *     tags: [Children]
 *     summary: Create child profile
 *     security:
 *       - bearerAuth: []
 *   get:
 *     tags: [Children]
 *     summary: List child profiles
 *     security:
 *       - bearerAuth: []
 */
app.post('/api/children', auth, async (req, res) => {
  try {
    await ensureChildGuides();

    const { childName, ageYears, gender } = req.body;

    if (!childName || ageYears === undefined || ageYears === null || !gender) {
      return res.status(400).json({ message: 'childName, ageYears, gender are required' });
    }

    const age = Number(ageYears);
    if (Number.isNaN(age) || age < 0 || age > 18) {
      return res.status(400).json({ message: 'ageYears must be between 0 and 18' });
    }

    if (!['male', 'female', 'other'].includes(String(gender))) {
      return res.status(400).json({ message: 'gender must be male/female/other' });
    }

    const child = await ChildProfile.create({
      userId: req.user.userId,
      childName: String(childName).trim(),
      ageYears: age,
      gender: String(gender),
    });

    const guide = await ChildGuide.findOne({
      ageMin: { $lte: child.ageYears },
      ageMax: { $gte: child.ageYears },
    }).sort({ lastUpdatedAt: -1 });

    return res.status(201).json({
      message: 'Child profile created',
      child,
      guide: guide || null,
      disclaimer:
        'محتوى توعوي عام حسب العمر ولا يغني عن استشارة طبيب أطفال، خاصة عند وجود أعراض شديدة أو مستمرة.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});


app.get('/api/children', auth, async (req, res) => {
  const items = await ChildProfile.find({ userId: req.user.userId }).sort({ createdAt: -1 });
  return res.json({ count: items.length, items });
});
/**
 * @swagger
 * /api/children/{id}:
 *   get:
 *     tags: [Children]
 *     summary: Get child profile by id
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/children/:id', auth, async (req, res) => {
  const child = await ChildProfile.findOne({ _id: req.params.id, userId: req.user.userId });
  if (!child) return res.status(404).json({ message: 'Child not found' });
  return res.json({ child });
});

// Return guide for a child based on age
/**
 * @swagger
 * /api/children/{id}/guide:
 *   get:
 *     tags: [Children]
 *     summary: Get child guide by age
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/children/:id/guide', auth, async (req, res) => {
  const child = await ChildProfile.findOne({ _id: req.params.id, userId: req.user.userId });
  if (!child) return res.status(404).json({ message: 'Child not found' });

  const guide = await ChildGuide.findOne({
    ageMin: { $lte: child.ageYears },
    ageMax: { $gte: child.ageYears },
  }).sort({ lastUpdatedAt: -1 });

  if (!guide) {
    return res.status(404).json({ message: 'No guide found for this age range' });
  }

  return res.json({
    child: { id: child._id, name: child.childName, ageYears: child.ageYears, gender: child.gender },
    guide,
    disclaimer:
      'محتوى توعوي عام حسب العمر ولا يغني عن استشارة طبيب أطفال، خاصة عند وجود أعراض شديدة أو مستمرة.',
  });
});

// ---------- GUIDES (Seed / Manage) ----------
// للبساطة: endpoint لتعبئة بيانات guides (احميه بتوكن عادي؛ لاحقًا نضيف Admin)

/**
 * @swagger
 * /api/guides/seed:
 *   post:
 *     tags: [Guides]
 *     summary: Seed age guides (optional clear=1)
 *     security:
 *       - bearerAuth: []
 */
app.post('/api/guides/seed', auth, async (req, res) => {
  try {
    // optional: clear existing guides if ?clear=1
    if (req.query.clear === '1') {
      await ChildGuide.deleteMany({});
    }

    const sample = [
      {
        ageMin: 0,
        ageMax: 2,
        title: '0-2 سنوات: مؤشرات شائعة ونصائح وقائية',
        commonConditions: [
          {
            name: 'نزلات البرد',
            symptoms: ['سيلان أنف', 'سعال خفيف', 'حرارة بسيطة'],
            redFlags: ['صعوبة تنفس', 'خمول شديد', 'رفض الرضاعة/الأكل'],
            prevention: ['غسل اليدين', 'تجنب المخالطة عند المرض', 'ترطيب الجو'],
            images: ['https://dummyimage.com/600x400&text=Cold+0-2'],
          },
          {
            name: 'جفاف',
            symptoms: ['قلة بلل الحفاض', 'جفاف الفم', 'بكاء بدون دموع'],
            redFlags: ['خمول', 'قلة استجابة', 'قيء مستمر'],
            prevention: ['سوائل كافية', 'مراقبة البلل', 'مراجعة الطبيب عند الشك'],
            images: ['https://dummyimage.com/600x400&text=Dehydration+0-2'],
          },
        ],
      },
      {
        ageMin: 3,
        ageMax: 6,
        title: '3-6 سنوات: صحة المدرسة والوقاية',
        commonConditions: [
          {
            name: 'التهاب حلق',
            symptoms: ['ألم حلق', 'حرارة', 'صعوبة بلع'],
            redFlags: ['حرارة عالية مستمرة', 'طفح جلدي', 'صعوبة تنفس'],
            prevention: ['تجنب مشاركة الأدوات', 'غسل اليدين', 'تغذية جيدة'],
            images: ['https://dummyimage.com/600x400&text=Throat+3-6'],
          },
        ],
      },
      {
        ageMin: 7,
        ageMax: 12,
        title: '7-12 سنة: نشاط بدني وغذاء',
        commonConditions: [
          {
            name: 'حساسية موسمية',
            symptoms: ['عطاس', 'حكة عين', 'سيلان أنف'],
            redFlags: ['صفير/ضيق نفس', 'تورم شديد', 'إغماء'],
            prevention: ['تجنب المحفزات', 'تهوية مناسبة', 'متابعة الطبيب عند التفاقم'],
            images: ['https://dummyimage.com/600x400&text=Allergy+7-12'],
          },
        ],
      },
      {
        ageMin: 13,
        ageMax: 18,
        title: '13-18 سنة: المراهقة والصحة العامة',
        commonConditions: [
          {
            name: 'حب الشباب',
            symptoms: ['بثور', 'التهاب جلد', 'آثار'],
            redFlags: ['التهاب شديد/قيح', 'ألم شديد', 'تأثير نفسي واضح'],
            prevention: ['روتين تنظيف لطيف', 'عدم العبث بالبثور', 'استشارة طبيب جلدية عند الشدة'],
            images: ['https://dummyimage.com/600x400&text=Acne+13-18'],
          },
        ],
      },
    ];

    const inserted = await ChildGuide.insertMany(sample);
    return res.status(201).json({ message: 'Guides seeded', count: inserted.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});
/**
 * @swagger
 * /api/guides:
 *   get:
 *     tags: [Guides]
 *     summary: List all guides
 *     security:
 *       - bearerAuth: []
 */
app.get('/api/guides', auth, async (req, res) => {
  const items = await ChildGuide.find({}).sort({ ageMin: 1, ageMax: 1 });
  return res.json({ count: items.length, items });
});

// =====================
// Start
// =====================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
