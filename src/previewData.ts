import type { BonusApplication, BonusCategory, MaterialAttachment, StudentProfile, SystemSettings, ApplicationBatch } from './types'

const createPreviewAttachment = (id: string, title: string, subtitle: string, accent = '#2563eb'): MaterialAttachment => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
      <rect width="720" height="480" rx="28" fill="#f8fafc"/>
      <rect x="42" y="42" width="636" height="396" rx="22" fill="#ffffff" stroke="#dbeafe" stroke-width="3"/>
      <rect x="72" y="78" width="576" height="58" rx="14" fill="${accent}"/>
      <text x="360" y="116" text-anchor="middle" font-family="Microsoft YaHei, Arial" font-size="28" font-weight="700" fill="#ffffff">演示证明材料</text>
      <text x="360" y="216" text-anchor="middle" font-family="Microsoft YaHei, Arial" font-size="34" font-weight="700" fill="#0f172a">${title}</text>
      <text x="360" y="264" text-anchor="middle" font-family="Microsoft YaHei, Arial" font-size="22" fill="#475569">${subtitle}</text>
      <line x1="132" y1="326" x2="588" y2="326" stroke="#bfdbfe" stroke-width="2"/>
      <text x="150" y="372" font-family="Microsoft YaHei, Arial" font-size="20" fill="#64748b">材料编号：${id.toUpperCase()}</text>
      <text x="150" y="404" font-family="Microsoft YaHei, Arial" font-size="20" fill="#64748b">上传时间：2026-08</text>
      <circle cx="590" cy="370" r="42" fill="none" stroke="${accent}" stroke-width="7"/>
      <text x="590" y="378" text-anchor="middle" font-family="Microsoft YaHei, Arial" font-size="18" font-weight="700" fill="${accent}">DEMO</text>
    </svg>
  `

  return {
    id,
    name: `${title}.svg`,
    type: 'image/svg+xml',
    size: svg.length,
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    uploadedAt: '2026-08-25T09:00:00.000Z',
  }
}

export const previewStudents: StudentProfile[] = [
  ['stu-1', '张老师', 'JS2026001', '石马镇中心小学', '语文', '中级首聘', 0, false, 'active'],
  ['stu-2', '李老师', 'JS2026002', '石马镇中心小学', '数学', '高级首聘', 0, false, 'active'],
  ['stu-3', '王老师', 'JS2026003', '石马镇第二小学', '英语', '层级内晋升', 1, false, 'active'],
  ['stu-4', '陈老师', 'JS2026004', '石马镇第三小学', '道德与法治', '中级首聘', 0, true, 'inactive'],
  ['stu-5', '刘老师', 'JS2026005', '石马镇中心小学', '体育', '高级首聘', 0, false, 'active'],
  ['stu-6', '赵老师', 'JS2026006', '石马镇第二小学', '科学', '层级内晋升', 0, false, 'locked'],
].map(([id, name, studentId, department, major, grade, failedCourses, hasPunishment, accountStatus]) => ({
  id: String(id),
  name: String(name),
  studentId: String(studentId),
  department: String(department),
  major: String(major),
  grade: String(grade),
  academicScore: 0,
  moralScore: 0,
  practiceScore: 0,
  sportsScore: 0,
  failedCourses: Number(failedCourses),
  hasPunishment: Boolean(hasPunishment),
  volunteerHours: 0,
  accountStatus: accountStatus as StudentProfile['accountStatus'],
  password: '123456',
  mustChangePassword: false,
  inviteCode: accountStatus === 'inactive' ? `SR-DEMO-${String(studentId).slice(-4)}` : undefined,
  activatedAt: accountStatus === 'active' ? '2026-08-20T08:00:00.000Z' : undefined,
  lastLoginAt: accountStatus === 'active' ? '2026-08-25T10:20:00.000Z' : undefined,
}))

export const previewBatches: ApplicationBatch[] = [
  {
    id: 'batch-teacher-2026',
    name: '2026 专业技术岗位竞聘',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    description: '用于本轮专业技术岗位竞聘，申报人按评分项目提交自评分和证明材料。',
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

export const previewCategories: BonusCategory[] = [
  ['score-work-years', '资历条件', '工作年限', 20, '教龄每年 0.5 分，工龄每年 0.4 分，教龄和工龄不重复计算，本项最高 20 分。', '人事档案、任教经历证明、参加工作时间证明等。'],
  ['score-education', '资历条件', '学历', 5, '本科及以上 5 分，专科 4 分，中师或中专 3 分；取得学历但未取得相应层次教师资格证计 2 分。', '毕业证、学位证、教师资格证或学信网证明。'],
  ['score-assessment', '资历条件', '年度、师德考核', 6, '近三年年度考核、师德考核优秀各 1 分/次，合格各 0.9 分/次；任一项合格以下不得参评。', '近三年年度考核和师德考核结果证明。'],
  ['score-professional-post', '资历条件', '专业技术职务', 12, '按下一层级或同层级下一职级的任职资格、聘任职务年限分别计 0.5 分/年。', '任职资格证、聘任文件、岗位聘用材料。'],
  ['score-duty', '任职履历', '任职', 3, '近三年任职按岗位计分，兼任其他职务减半累计。', '学校任职文件、聘任通知或岗位工作证明。'],
  ['score-honor-comprehensive', '奖励成果', '奖励：综合奖', 3, '国家 3 分，省 2 分，市 1.5 分，县 1 分，乡镇 0.5 分，校级 0.3 分；不同年度可累计。', '综合荣誉证书、表彰文件或主管部门公示材料。'],
  ['score-honor-single', '奖励成果', '奖励：单项奖', 3, '一类单项奖按同级综合奖 1/2 计分，二类单项奖按 1/4 计分；同类别多次多项只计最高。', '单项获奖证书、推荐或组织文件。'],
  ['score-business-competition', '奖励成果', '个人业务竞赛', 4, '优质课、教学能力竞赛等按级别和等次计分；同一次逐级选拔只计最高。', '竞赛获奖证书、获奖文件、活动通知或学校推荐材料。'],
  ['score-guidance', '奖励成果', '指导获奖', 2, '指导学生学科竞赛、其他竞赛或体育竞赛获奖按级别和等次计分；多人指导按平均分认定。', '指导教师获奖证书、竞赛结果文件、学生获奖证明。'],
  ['score-paper-published', '教科研成果', '论文发表', 1, '省级及以上 1 分，市级 0.4 分；正规 CN/ISSN 期刊需可检索，多人合作按作者排序折算。', '论文刊物封面目录正文、检索页截图、作者信息页。'],
  ['score-paper-award', '教科研成果', '论文获奖', 1, '国家、省、市、县级论文获奖按级别和等次计分，同一论文同类奖项取最高。', '论文获奖证书、评审单位通知或主管部门文件。'],
  ['score-news', '教科研成果', '新闻报道', 1, '国家 1 分，省 0.5 分，市 0.3 分，县 0.2 分；同一内容按最高级别计分。', '报道链接、截图、刊发平台证明或采用证明。'],
  ['score-research-topic', '教科研成果', '课题研究', 2, '结题国家 2 分，省 1.5 分，市 1 分；立项当年按同级 1/3 计分，成员按细则比例折算。', '课题立项书、结题证书、成员名单或主管部门文件。'],
  ['score-attendance', '日常履职', '出勤', 6, '满勤 6 分；事假、病假、旷会、旷课、旷工按细则扣分。', '学校考勤统计、请假审批记录或相关说明。'],
  ['score-workload', '日常履职', '工作量', 10, '满工作量 8 分；超工作量可加分，少工作量按细则扣分，最高 10 分。', '课表、工作量统计表、岗位分工或任课证明。'],
  ['score-teaching-process', '教学质量', '教育教学工作过程', 3, '常规工作满分 3 分，依据教案、听课、监考、检查通报、工作完成情况等加减分。', '常规检查结果、听课记录、通报表扬或批评材料。'],
  ['score-teaching-effect', '教学质量', '教学效果', 18, '教学成绩、毕业班、接班提升、教学示范、工作成果等按细则汇总，本项最高 18 分。', '质量分析表、成绩排名证明、示范课材料、成果证明。'],
].map(([id, group, name, maxScore, description, requiredMaterials], index) => ({
  id: String(id),
  group: String(group),
  name: String(name),
  defaultScore: 0,
  maxScore: Number(maxScore),
  order: index + 1,
  description: String(description),
  requiredMaterials: String(requiredMaterials),
  active: true,
}))

export const previewApplications: BonusApplication[] = [
  {
    id: 'app-preview-1',
    applicationNo: 'SQ-2026-0001',
    studentId: 'JS2026001',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-work-years',
    title: '教龄与工龄认定',
    description: '1998 年参加工作，申请按教龄年限认定工作年限分。',
    requestedScore: 14,
    approvedScore: 14,
    status: 'approved',
    attachments: [createPreviewAttachment('att-work-years', '工作年限证明', '张老师 · 石马镇中心小学')],
    calculation: {
      ruleId: 'score-work-years',
      ruleName: '工作年限自动计分',
      score: 14,
      summary: '教龄 28 年 × 0.5 分/年 = 14 分',
      fields: { yearType: 'teaching', years: 28 },
      warnings: [],
    },
    reviewLogs: [
      { id: 'log-preview-1-submit', action: 'submitted', actorName: '张老师', comment: '提交申报材料', score: 14, createdAt: '2026-08-20T09:30:00.000Z' },
      { id: 'log-preview-1-review', action: 'approved', actorName: '审核管理员', comment: '人事档案时间可核验，按 14 分认定。', score: 14, createdAt: '2026-08-21T15:10:00.000Z' },
    ],
    submittedAt: '2026-08-20T09:30:00.000Z',
    reviewedAt: '2026-08-21T15:10:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '人事档案时间可核验，按 14 分认定。',
  },
  {
    id: 'app-preview-2',
    applicationNo: 'SQ-2026-0002',
    studentId: 'JS2026002',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-education',
    title: '本科学历及教师资格证',
    description: '提交本科毕业证和相应层次教师资格证。',
    requestedScore: 5,
    approvedScore: 5,
    status: 'approved',
    attachments: [createPreviewAttachment('att-education', '学历与资格证', '李老师 · 数学')],
    calculation: {
      ruleId: 'score-education',
      ruleName: '学历自动计分',
      score: 5,
      summary: '本科及以上，有对应教师资格证，计 5 分',
      fields: { educationLevel: 'bachelor', hasTeacherCert: true },
      warnings: [],
    },
    reviewLogs: [
      { id: 'log-preview-2-submit', action: 'submitted', actorName: '李老师', comment: '提交申报材料', score: 5, createdAt: '2026-08-22T11:00:00.000Z' },
      { id: 'log-preview-2-review', action: 'approved', actorName: '审核管理员', comment: '学历与教师资格证一致，认定 5 分。', score: 5, createdAt: '2026-08-23T10:20:00.000Z' },
    ],
    submittedAt: '2026-08-22T11:00:00.000Z',
    reviewedAt: '2026-08-23T10:20:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '学历与教师资格证一致，认定 5 分。',
  },
  {
    id: 'app-preview-3',
    applicationNo: 'SQ-2026-0003',
    studentId: 'JS2026002',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-honor-comprehensive',
    title: '县级优秀教师',
    description: '2025 年获得县级优秀教师，申请综合奖计分。',
    requestedScore: 1,
    approvedScore: 0,
    status: 'pending',
    attachments: [createPreviewAttachment('att-honor', '县级优秀教师', '李老师 · 石马镇中心小学', '#0891b2')],
    calculation: {
      ruleId: 'score-honor-comprehensive',
      ruleName: '综合奖自动计分',
      score: 1,
      summary: '县级综合奖 1 次，合计 1 分',
      fields: { recommended: true, level: 'county', count: 1 },
      warnings: [],
    },
    reviewLogs: [
      { id: 'log-preview-3-submit', action: 'submitted', actorName: '李老师', comment: '提交申报材料', score: 1, createdAt: '2026-08-24T13:45:00.000Z' },
    ],
    submittedAt: '2026-08-24T13:45:00.000Z',
  },
  {
    id: 'app-preview-4',
    applicationNo: 'SQ-2026-0004',
    studentId: 'JS2026005',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-guidance',
    title: '指导学生体育竞赛获奖',
    description: '指导学生在县级运动会获得名次，申请指导获奖加分。',
    requestedScore: 0.75,
    approvedScore: 0,
    status: 'pending',
    attachments: [createPreviewAttachment('att-guidance', '指导获奖证明', '刘老师 · 体育', '#16a34a')],
    calculation: {
      ruleId: 'score-guidance',
      ruleName: '指导获奖自动计分',
      score: 0.75,
      summary: '学科竞赛指导奖，县级一等奖，1 人共同指导，计 0.75 分',
      fields: { schoolApproved: true, guidanceType: 'subject', level: 'county', prize: 'first', instructorCount: 1 },
      warnings: [],
    },
    reviewLogs: [
      { id: 'log-preview-4-submit', action: 'submitted', actorName: '刘老师', comment: '提交申报材料', score: 0.75, createdAt: '2026-08-25T09:20:00.000Z' },
    ],
    submittedAt: '2026-08-25T09:20:00.000Z',
  },
  {
    id: 'app-preview-5',
    applicationNo: 'SQ-2026-0005',
    studentId: 'JS2026003',
    batchId: 'batch-teacher-2026',
    categoryId: 'score-paper-award',
    title: '论文获奖材料',
    description: '提交论文获奖证书截图，待复核是否属于主管部门组织。',
    requestedScore: 0.5,
    approvedScore: 0,
    status: 'rejected',
    attachments: [createPreviewAttachment('att-paper', '论文获奖材料', '王老师 · 英语', '#dc2626')],
    calculation: {
      ruleId: 'score-paper-award',
      ruleName: '论文获奖自动计分',
      score: 0.5,
      summary: '市级论文获奖一等奖，计 0.5 分',
      fields: { recommended: true, level: 'city', prize: 'first' },
      warnings: [],
    },
    reviewLogs: [
      { id: 'log-preview-5-submit', action: 'submitted', actorName: '王老师', comment: '提交申报材料', score: 0.5, createdAt: '2026-08-20T14:12:00.000Z' },
      { id: 'log-preview-5-review', action: 'rejected', actorName: '审核管理员', comment: '暂未看到主管部门组织证明，需补充后重新提交。', score: 0, createdAt: '2026-08-21T09:35:00.000Z' },
    ],
    submittedAt: '2026-08-20T14:12:00.000Z',
    reviewedAt: '2026-08-21T09:35:00.000Z',
    reviewerName: '审核管理员',
    reviewComment: '暂未看到主管部门组织证明，需补充后重新提交。',
  },
]

export const previewSettings: SystemSettings = {
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
}

export const previewState = {
  students: previewStudents,
  batches: previewBatches,
  categories: previewCategories,
  applications: previewApplications,
  settings: previewSettings,
}
