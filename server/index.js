import cookieParser from 'cookie-parser'
import express from 'express'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const indexHtml = path.join(distDir, 'index.html')
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data')
const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, 'uploads')
const dbPath = path.join(dataDir, 'data.json')

const PORT = Number(process.env.PORT || 3000)
const INITIAL_PASSWORD = '123456'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const COOKIE_NAME = 'scoring_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

let db
let writeQueue = Promise.resolve()

const nowIso = () => new Date().toISOString()
const uid = prefix => `${prefix}-${crypto.randomUUID()}`

const hashPassword = async password => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString('hex'))
    })
  })
  return `${salt}:${derived}`
}

const verifyPassword = async (password, storedHash) => {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, expected] = storedHash.split(':')
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString('hex'))
    })
  })
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
}

const makeInviteCode = () => {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase()
  return `SR-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

const roundScore = value => Math.round(value * 10) / 10
const clampScore = (value, max) => Math.max(0, Math.min(Number.isFinite(value) ? value : 0, max))

const makeApplicationNo = store => {
  const year = store.settings.academicYear.match(/\d{4}/)?.[0] || new Date().getFullYear().toString()
  const sequence = store.applications.reduce((max, application) => {
    const match = application.applicationNo?.match(/(\d+)$/)
    return Math.max(max, match ? Number(match[1]) : 0)
  }, 0) + 1
  return `SQ-${year}-${String(sequence).padStart(4, '0')}`
}

const seedStudents = [
  ['stu-1', '张三', '2021001', '第一项目组', '运营支持', 'A批次', 93, 94, 88, 82, 0, false, 120, 'inactive', true],
  ['stu-2', '李四', '2021002', '第一项目组', '技术支持', 'A批次', 89, 91, 92, 85, 0, false, 86, 'active', false],
  ['stu-3', '王五', '2021003', '第二项目组', '数据分析', 'A批次', 91, 92, 76, 90, 1, false, 64, 'active', false],
  ['stu-4', '赵六', '2021004', '第一项目组', '运营支持', 'A批次', 84, 85, 90, 78, 0, true, 100, 'inactive', true],
  ['stu-5', '钱七', '2022001', '第二项目组', '智能应用', 'B批次', 96, 98, 95, 88, 0, false, 150, 'active', false],
  ['stu-6', '孙八', '2022002', '第二项目组', '数据分析', 'B批次', 83, 88, 82, 75, 0, false, 45, 'locked', true],
]

const seedCategories = [
  { id: 'cat-competition', name: '竞赛与评比成果', defaultScore: 6, maxScore: 10, description: '竞赛、评比、评选活动中取得的成果证明。', active: true },
  { id: 'cat-research', name: '项目与成果证明', defaultScore: 8, maxScore: 12, description: '项目结项、成果发布、专利软著等证明材料。', active: true },
  { id: 'cat-volunteer', name: '服务与贡献记录', defaultScore: 3, maxScore: 6, description: '服务时长、活动贡献、协作支持等证明材料。', active: true },
  { id: 'cat-honor', name: '荣誉与表彰', defaultScore: 4, maxScore: 8, description: '个人荣誉、团队表彰、优秀成员等证明。', active: true },
]

const seedBatches = [
  {
    id: 'batch-main',
    name: '默认申报批次',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    description: '用于当前评分周期的综合加分项申报。',
    active: true,
  },
  {
    id: 'batch-scholarship',
    name: '专项奖学金申报',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    description: '用于专项奖学金相关证明材料申报，可按实际时间启用。',
    active: false,
  },
]

const seedApplications = [
  {
    id: 'app-1',
    applicationNo: 'SQ-2026-0001',
    studentId: '2021001',
    batchId: 'batch-main',
    categoryId: 'cat-competition',
    title: '年度技能评比二等奖',
    description: '参加年度技能评比，获得二等奖。',
    requestedScore: 6,
    approvedScore: 6,
    status: 'approved',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-1-submit', action: 'submitted', actorName: '张三', comment: '提交申报材料', score: 6, createdAt: '2026-07-20T09:30:00.000Z' },
      { id: 'log-app-1-review', action: 'approved', actorName: '审核管理员', comment: '证书信息完整，按规则认定。', score: 6, createdAt: '2026-07-21T15:10:00.000Z' },
    ],
    submittedAt: '2026-07-20T09:30:00.000Z',
    reviewedAt: '2026-07-21T15:10:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '证书信息完整，按规则认定。',
  },
  {
    id: 'app-2',
    applicationNo: 'SQ-2026-0002',
    studentId: '2022001',
    batchId: 'batch-main',
    categoryId: 'cat-research',
    title: '重点项目结项优秀',
    description: '参与重点项目并完成结项，验收结果优秀。',
    requestedScore: 8,
    approvedScore: 8,
    status: 'approved',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-2-submit', action: 'submitted', actorName: '钱七', comment: '提交申报材料', score: 8, createdAt: '2026-07-22T11:00:00.000Z' },
      { id: 'log-app-2-review', action: 'approved', actorName: '审核管理员', comment: '材料有效。', score: 8, createdAt: '2026-07-23T10:20:00.000Z' },
    ],
    submittedAt: '2026-07-22T11:00:00.000Z',
    reviewedAt: '2026-07-23T10:20:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '材料有效。',
  },
  {
    id: 'app-3',
    applicationNo: 'SQ-2026-0003',
    studentId: '2021002',
    batchId: 'batch-main',
    categoryId: 'cat-volunteer',
    title: '专项服务支持',
    description: '累计参与专项服务支持 42 小时。',
    requestedScore: 3,
    approvedScore: 0,
    status: 'pending',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-3-submit', action: 'submitted', actorName: '李四', comment: '提交申报材料', score: 3, createdAt: '2026-07-24T13:45:00.000Z' },
    ],
    submittedAt: '2026-07-24T13:45:00.000Z',
  },
]

const cloneJson = value => JSON.parse(JSON.stringify(value))

const createSeedData = async () => ({
  students: await Promise.all(seedStudents.map(async row => {
    const [id, name, studentId, department, major, grade, academicScore, moralScore, practiceScore, sportsScore, failedCourses, hasPunishment, volunteerHours, accountStatus, mustChangePassword] = row
    return {
      id,
      name,
      studentId,
      department,
      major,
      grade,
      academicScore,
      moralScore,
      practiceScore,
      sportsScore,
      failedCourses,
      hasPunishment,
      volunteerHours,
      accountStatus,
      passwordHash: await hashPassword(INITIAL_PASSWORD),
      mustChangePassword,
      inviteCode: accountStatus === 'inactive' ? makeInviteCode() : undefined,
      activatedAt: accountStatus === 'active' ? '2026-07-18T09:00:00.000Z' : undefined,
      lastLoginAt: accountStatus === 'active' ? '2026-07-24T10:12:00.000Z' : undefined,
    }
  })),
  batches: cloneJson(seedBatches),
  categories: cloneJson(seedCategories),
  applications: cloneJson(seedApplications),
  settings: {
    academicYear: '2025-2026 评分周期',
    submissionDeadline: '2026-08-31',
    weights: {
      academic: 60,
      moral: 15,
      practice: 15,
      sports: 10,
      bonusCap: 20,
    },
  },
  sessions: [],
})

const migrateDb = async source => {
  const next = {
    students: Array.isArray(source.students) ? source.students : [],
    batches: Array.isArray(source.batches) ? source.batches : seedBatches,
    categories: Array.isArray(source.categories) ? source.categories : seedCategories,
    applications: Array.isArray(source.applications) ? source.applications : [],
    settings: source.settings || (await createSeedData()).settings,
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
  }

  next.students = await Promise.all(next.students.map(async student => ({
    ...student,
    id: student.id || uid('stu'),
    accountStatus: student.accountStatus || 'inactive',
    passwordHash: student.passwordHash || await hashPassword(student.password || INITIAL_PASSWORD),
    password: undefined,
    mustChangePassword: student.mustChangePassword ?? student.accountStatus !== 'active',
    inviteCode: student.accountStatus === 'inactive' ? (student.inviteCode || makeInviteCode()) : student.inviteCode,
  })))

  next.applications = next.applications.map((application, index) => ({
    ...application,
    id: application.id || uid('app'),
    batchId: application.batchId || next.batches[0]?.id,
    applicationNo: application.applicationNo || `SQ-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
    reviewLogs: Array.isArray(application.reviewLogs) ? application.reviewLogs : [],
    attachments: Array.isArray(application.attachments) ? application.attachments : [],
  }))

  next.sessions = next.sessions.filter(session => new Date(session.expiresAt).getTime() > Date.now())
  return next
}

const ensureDb = async () => {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.mkdir(uploadDir, { recursive: true })
  if (!existsSync(dbPath)) {
    db = await createSeedData()
    await saveDb()
    return
  }

  try {
    const raw = await fs.readFile(dbPath, 'utf8')
    db = await migrateDb(JSON.parse(raw))
    await saveDb()
  } catch (error) {
    console.error('数据文件读取失败，已创建新的初始化数据。', error)
    db = await createSeedData()
    await saveDb()
  }
}

const saveDb = async () => {
  const task = async () => {
    await fs.mkdir(dataDir, { recursive: true })
    const tmpPath = `${dbPath}.tmp`
    await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf8')
    await fs.rename(tmpPath, dbPath)
  }
  writeQueue = writeQueue.then(task, task)
  await writeQueue
}

const publicStudent = (student, viewer) => {
  const { passwordHash, password, ...rest } = student
  return {
    ...rest,
    password: '',
    inviteCode: viewer?.role === 'admin' ? rest.inviteCode : undefined,
  }
}

const publicState = viewer => ({
  students: db.students.map(student => publicStudent(student, viewer)),
  batches: db.batches,
  categories: db.categories,
  applications: db.applications,
  settings: db.settings,
})

const calculateBaseScore = student => {
  const { weights } = db.settings
  return roundScore(
    student.academicScore * (weights.academic / 100) +
    student.moralScore * (weights.moral / 100) +
    student.practiceScore * (weights.practice / 100) +
    student.sportsScore * (weights.sports / 100),
  )
}

const getCurrentUser = req => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return null
  const session = db.sessions.find(item => item.id === token)
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null

  if (session.role === 'admin') {
    return { id: 'admin', role: 'admin', name: '审核管理员', username: ADMIN_USERNAME }
  }

  const student = db.students.find(item => item.id === session.userId)
  if (!student || student.accountStatus === 'locked') return null
  return {
    id: student.id,
    role: 'student',
    name: student.name,
    username: student.studentId,
    studentId: student.studentId,
    mustChangePassword: student.mustChangePassword,
  }
}

const createSession = async (res, user) => {
  const session = {
    id: crypto.randomBytes(32).toString('hex'),
    role: user.role,
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  }
  db.sessions = db.sessions.filter(item => new Date(item.expiresAt).getTime() > Date.now())
  db.sessions.push(session)
  await saveDb()
  res.cookie(COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_TTL_MS,
  })
}

const clearSession = async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (token) {
    db.sessions = db.sessions.filter(session => session.id !== token)
    await saveDb()
  }
  res.clearCookie(COOKIE_NAME)
}

const requireAuth = (req, res, next) => {
  const user = getCurrentUser(req)
  if (!user) {
    res.status(401).json({ ok: false, message: '请先登录' })
    return
  }
  req.currentUser = user
  next()
}

const requireAdmin = (req, res, next) => {
  if (req.currentUser?.role !== 'admin') {
    res.status(403).json({ ok: false, message: '没有审核端权限' })
    return
  }
  next()
}

const apiOk = (req, res, message = '操作成功') => {
  const currentUser = req.currentUser || getCurrentUser(req)
  res.json({ ok: true, message, currentUser, state: publicState(currentUser) })
}

const safeFilename = value => String(value || 'material').replace(/[^\w.-]+/g, '-').slice(0, 80)

const extensionFor = attachment => {
  const fromName = path.extname(attachment.name || '').replace('.', '').toLowerCase()
  if (fromName) return fromName
  if (attachment.type === 'image/png') return 'png'
  if (attachment.type === 'image/webp') return 'webp'
  if (attachment.type === 'image/svg+xml') return 'svg'
  return 'jpg'
}

const persistAttachment = async attachment => {
  if (!attachment?.dataUrl || attachment.dataUrl.startsWith('/uploads/') || attachment.dataUrl.startsWith('http')) return attachment

  const fileId = uid('att')
  const ext = extensionFor(attachment)
  const fileName = `${fileId}-${safeFilename(attachment.name)}.${ext}`
  const filePath = path.join(uploadDir, fileName)
  let buffer

  const base64Match = attachment.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (base64Match) {
    buffer = Buffer.from(base64Match[2], 'base64')
  } else {
    const utf8Match = attachment.dataUrl.match(/^data:([^;]+);utf8,(.+)$/)
    if (!utf8Match) throw new Error('图片数据格式不正确')
    buffer = Buffer.from(decodeURIComponent(utf8Match[2]), 'utf8')
  }

  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过 5MB')
  await fs.writeFile(filePath, buffer)
  return {
    ...attachment,
    id: attachment.id || fileId,
    dataUrl: `/uploads/${fileName}`,
    uploadedAt: attachment.uploadedAt || nowIso(),
  }
}

const persistAttachments = async attachments => Promise.all((attachments || []).map(persistAttachment))

const app = express()
app.set('trust proxy', 1)
app.use(cookieParser())
app.use(express.json({ limit: '30mb' }))
app.use('/uploads', express.static(uploadDir, { maxAge: '30d' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'scoring-system', time: nowIso() })
})

app.get('/api/auth/me', (req, res) => {
  const currentUser = getCurrentUser(req)
  res.json({ ok: true, currentUser, state: currentUser ? publicState(currentUser) : null })
})

app.post('/api/auth/login', async (req, res) => {
  const role = req.body?.role
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')

  if (role === 'admin') {
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      res.status(401).json({ ok: false, message: '管理员账号或密码不正确' })
      return
    }
    const user = { id: 'admin', role: 'admin', name: '审核管理员', username: ADMIN_USERNAME }
    await createSession(res, user)
    req.currentUser = user
    apiOk(req, res, '登录成功')
    return
  }

  const student = db.students.find(item => item.studentId === username)
  if (!student) {
    res.status(401).json({ ok: false, message: '未找到该用户编号' })
    return
  }
  if (student.accountStatus === 'locked') {
    res.status(423).json({ ok: false, message: '该账号已锁定，请联系管理员' })
    return
  }
  if (student.accountStatus === 'inactive') {
    res.status(403).json({ ok: false, message: '账号尚未激活，请使用邀请码完成激活' })
    return
  }
  if (!await verifyPassword(password, student.passwordHash)) {
    res.status(401).json({ ok: false, message: '用户编号或密码不正确' })
    return
  }

  student.lastLoginAt = nowIso()
  const user = {
    id: student.id,
    role: 'student',
    name: student.name,
    username: student.studentId,
    studentId: student.studentId,
    mustChangePassword: student.mustChangePassword,
  }
  await createSession(res, user)
  req.currentUser = user
  await saveDb()
  apiOk(req, res, student.mustChangePassword ? '首次登录需要修改密码' : '登录成功')
})

app.post('/api/auth/activate', async (req, res) => {
  const studentId = String(req.body?.studentId || '').trim()
  const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase()
  const password = String(req.body?.password || '')
  const student = db.students.find(item => item.studentId === studentId)

  if (!student) {
    res.status(404).json({ ok: false, message: '未找到该用户编号' })
    return
  }
  if (student.accountStatus === 'locked') {
    res.status(423).json({ ok: false, message: '该账号已锁定，请联系管理员' })
    return
  }
  if (student.accountStatus === 'active') {
    res.status(409).json({ ok: false, message: '该账号已激活，请直接登录' })
    return
  }
  if (!student.inviteCode || inviteCode !== String(student.inviteCode).toUpperCase()) {
    res.status(401).json({ ok: false, message: '邀请码不正确或已失效' })
    return
  }
  if (password.length < 6 || password === INITIAL_PASSWORD) {
    res.status(400).json({ ok: false, message: '新密码至少 6 位，且不能继续使用初始密码 123456' })
    return
  }

  const time = nowIso()
  student.passwordHash = await hashPassword(password)
  student.accountStatus = 'active'
  student.mustChangePassword = false
  student.activatedAt = time
  student.lastLoginAt = time
  student.inviteUsedAt = time
  student.inviteCode = undefined

  const user = {
    id: student.id,
    role: 'student',
    name: student.name,
    username: student.studentId,
    studentId: student.studentId,
    mustChangePassword: false,
  }
  await createSession(res, user)
  req.currentUser = user
  await saveDb()
  apiOk(req, res, '账号已激活，登录成功')
})

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await clearSession(req, res)
  res.json({ ok: true, message: '已退出登录' })
})

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  if (req.currentUser.role !== 'student') {
    res.status(400).json({ ok: false, message: '管理员账号不需要在此修改密码' })
    return
  }

  const oldPassword = String(req.body?.oldPassword || '')
  const newPassword = String(req.body?.newPassword || '')
  const student = db.students.find(item => item.studentId === req.currentUser.studentId)

  if (!student || !await verifyPassword(oldPassword, student.passwordHash)) {
    res.status(400).json({ ok: false, message: '原密码不正确' })
    return
  }
  if (newPassword.length < 6 || newPassword === INITIAL_PASSWORD || newPassword === oldPassword) {
    res.status(400).json({ ok: false, message: '新密码至少 6 位，不能与原密码或初始密码相同' })
    return
  }

  student.passwordHash = await hashPassword(newPassword)
  student.accountStatus = 'active'
  student.mustChangePassword = false
  student.activatedAt = student.activatedAt || nowIso()
  student.lastLoginAt = nowIso()
  await saveDb()
  req.currentUser = { ...req.currentUser, mustChangePassword: false }
  apiOk(req, res, '密码已修改，账号已激活')
})

app.get('/api/state', requireAuth, (req, res) => {
  apiOk(req, res)
})

app.post('/api/students', requireAuth, requireAdmin, async (req, res) => {
  const student = req.body?.student || {}
  if (!String(student.name || '').trim() || !String(student.studentId || '').trim()) {
    res.status(400).json({ ok: false, message: '姓名和用户编号不能为空' })
    return
  }
  if (db.students.some(item => item.studentId === student.studentId)) {
    res.status(409).json({ ok: false, message: '用户编号已存在' })
    return
  }
  db.students.push({
    id: student.id || uid('stu'),
    name: String(student.name).trim(),
    studentId: String(student.studentId).trim(),
    department: String(student.department || ''),
    major: String(student.major || ''),
    grade: String(student.grade || ''),
    academicScore: Number(student.academicScore) || 0,
    moralScore: Number(student.moralScore) || 0,
    practiceScore: Number(student.practiceScore) || 0,
    sportsScore: Number(student.sportsScore) || 0,
    failedCourses: Number(student.failedCourses) || 0,
    hasPunishment: Boolean(student.hasPunishment),
    volunteerHours: Number(student.volunteerHours) || 0,
    accountStatus: student.accountStatus || 'inactive',
    passwordHash: await hashPassword(student.password || INITIAL_PASSWORD),
    mustChangePassword: student.mustChangePassword ?? true,
    inviteCode: student.accountStatus === 'active' ? undefined : makeInviteCode(),
  })
  await saveDb()
  apiOk(req, res, '用户已新增')
})

app.put('/api/students/:id', requireAuth, requireAdmin, async (req, res) => {
  const index = db.students.findIndex(item => item.id === req.params.id)
  if (index < 0) {
    res.status(404).json({ ok: false, message: '未找到用户' })
    return
  }
  const student = req.body?.student || {}
  if (db.students.some(item => item.id !== req.params.id && item.studentId === student.studentId)) {
    res.status(409).json({ ok: false, message: '用户编号已存在' })
    return
  }
  db.students[index] = {
    ...db.students[index],
    ...student,
    id: req.params.id,
    passwordHash: db.students[index].passwordHash,
    password: undefined,
    inviteCode: student.accountStatus === 'inactive' ? (db.students[index].inviteCode || makeInviteCode()) : db.students[index].inviteCode,
  }
  await saveDb()
  apiOk(req, res, '用户信息已保存')
})

app.delete('/api/students/:id', requireAuth, requireAdmin, async (req, res) => {
  const student = db.students.find(item => item.id === req.params.id)
  db.students = db.students.filter(item => item.id !== req.params.id)
  if (student) db.applications = db.applications.filter(application => application.studentId !== student.studentId)
  await saveDb()
  apiOk(req, res, '用户已删除')
})

app.post('/api/students/import', requireAuth, requireAdmin, async (req, res) => {
  const students = Array.isArray(req.body?.students) ? req.body.students : []
  const byStudentId = new Map(db.students.map(student => [student.studentId, student]))
  for (const student of students) {
    const studentId = String(student.studentId || '').trim()
    const name = String(student.name || '').trim()
    if (!studentId || !name) continue
    const existing = byStudentId.get(studentId)
    if (existing) {
      Object.assign(existing, {
        name,
        department: String(student.department || ''),
        major: String(student.major || ''),
        grade: String(student.grade || ''),
        academicScore: Number(student.academicScore) || 0,
        moralScore: Number(student.moralScore) || 0,
        practiceScore: Number(student.practiceScore) || 0,
        sportsScore: Number(student.sportsScore) || 0,
        failedCourses: Number(student.failedCourses) || 0,
        hasPunishment: Boolean(student.hasPunishment),
        volunteerHours: Number(student.volunteerHours) || 0,
      })
    } else {
      db.students.push({
        ...student,
        id: student.id || uid('stu'),
        name,
        studentId,
        accountStatus: 'inactive',
        passwordHash: await hashPassword(INITIAL_PASSWORD),
        password: undefined,
        mustChangePassword: true,
        inviteCode: makeInviteCode(),
      })
    }
  }
  await saveDb()
  apiOk(req, res, `已导入或更新 ${students.length} 名用户`)
})

app.post('/api/students/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const student = db.students.find(item => item.id === req.params.id)
  if (!student) {
    res.status(404).json({ ok: false, message: '未找到用户' })
    return
  }
  student.passwordHash = await hashPassword(INITIAL_PASSWORD)
  student.accountStatus = 'inactive'
  student.mustChangePassword = true
  student.activatedAt = undefined
  student.inviteCode = makeInviteCode()
  await saveDb()
  apiOk(req, res, '密码已重置，并已生成新的邀请码')
})

app.patch('/api/students/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const student = db.students.find(item => item.id === req.params.id)
  if (!student) {
    res.status(404).json({ ok: false, message: '未找到用户' })
    return
  }
  student.accountStatus = req.body?.status
  if (student.accountStatus !== 'active') {
    student.mustChangePassword = true
    student.inviteCode = student.inviteCode || makeInviteCode()
  }
  await saveDb()
  apiOk(req, res, '账号状态已更新')
})

app.post('/api/batches', requireAuth, requireAdmin, async (req, res) => {
  const batch = req.body?.batch || {}
  if (!String(batch.name || '').trim()) {
    res.status(400).json({ ok: false, message: '批次名称不能为空' })
    return
  }
  db.batches.push({
    id: batch.id || uid('batch'),
    name: String(batch.name).trim(),
    startDate: String(batch.startDate || ''),
    endDate: String(batch.endDate || ''),
    description: String(batch.description || ''),
    active: Boolean(batch.active),
  })
  await saveDb()
  apiOk(req, res, '申报批次已新增')
})

app.put('/api/batches/:id', requireAuth, requireAdmin, async (req, res) => {
  const index = db.batches.findIndex(batch => batch.id === req.params.id)
  if (index < 0) {
    res.status(404).json({ ok: false, message: '未找到申报批次' })
    return
  }
  const batch = req.body?.batch || {}
  db.batches[index] = {
    ...db.batches[index],
    ...batch,
    id: req.params.id,
    name: String(batch.name || db.batches[index].name).trim(),
    startDate: String(batch.startDate || ''),
    endDate: String(batch.endDate || ''),
    description: String(batch.description || ''),
    active: Boolean(batch.active),
  }
  await saveDb()
  apiOk(req, res, '申报批次已保存')
})

app.delete('/api/batches/:id', requireAuth, requireAdmin, async (req, res) => {
  if (db.applications.some(application => application.batchId === req.params.id)) {
    db.batches = db.batches.map(batch => batch.id === req.params.id ? { ...batch, active: false } : batch)
    await saveDb()
    apiOk(req, res, '该批次已有申报记录，已自动停用')
    return
  }
  db.batches = db.batches.filter(batch => batch.id !== req.params.id)
  await saveDb()
  apiOk(req, res, '申报批次已删除')
})

app.post('/api/categories', requireAuth, requireAdmin, async (req, res) => {
  db.categories.push({ ...req.body?.category, id: req.body?.category?.id || uid('cat') })
  await saveDb()
  apiOk(req, res, '加分类型已新增')
})

app.put('/api/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  db.categories = db.categories.map(category => category.id === req.params.id ? { ...req.body?.category, id: req.params.id } : category)
  await saveDb()
  apiOk(req, res, '加分类型已保存')
})

app.delete('/api/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  db.categories = db.categories.filter(category => category.id !== req.params.id)
  await saveDb()
  apiOk(req, res, '加分类型已删除')
})

app.put('/api/settings', requireAuth, requireAdmin, async (req, res) => {
  db.settings = req.body?.settings
  await saveDb()
  apiOk(req, res, '评分规则已保存')
})

app.post('/api/applications', requireAuth, async (req, res) => {
  if (req.currentUser.role !== 'student') {
    res.status(403).json({ ok: false, message: '只有用户端可以提交申报' })
    return
  }
  const input = req.body?.application || {}
  if (input.studentId !== req.currentUser.studentId) {
    res.status(403).json({ ok: false, message: '不能代替其他用户提交申报' })
    return
  }
  const student = db.students.find(item => item.studentId === input.studentId)
  const activeBatches = db.batches.filter(item => item.active)
  const batch = activeBatches.find(item => item.id === input.batchId) || activeBatches[0]
  const category = db.categories.find(item => item.id === input.categoryId && item.active)
  if (!student || !category || !batch) {
    res.status(400).json({ ok: false, message: '用户、申报批次或加分类型不存在' })
    return
  }
  const requestedScore = clampScore(Number(input.requestedScore), category.maxScore)
  const time = nowIso()
  const application = {
    id: uid('app'),
    applicationNo: makeApplicationNo(db),
    studentId: student.studentId,
    batchId: batch.id,
    categoryId: category.id,
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    requestedScore,
    approvedScore: 0,
    status: 'pending',
    attachments: await persistAttachments(input.attachments),
    reviewLogs: [
      { id: uid('log'), action: 'submitted', actorName: student.name, comment: '提交申报材料', score: requestedScore, createdAt: time },
    ],
    submittedAt: time,
  }
  if (!application.title || !application.attachments.length) {
    res.status(400).json({ ok: false, message: '请补全项目名称并上传证明图片' })
    return
  }
  db.applications.unshift(application)
  await saveDb()
  apiOk(req, res, '申报已提交，等待审核')
})

app.delete('/api/applications/:id', requireAuth, async (req, res) => {
  const application = db.applications.find(item => item.id === req.params.id)
  if (!application) {
    res.status(404).json({ ok: false, message: '未找到申报记录' })
    return
  }
  if (req.currentUser.role === 'student' && application.studentId !== req.currentUser.studentId) {
    res.status(403).json({ ok: false, message: '不能删除其他用户的申报' })
    return
  }
  if (req.currentUser.role === 'student' && application.status === 'approved') {
    res.status(400).json({ ok: false, message: '已通过的申报不能删除' })
    return
  }
  db.applications = db.applications.filter(item => item.id !== req.params.id)
  await saveDb()
  apiOk(req, res, '申报已删除')
})

app.post('/api/applications/:id/review', requireAuth, requireAdmin, async (req, res) => {
  const application = db.applications.find(item => item.id === req.params.id)
  if (!application) {
    res.status(404).json({ ok: false, message: '未找到申报记录' })
    return
  }
  const status = req.body?.status === 'approved' ? 'approved' : 'rejected'
  const category = db.categories.find(item => item.id === application.categoryId)
  const approvedScore = status === 'approved' ? clampScore(Number(req.body?.approvedScore), category?.maxScore || db.settings.weights.bonusCap) : 0
  const comment = String(req.body?.comment || '').trim()
  const time = nowIso()
  application.status = status
  application.approvedScore = approvedScore
  application.reviewedAt = time
  application.reviewerName = req.currentUser.name
  application.reviewComment = comment
  application.reviewLogs = [
    ...application.reviewLogs,
    { id: uid('log'), action: status, actorName: req.currentUser.name, comment: comment || (status === 'approved' ? '审核通过' : '审核驳回'), score: approvedScore, createdAt: time },
  ]
  await saveDb()
  apiOk(req, res, status === 'approved' ? '申报已通过' : '申报已驳回')
})

app.get('/api/export', requireAuth, requireAdmin, (_req, res) => {
  const payload = {
    students: db.students,
    batches: db.batches,
    categories: db.categories,
    applications: db.applications,
    settings: db.settings,
  }
  res.setHeader('Content-Type', 'application/json;charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="scoring-system-backup-${new Date().toISOString().slice(0, 10)}.json"`)
  res.send(JSON.stringify(payload, null, 2))
})

app.post('/api/import-json', requireAuth, requireAdmin, async (req, res) => {
  const raw = String(req.body?.raw || '')
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.students) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.applications) || !parsed.settings) {
      res.status(400).json({ ok: false, message: '备份文件格式不正确' })
      return
    }
    const sessions = db.sessions
    db = await migrateDb({ ...parsed, sessions })
    await saveDb()
    apiOk(req, res, '数据已恢复')
  } catch {
    res.status(400).json({ ok: false, message: '备份文件解析失败' })
  }
})

app.post('/api/reset-demo', requireAuth, requireAdmin, async (req, res) => {
  const sessions = db.sessions
  db = await createSeedData()
  db.sessions = sessions
  await saveDb()
  apiOk(req, res, '已恢复演示数据')
})

app.get('/api/rankings', requireAuth, (req, res) => {
  const rows = db.students.map(student => {
    const approvedApplications = db.applications.filter(application => application.studentId === student.studentId && application.status === 'approved')
    const bonusScore = roundScore(Math.min(approvedApplications.reduce((sum, application) => sum + application.approvedScore, 0), db.settings.weights.bonusCap))
    const baseScore = calculateBaseScore(student)
    const warnings = []
    if (student.failedCourses > 0) warnings.push(`异常项 ${student.failedCourses} 个`)
    if (student.hasPunishment) warnings.push('存在限制记录')
    return {
      studentId: student.studentId,
      studentName: student.name,
      department: student.department,
      major: student.major,
      grade: student.grade,
      baseScore,
      bonusScore,
      totalScore: roundScore(baseScore + bonusScore),
      rank: 0,
      approvedApplications,
      warnings,
    }
  }).sort((a, b) => b.totalScore - a.totalScore || b.baseScore - a.baseScore || a.studentId.localeCompare(b.studentId))
  let lastScore = null
  let lastRank = 0
  res.json(rows.map((row, index) => {
    if (lastScore === null || row.totalScore < lastScore) {
      lastRank = index + 1
      lastScore = row.totalScore
    }
    return { ...row, rank: lastRank }
  }))
})

if (existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '1h' }))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next()
      return
    }
    res.sendFile(indexHtml)
  })
}

await ensureDb()

app.listen(PORT, () => {
  console.log(`评分系统服务已启动：http://127.0.0.1:${PORT}`)
  console.log(`数据目录：${dataDir}`)
})
