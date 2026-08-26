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

const roundScore = value => Math.round(value * 100) / 100
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
  ['stu-1', '张老师', 'JS2026001', '石马镇中心小学', '语文', '中级首聘', 0, 0, 0, 0, 0, false, 0, 'inactive', true],
  ['stu-2', '李老师', 'JS2026002', '石马镇中心小学', '数学', '高级首聘', 0, 0, 0, 0, 0, false, 0, 'active', false],
  ['stu-3', '王老师', 'JS2026003', '石马镇第二小学', '英语', '层级内晋升', 0, 0, 0, 0, 1, false, 0, 'active', false],
  ['stu-4', '陈老师', 'JS2026004', '石马镇第三小学', '道德与法治', '中级首聘', 0, 0, 0, 0, 0, true, 0, 'inactive', true],
  ['stu-5', '刘老师', 'JS2026005', '石马镇中心小学', '体育', '高级首聘', 0, 0, 0, 0, 0, false, 0, 'active', false],
  ['stu-6', '赵老师', 'JS2026006', '石马镇第二小学', '科学', '层级内晋升', 0, 0, 0, 0, 0, false, 0, 'locked', true],
]

const seedCategories = [
  {
    id: 'score-work-years',
    group: '资历条件',
    name: '工作年限',
    defaultScore: 0,
    maxScore: 20,
    order: 1,
    description: '教龄每年 0.5 分，工龄每年 0.4 分，教龄和工龄不重复计算，本项最高 20 分。',
    requiredMaterials: '人事档案、任教经历证明、参加工作时间证明等。',
    active: true,
  },
  {
    id: 'score-education',
    group: '资历条件',
    name: '学历',
    defaultScore: 0,
    maxScore: 5,
    order: 2,
    description: '本科及以上 5 分，专科 4 分，中师或中专 3 分；取得学历但未取得相应层次教师资格证计 2 分。',
    requiredMaterials: '毕业证、学位证、教师资格证或学信网证明。',
    active: true,
  },
  {
    id: 'score-assessment',
    group: '资历条件',
    name: '年度、师德考核',
    defaultScore: 0,
    maxScore: 6,
    order: 3,
    description: '近三年年度考核、师德考核优秀各 1 分/次，合格各 0.9 分/次；任一项合格以下不得参评。',
    requiredMaterials: '近三年年度考核和师德考核结果证明。',
    active: true,
  },
  {
    id: 'score-professional-post',
    group: '资历条件',
    name: '专业技术职务',
    defaultScore: 0,
    maxScore: 12,
    order: 4,
    description: '按下一层级或同层级下一职级的任职资格、聘任职务年限分别计 0.5 分/年。',
    requiredMaterials: '任职资格证、聘任文件、岗位聘用材料。',
    active: true,
  },
  {
    id: 'score-duty',
    group: '任职履历',
    name: '任职',
    defaultScore: 0,
    maxScore: 3,
    order: 5,
    description: '近三年任职按岗位计分，校长书记 1 分/学年，副校长副书记 0.8，中层正职 0.6，副职 0.5，其他岗位按细则计分，兼任其他职务减半累计。',
    requiredMaterials: '学校任职文件、聘任通知或岗位工作证明。',
    active: true,
  },
  {
    id: 'score-honor-comprehensive',
    group: '奖励成果',
    name: '奖励：综合奖',
    defaultScore: 0,
    maxScore: 3,
    order: 6,
    description: '国家 3 分，省 2 分，市 1.5 分，县 1 分，乡镇 0.5 分，校级 0.3 分；不同年度可累计。',
    requiredMaterials: '综合荣誉证书、表彰文件或主管部门公示材料。',
    active: true,
  },
  {
    id: 'score-honor-single',
    group: '奖励成果',
    name: '奖励：单项奖',
    defaultScore: 0,
    maxScore: 3,
    order: 7,
    description: '一类单项奖按同级综合奖 1/2 计分，二类单项奖按 1/4 计分；同类别多次多项只计最高。',
    requiredMaterials: '单项获奖证书、推荐或组织文件。',
    active: true,
  },
  {
    id: 'score-business-competition',
    group: '奖励成果',
    name: '个人业务竞赛',
    defaultScore: 0,
    maxScore: 4,
    order: 8,
    description: '优质课、教学能力竞赛等按国家、省、市、县、片区、校级及一二三等奖计分；同一次逐级选拔只计最高。',
    requiredMaterials: '竞赛获奖证书、获奖文件、活动通知或学校推荐材料。',
    active: true,
  },
  {
    id: 'score-guidance',
    group: '奖励成果',
    name: '指导获奖',
    defaultScore: 0,
    maxScore: 2,
    order: 9,
    description: '指导学生学科竞赛、其他竞赛或体育竞赛获奖按级别和等次计分；多人指导按平均分认定。',
    requiredMaterials: '指导教师获奖证书、竞赛结果文件、学生获奖证明。',
    active: true,
  },
  {
    id: 'score-paper-published',
    group: '教科研成果',
    name: '论文发表',
    defaultScore: 0,
    maxScore: 1,
    order: 10,
    description: '省级及以上 1 分，市级 0.4 分；正规 CN/ISSN 期刊需可在知网、万方或维普检索，多人合作按作者排序折算。',
    requiredMaterials: '论文刊物封面目录正文、检索页截图、作者信息页。',
    active: true,
  },
  {
    id: 'score-paper-award',
    group: '教科研成果',
    name: '论文获奖',
    defaultScore: 0,
    maxScore: 1,
    order: 11,
    description: '国家一二三等奖 1/0.8/0.5 分，省 0.8/0.6/0.5 分，市 0.5/0.4/0.3 分，县 0.3/0.2/0.1 分。',
    requiredMaterials: '论文获奖证书、评审单位通知或主管部门文件。',
    active: true,
  },
  {
    id: 'score-news',
    group: '教科研成果',
    name: '新闻报道',
    defaultScore: 0,
    maxScore: 1,
    order: 12,
    description: '国家 1 分，省 0.5 分，市 0.3 分，县 0.2 分；同一内容按最高级别计分。',
    requiredMaterials: '报道链接、截图、刊发平台证明或采用证明。',
    active: true,
  },
  {
    id: 'score-research-topic',
    group: '教科研成果',
    name: '课题研究',
    defaultScore: 0,
    maxScore: 2,
    order: 13,
    description: '结题国家 2 分，省 1.5 分，市 1 分；立项当年按同级 1/3 计分，主持人和参与人按细则比例折算。',
    requiredMaterials: '课题立项书、结题证书、成员名单或主管部门文件。',
    active: true,
  },
  {
    id: 'score-attendance',
    group: '日常履职',
    name: '出勤',
    defaultScore: 0,
    maxScore: 6,
    order: 14,
    description: '满勤 6 分；事假超过 12 天每日扣 0.1 分，病假超过 18 天每日扣 0.05 分，旷会、旷课、旷工按细则扣分。',
    requiredMaterials: '学校考勤统计、请假审批记录或相关说明。',
    active: true,
  },
  {
    id: 'score-workload',
    group: '日常履职',
    name: '工作量',
    defaultScore: 0,
    maxScore: 10,
    order: 15,
    description: '满工作量 8 分；每学期超 1 课时加 0.5 分，最高 10 分；少 1 课时扣 0.5 分，行政人员按细则折算。',
    requiredMaterials: '课表、工作量统计表、岗位分工或任课证明。',
    active: true,
  },
  {
    id: 'score-teaching-process',
    group: '教学质量',
    name: '教育教学工作过程',
    defaultScore: 0,
    maxScore: 3,
    order: 16,
    description: '常规工作满分 3 分，依据教案、听课、监考、检查通报、工作完成情况等加减分。',
    requiredMaterials: '常规检查结果、听课记录、通报表扬或批评材料。',
    active: true,
  },
  {
    id: 'score-teaching-effect',
    group: '教学质量',
    name: '教学效果',
    defaultScore: 0,
    maxScore: 18,
    order: 17,
    description: '教学成绩、毕业班、接班提升、教学示范、工作成果等按细则汇总，本项最高 18 分。',
    requiredMaterials: '质量分析表、成绩排名证明、示范课材料、成果证明。',
    active: true,
  },
]

const seedBatches = [
  {
    id: 'batch-teacher-2026',
    name: '2026 专业技术岗位竞聘',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    description: '用于本轮专业技术岗位竞聘，申报人按 17 个评分项目提交自评分和证明材料。',
    active: true,
  },
  {
    id: 'batch-middle-first',
    name: '中级首聘',
    startDate: '',
    endDate: '',
    description: '中级岗位首次聘任申报入口，可按实际通知时间启用。',
    active: false,
  },
  {
    id: 'batch-senior-first',
    name: '高级首聘',
    startDate: '',
    endDate: '',
    description: '高级岗位首次聘任申报入口，可按实际通知时间启用。',
    active: false,
  },
  {
    id: 'batch-internal-level',
    name: '层级内晋升',
    startDate: '',
    endDate: '',
    description: '同层级内岗位晋升申报入口，可按实际通知时间启用。',
    active: false,
  },
]

const seedApplications = [
  {
    id: 'app-1',
    applicationNo: 'SQ-2026-0001',
    studentId: 'JS2026001',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-work-years',
    title: '教龄与工龄认定',
    description: '1998 年参加工作，申请按教龄年限认定工作年限分。',
    requestedScore: 14,
    approvedScore: 14,
    status: 'approved',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-1-submit', action: 'submitted', actorName: '张老师', comment: '提交申报材料', score: 14, createdAt: '2026-08-20T09:30:00.000Z' },
      { id: 'log-app-1-review', action: 'approved', actorName: '审核管理员', comment: '人事档案时间可核验，按 14 分认定。', score: 14, createdAt: '2026-08-21T15:10:00.000Z' },
    ],
    submittedAt: '2026-08-20T09:30:00.000Z',
    reviewedAt: '2026-08-21T15:10:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '人事档案时间可核验，按 14 分认定。',
  },
  {
    id: 'app-2',
    applicationNo: 'SQ-2026-0002',
    studentId: 'JS2026002',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-education',
    title: '本科学历及教师资格证',
    description: '提交本科毕业证和相应层次教师资格证。',
    requestedScore: 5,
    approvedScore: 5,
    status: 'approved',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-2-submit', action: 'submitted', actorName: '李老师', comment: '提交申报材料', score: 5, createdAt: '2026-08-22T11:00:00.000Z' },
      { id: 'log-app-2-review', action: 'approved', actorName: '审核管理员', comment: '学历与教师资格证一致，认定 5 分。', score: 5, createdAt: '2026-08-23T10:20:00.000Z' },
    ],
    submittedAt: '2026-08-22T11:00:00.000Z',
    reviewedAt: '2026-08-23T10:20:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '学历与教师资格证一致，认定 5 分。',
  },
  {
    id: 'app-3',
    applicationNo: 'SQ-2026-0003',
    studentId: 'JS2026002',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-honor-comprehensive',
    title: '县级优秀教师',
    description: '2025 年获得县级优秀教师，申请综合奖计分。',
    requestedScore: 1,
    approvedScore: 0,
    status: 'pending',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-3-submit', action: 'submitted', actorName: '李老师', comment: '提交申报材料', score: 1, createdAt: '2026-08-24T13:45:00.000Z' },
    ],
    submittedAt: '2026-08-24T13:45:00.000Z',
  },
  {
    id: 'app-4',
    applicationNo: 'SQ-2026-0004',
    studentId: 'JS2026005',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-guidance',
    title: '指导学生体育竞赛获奖',
    description: '指导学生在县级运动会获得名次，申请指导获奖加分。',
    requestedScore: 0.75,
    approvedScore: 0,
    status: 'pending',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-4-submit', action: 'submitted', actorName: '刘老师', comment: '提交申报材料', score: 0.75, createdAt: '2026-08-25T09:20:00.000Z' },
    ],
    submittedAt: '2026-08-25T09:20:00.000Z',
  },
  {
    id: 'app-5',
    applicationNo: 'SQ-2026-0005',
    studentId: 'JS2026003',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-paper-award',
    title: '论文获奖材料',
    description: '提交论文获奖证书截图，待复核是否属于主管部门组织。',
    requestedScore: 0.5,
    approvedScore: 0,
    status: 'rejected',
    attachments: [],
    reviewLogs: [
      { id: 'log-app-5-submit', action: 'submitted', actorName: '王老师', comment: '提交申报材料', score: 0.5, createdAt: '2026-08-20T14:12:00.000Z' },
      { id: 'log-app-5-review', action: 'rejected', actorName: '审核管理员', comment: '暂未看到主管部门组织证明，需补充后重新提交。', score: 0, createdAt: '2026-08-21T09:35:00.000Z' },
    ],
    submittedAt: '2026-08-20T14:12:00.000Z',
    reviewedAt: '2026-08-21T09:35:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '暂未看到主管部门组织证明，需补充后重新提交。',
  },
]

const cloneJson = value => JSON.parse(JSON.stringify(value))

const defaultSettings = () => ({
  academicYear: '2026 专业技术岗位竞聘',
  submissionDeadline: '2026-08-31',
  scoringMode: 'teacherCompetition',
  weights: {
    academic: 0,
    moral: 0,
    practice: 0,
    sports: 0,
    bonusCap: 100,
  },
})

const normalizeSettings = settings => {
  const mode = settings?.scoringMode === 'bonus' ? 'bonus' : 'teacherCompetition'
  const sourceWeights = settings?.weights || {}
  const legacySettings = !settings?.scoringMode
  const teacherTotalCap = legacySettings ? 100 : Number(sourceWeights.bonusCap) || 100
  return {
    academicYear: String(settings?.academicYear || '2026 专业技术岗位竞聘'),
    submissionDeadline: String(settings?.submissionDeadline || '2026-08-31'),
    scoringMode: mode,
    weights: {
      academic: Number(sourceWeights.academic) || 0,
      moral: Number(sourceWeights.moral) || 0,
      practice: Number(sourceWeights.practice) || 0,
      sports: Number(sourceWeights.sports) || 0,
      bonusCap: mode === 'teacherCompetition' ? teacherTotalCap : Number(sourceWeights.bonusCap) || 20,
    },
  }
}

const normalizeCategory = (category, index) => ({
  id: String(category.id || uid('cat')),
  name: String(category.name || '未命名评分项目'),
  group: String(category.group || '竞聘评分'),
  defaultScore: Number(category.defaultScore) || 0,
  maxScore: Number(category.maxScore) || 0,
  order: Number.isFinite(Number(category.order)) ? Number(category.order) : index + 1,
  description: String(category.description || ''),
  requiredMaterials: String(category.requiredMaterials || ''),
  active: category.active !== false,
})

const migrateCategories = sourceCategories => {
  const sourceList = Array.isArray(sourceCategories) ? sourceCategories : []
  const teacherIds = new Set(seedCategories.map(category => category.id))
  const hasTeacherCategories = sourceList.some(category => teacherIds.has(String(category.id || '')))
  const sourceById = new Map(sourceList.map(category => [String(category.id || ''), category]))
  const teacherCategories = seedCategories.map((seed, index) => {
    const existing = sourceById.get(seed.id)
    return normalizeCategory({ ...seed, ...(existing || {}), id: seed.id }, index)
  })
  const legacyCategories = sourceList
    .filter(category => !teacherIds.has(String(category.id || '')))
    .map((category, index) => normalizeCategory({
      ...category,
      group: category.group || (hasTeacherCategories ? '自定义评分项目' : '旧版加分项目'),
      active: hasTeacherCategories ? category.active !== false : false,
      order: seedCategories.length + index + 1,
    }, seedCategories.length + index))
  return [...teacherCategories, ...legacyCategories]
}

const normalizeBatch = (batch, index) => ({
  id: String(batch.id || uid('batch')),
  name: String(batch.name || '未命名申报批次'),
  startDate: String(batch.startDate || ''),
  endDate: String(batch.endDate || ''),
  description: String(batch.description || ''),
  active: batch.active !== false,
  order: Number.isFinite(Number(batch.order)) ? Number(batch.order) : index + 1,
})

const migrateBatches = sourceBatches => {
  const sourceList = Array.isArray(sourceBatches) ? sourceBatches : []
  const seedIds = new Set(seedBatches.map(batch => batch.id))
  const hasTeacherBatches = sourceList.some(batch => seedIds.has(String(batch.id || '')))
  const sourceById = new Map(sourceList.map(batch => [String(batch.id || ''), batch]))
  const teacherBatches = seedBatches.map((seed, index) => {
    const existing = sourceById.get(seed.id)
    return normalizeBatch({ ...seed, ...(existing || {}), id: seed.id }, index)
  })
  const legacyBatches = sourceList
    .filter(batch => !seedIds.has(String(batch.id || '')))
    .map((batch, index) => normalizeBatch({
      ...batch,
      active: hasTeacherBatches ? batch.active !== false : false,
      order: seedBatches.length + index + 1,
    }, seedBatches.length + index))
  return [...teacherBatches, ...legacyBatches]
}

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
  settings: defaultSettings(),
  sessions: [],
})

const migrateDb = async source => {
  const next = {
    students: Array.isArray(source.students) ? source.students : [],
    batches: migrateBatches(source.batches),
    categories: migrateCategories(source.categories),
    applications: Array.isArray(source.applications) ? source.applications : [],
    settings: normalizeSettings(source.settings),
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

const createCategoryScores = (applications, categoryMap, scoreKey) => {
  const scores = {}
  applications.forEach(application => {
    const category = categoryMap.get(application.categoryId)
    if (!category || category.active === false) return
    const currentScore = scores[application.categoryId] || 0
    const nextScore = currentScore + (Number(application[scoreKey]) || 0)
    scores[application.categoryId] = roundScore(Math.min(nextScore, Number(category.maxScore) || 0))
  })
  const total = roundScore(Object.values(scores).reduce((sum, score) => sum + score, 0))
  return { scores, total }
}

const createRankingRows = () => {
  const isTeacherCompetition = db.settings.scoringMode !== 'bonus'
  const totalCap = Number(db.settings.weights?.bonusCap) || 100
  const categoryMap = new Map(db.categories.filter(category => category.active !== false).map(category => [category.id, category]))

  const rows = db.students.map(student => {
    const studentApplications = db.applications.filter(application => application.studentId === student.studentId)
    const scoreableApplications = isTeacherCompetition
      ? studentApplications.filter(application => categoryMap.has(application.categoryId))
      : studentApplications
    const approvedApplications = scoreableApplications.filter(application => application.status === 'approved')
    const submittedApplications = scoreableApplications.filter(application => application.status !== 'rejected')
    const approvedCategoryScores = createCategoryScores(approvedApplications, categoryMap, 'approvedScore')
    const requestedCategoryScores = createCategoryScores(submittedApplications, categoryMap, 'requestedScore')
    const baseScore = isTeacherCompetition ? 0 : calculateBaseScore(student)
    const bonusScore = isTeacherCompetition
      ? roundScore(Math.min(approvedCategoryScores.total, totalCap))
      : roundScore(Math.min(approvedApplications.reduce((sum, application) => sum + application.approvedScore, 0), totalCap))
    const selfScore = isTeacherCompetition
      ? roundScore(Math.min(requestedCategoryScores.total, totalCap))
      : roundScore(Math.min(submittedApplications.reduce((sum, application) => sum + application.requestedScore, 0), totalCap))
    const warnings = []
    if (student.failedCourses > 0) warnings.push(`限制项 ${student.failedCourses} 个`)
    if (student.hasPunishment) warnings.push('存在参评限制记录')

    return {
      studentId: student.studentId,
      studentName: student.name,
      department: student.department,
      major: student.major,
      grade: student.grade,
      baseScore,
      bonusScore,
      selfScore,
      totalScore: roundScore(baseScore + bonusScore),
      rank: 0,
      categoryScores: approvedCategoryScores.scores,
      categorySelfScores: requestedCategoryScores.scores,
      approvedApplications,
      warnings,
    }
  }).sort((a, b) => (
    b.totalScore - a.totalScore ||
    b.selfScore - a.selfScore ||
    b.baseScore - a.baseScore ||
    a.studentId.localeCompare(b.studentId)
  ))

  let lastScore = null
  let lastRank = 0
  return rows.map((row, index) => {
    if (lastScore === null || row.totalScore < lastScore) {
      lastRank = index + 1
      lastScore = row.totalScore
    }
    return { ...row, rank: lastRank }
  })
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
  db.categories.push(normalizeCategory({ ...req.body?.category, id: req.body?.category?.id || uid('cat') }, db.categories.length))
  await saveDb()
  apiOk(req, res, '评分项目已新增')
})

app.put('/api/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  db.categories = db.categories.map((category, index) => (
    category.id === req.params.id
      ? normalizeCategory({ ...category, ...req.body?.category, id: req.params.id }, index)
      : category
  ))
  await saveDb()
  apiOk(req, res, '评分项目已保存')
})

app.delete('/api/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  if (db.applications.some(application => application.categoryId === req.params.id)) {
    db.categories = db.categories.map(category => category.id === req.params.id ? { ...category, active: false } : category)
    await saveDb()
    apiOk(req, res, '该评分项目已有申报记录，已自动停用')
    return
  }
  db.categories = db.categories.filter(category => category.id !== req.params.id)
  await saveDb()
  apiOk(req, res, '评分项目已删除')
})

app.put('/api/settings', requireAuth, requireAdmin, async (req, res) => {
  db.settings = normalizeSettings(req.body?.settings)
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
    res.status(400).json({ ok: false, message: '用户、申报批次或评分项目不存在' })
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
  apiOk(req, res, '申报已提交，等待复评')
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
    { id: uid('log'), action: status, actorName: req.currentUser.name, comment: comment || (status === 'approved' ? '复评通过' : '复评驳回'), score: approvedScore, createdAt: time },
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
  res.json(createRankingRows())
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
