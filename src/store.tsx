/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AccountStatus,
  BonusApplication,
  BonusCategory,
  CurrentUser,
  MaterialAttachment,
  RankingResult,
  StudentProfile,
  SystemSettings,
  UserRole,
} from './types'
import { mockApplications, mockCategories, mockSettings, mockStudents } from './mockData'

const DATA_KEY = 'score-review-system-data-v3'
const USER_KEY = 'score-review-system-user-v4'
const INITIAL_PASSWORD = '123456'

interface StoredData {
  students: StudentProfile[]
  categories: BonusCategory[]
  applications: BonusApplication[]
  settings: SystemSettings
}

interface ApplicationInput {
  studentId: string
  categoryId: string
  title: string
  description: string
  requestedScore: number
  attachments: MaterialAttachment[]
}

interface AppState extends StoredData {
  currentUser: CurrentUser | null
  rankings: RankingResult[]
  login: (role: UserRole, username: string, password: string) => { ok: boolean; message: string }
  logout: () => void
  changePassword: (oldPassword: string, newPassword: string) => { ok: boolean; message: string }
  addStudent: (student: StudentProfile) => void
  updateStudent: (student: StudentProfile) => void
  deleteStudent: (id: string) => void
  importStudents: (students: StudentProfile[]) => void
  resetUserPassword: (id: string) => void
  updateUserAccountStatus: (id: string, status: AccountStatus) => void
  addCategory: (category: BonusCategory) => void
  updateCategory: (category: BonusCategory) => void
  deleteCategory: (id: string) => void
  updateSettings: (settings: SystemSettings) => void
  addApplication: (application: ApplicationInput) => void
  deleteApplication: (id: string) => void
  reviewApplication: (id: string, status: 'approved' | 'rejected', approvedScore: number, comment: string) => void
  exportData: () => void
  importData: (raw: string) => { ok: boolean; message: string; settings?: SystemSettings }
  resetDemoData: () => SystemSettings
  getStudentByStudentId: (studentId: string) => StudentProfile | undefined
  getCategoryById: (id: string) => BonusCategory | undefined
  getStudentRanking: (studentId: string) => RankingResult | undefined
}

const AppContext = createContext<AppState | null>(null)

const makeInitialData = (): StoredData => ({
  students: mockStudents,
  categories: mockCategories,
  applications: mockApplications,
  settings: mockSettings,
})

const normalizeStudents = (students: StudentProfile[]) => (
  students.map(student => ({
    ...student,
    accountStatus: student.accountStatus ?? 'inactive',
    password: student.password || INITIAL_PASSWORD,
    mustChangePassword: student.mustChangePassword ?? student.accountStatus !== 'active',
  }))
)

const makeApplicationNo = (sequence: number, academicYear: string) => {
  const year = academicYear.match(/\d{4}/)?.[0] ?? new Date().getFullYear().toString()
  return `SQ-${year}-${String(sequence).padStart(4, '0')}`
}

const normalizeApplications = (applications: BonusApplication[], students: StudentProfile[]) => (
  applications.map((application, index) => {
    const owner = students.find(student => student.studentId === application.studentId)
    const applicationNo = application.applicationNo || makeApplicationNo(index + 1, mockSettings.academicYear)
    const reviewLogs = application.reviewLogs?.length ? application.reviewLogs : [
      {
        id: `log-${application.id}-submit`,
        action: 'submitted' as const,
        actorName: owner?.name ?? application.studentId,
        comment: '提交申报材料',
        score: application.requestedScore,
        createdAt: application.submittedAt,
      },
      ...(application.reviewedAt ? [{
        id: `log-${application.id}-review`,
        action: application.status === 'approved' ? 'approved' as const : 'rejected' as const,
        actorName: application.reviewerName ?? '管理员',
        comment: application.reviewComment || (application.status === 'approved' ? '审核通过' : '审核驳回'),
        score: application.approvedScore,
        createdAt: application.reviewedAt,
      }] : []),
    ]

    return {
      ...application,
      applicationNo,
      reviewLogs,
    }
  })
)

const readStoredData = (): StoredData => {
  try {
    const raw = window.localStorage.getItem(DATA_KEY)
    if (!raw) return makeInitialData()
    const parsed = JSON.parse(raw) as Partial<StoredData>
    if (!Array.isArray(parsed.students) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.applications) || !parsed.settings) {
      return makeInitialData()
    }
    const students = normalizeStudents(parsed.students)
    return {
      students,
      categories: parsed.categories,
      applications: normalizeApplications(parsed.applications, students),
      settings: parsed.settings,
    }
  } catch {
    return makeInitialData()
  }
}

const readStoredUser = (): CurrentUser | null => {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) as CurrentUser : null
  } catch {
    return null
  }
}

const roundScore = (value: number) => Math.round(value * 10) / 10

const clampScore = (value: number, max: number) => Math.max(0, Math.min(Number.isFinite(value) ? value : 0, max))

const calculateBaseScore = (student: StudentProfile, settings: SystemSettings) => {
  const { weights } = settings
  const weighted =
    student.academicScore * (weights.academic / 100) +
    student.moralScore * (weights.moral / 100) +
    student.practiceScore * (weights.practice / 100) +
    student.sportsScore * (weights.sports / 100)
  return roundScore(weighted)
}

const createRankings = (students: StudentProfile[], applications: BonusApplication[], settings: SystemSettings): RankingResult[] => {
  const rows = students.map(student => {
    const approvedApplications = applications.filter(app => app.studentId === student.studentId && app.status === 'approved')
    const rawBonusScore = approvedApplications.reduce((sum, app) => sum + app.approvedScore, 0)
    const bonusScore = roundScore(Math.min(rawBonusScore, settings.weights.bonusCap))
    const baseScore = calculateBaseScore(student, settings)
    const warnings: string[] = []
    if (student.failedCourses > 0) warnings.push(`异常项${student.failedCourses}个`)
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
  }).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore
    return a.studentId.localeCompare(b.studentId)
  })

  let lastScore: number | null = null
  let lastRank = 0
  return rows.map((row, index) => {
    if (lastScore === null || row.totalScore < lastScore) {
      lastRank = index + 1
      lastScore = row.totalScore
    }
    return { ...row, rank: lastRank }
  })
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [initialData] = useState<StoredData>(() => readStoredData())
  const [students, setStudents] = useState<StudentProfile[]>(initialData.students)
  const [categories, setCategories] = useState<BonusCategory[]>(initialData.categories)
  const [applications, setApplications] = useState<BonusApplication[]>(initialData.applications)
  const [settings, setSettings] = useState<SystemSettings>(initialData.settings)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => readStoredUser())

  useEffect(() => {
    window.localStorage.setItem(DATA_KEY, JSON.stringify({ students, categories, applications, settings }))
  }, [students, categories, applications, settings])

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
    } else {
      window.localStorage.removeItem(USER_KEY)
    }
  }, [currentUser])

  const rankings = useMemo(() => createRankings(students, applications, settings), [students, applications, settings])

  const getStudentByStudentId = useCallback((studentId: string) => (
    students.find(student => student.studentId === studentId)
  ), [students])

  const getCategoryById = useCallback((id: string) => (
    categories.find(category => category.id === id)
  ), [categories])

  const getStudentRanking = useCallback((studentId: string) => (
    rankings.find(row => row.studentId === studentId)
  ), [rankings])

  const login = useCallback((role: UserRole, username: string, password: string) => {
    const normalizedUsername = username.trim()
    const normalizedPassword = password.trim()

    if (role === 'admin') {
      if (normalizedUsername === 'admin' && normalizedPassword === 'admin123') {
        setCurrentUser({ id: 'admin', role: 'admin', name: '审核管理员', username: 'admin' })
        return { ok: true, message: '登录成功' }
      }
      return { ok: false, message: '管理员账号或密码不正确' }
    }

    const student = students.find(item => item.studentId === normalizedUsername)
    if (!student) return { ok: false, message: '未找到该用户编号' }
    if (student.accountStatus === 'locked') return { ok: false, message: '该账号已锁定，请联系管理员' }
    if (normalizedPassword !== student.password) return { ok: false, message: '用户编号或密码不正确' }

    const lastLoginAt = new Date().toISOString()
    setStudents(prev => prev.map(item => item.id === student.id ? { ...item, lastLoginAt } : item))

    setCurrentUser({
      id: student.id,
      role: 'student',
      name: student.name,
      username: student.studentId,
      studentId: student.studentId,
      mustChangePassword: student.mustChangePassword,
    })
    return { ok: true, message: student.mustChangePassword ? '首次登录需要修改密码' : '登录成功' }
  }, [students])

  const logout = useCallback(() => setCurrentUser(null), [])

  const changePassword = useCallback((oldPassword: string, newPassword: string) => {
    if (!currentUser?.studentId) return { ok: false, message: '请先登录用户账号' }
    const student = students.find(item => item.studentId === currentUser.studentId)
    if (!student) return { ok: false, message: '未找到当前用户档案' }
    if (oldPassword !== student.password) return { ok: false, message: '原密码不正确' }
    if (newPassword.length < 6) return { ok: false, message: '新密码至少 6 位' }
    if (newPassword === INITIAL_PASSWORD) return { ok: false, message: '新密码不能继续使用初始密码' }
    if (newPassword === oldPassword) return { ok: false, message: '新密码不能与原密码相同' }

    const now = new Date().toISOString()
    setStudents(prev => prev.map(item => item.id === student.id ? {
      ...item,
      password: newPassword,
      accountStatus: 'active',
      mustChangePassword: false,
      activatedAt: item.activatedAt ?? now,
      lastLoginAt: now,
    } : item))
    setCurrentUser(prev => prev ? { ...prev, mustChangePassword: false } : prev)
    return { ok: true, message: '密码已修改，账号已激活' }
  }, [currentUser, students])

  const addStudent = useCallback((student: StudentProfile) => {
    setStudents(prev => [...prev, ...normalizeStudents([student])])
  }, [])

  const updateStudent = useCallback((student: StudentProfile) => {
    setStudents(prev => prev.map(item => item.id === student.id ? student : item))
  }, [])

  const deleteStudent = useCallback((id: string) => {
    const deleted = students.find(student => student.id === id)
    setStudents(prev => prev.filter(student => student.id !== id))
    if (deleted) {
      setApplications(prev => prev.filter(application => application.studentId !== deleted.studentId))
    }
  }, [students])

  const importStudents = useCallback((newStudents: StudentProfile[]) => {
    setStudents(prev => {
      const byStudentId = new Map(prev.map(student => [student.studentId, student]))
      for (const student of normalizeStudents(newStudents)) {
        const existing = byStudentId.get(student.studentId)
        byStudentId.set(student.studentId, existing ? {
          ...student,
          id: existing.id,
          accountStatus: existing.accountStatus,
          password: existing.password,
          mustChangePassword: existing.mustChangePassword,
          activatedAt: existing.activatedAt,
          lastLoginAt: existing.lastLoginAt,
        } : student)
      }
      return Array.from(byStudentId.values())
    })
  }, [])

  const resetUserPassword = useCallback((id: string) => {
    setStudents(prev => prev.map(student => student.id === id ? {
      ...student,
      password: INITIAL_PASSWORD,
      accountStatus: 'inactive',
      mustChangePassword: true,
      activatedAt: undefined,
    } : student))
  }, [])

  const updateUserAccountStatus = useCallback((id: string, status: AccountStatus) => {
    setStudents(prev => prev.map(student => student.id === id ? {
      ...student,
      accountStatus: status,
      mustChangePassword: status === 'active' ? student.mustChangePassword : true,
    } : student))
  }, [])

  const addCategory = useCallback((category: BonusCategory) => {
    setCategories(prev => [...prev, category])
  }, [])

  const updateCategory = useCallback((category: BonusCategory) => {
    setCategories(prev => prev.map(item => item.id === category.id ? category : item))
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(category => category.id !== id))
  }, [])

  const updateSettings = useCallback((nextSettings: SystemSettings) => {
    setSettings(nextSettings)
  }, [])

  const addApplication = useCallback((application: ApplicationInput) => {
    const category = categories.find(item => item.id === application.categoryId)
    const requestedScore = clampScore(application.requestedScore, category?.maxScore ?? settings.weights.bonusCap)
    const owner = students.find(student => student.studentId === application.studentId)
    const now = new Date().toISOString()
    const created: BonusApplication = {
      ...application,
      id: `app-${Date.now()}`,
      applicationNo: makeApplicationNo(applications.length + 1, settings.academicYear),
      requestedScore,
      approvedScore: 0,
      status: 'pending',
      reviewLogs: [
        {
          id: `log-${Date.now()}-submit`,
          action: 'submitted',
          actorName: owner?.name ?? application.studentId,
          comment: '提交申报材料',
          score: requestedScore,
          createdAt: now,
        },
      ],
      submittedAt: now,
    }
    setApplications(prev => [created, ...prev])
  }, [applications.length, categories, settings.academicYear, settings.weights.bonusCap, students])

  const deleteApplication = useCallback((id: string) => {
    setApplications(prev => prev.filter(application => application.id !== id))
  }, [])

  const reviewApplication = useCallback((id: string, status: 'approved' | 'rejected', approvedScore: number, comment: string) => {
    setApplications(prev => prev.map(application => {
      if (application.id !== id) return application
      const category = categories.find(item => item.id === application.categoryId)
      const reviewedAt = new Date().toISOString()
      const finalScore = status === 'approved' ? clampScore(approvedScore, category?.maxScore ?? settings.weights.bonusCap) : 0
      const reviewComment = comment.trim()
      return {
        ...application,
        status,
        approvedScore: finalScore,
        reviewedAt,
        reviewerName: currentUser?.name ?? '管理员',
        reviewComment,
        reviewLogs: [
          ...application.reviewLogs,
          {
            id: `log-${Date.now()}-review`,
            action: status,
            actorName: currentUser?.name ?? '管理员',
            comment: reviewComment || (status === 'approved' ? '审核通过' : '审核驳回'),
            score: finalScore,
            createdAt: reviewedAt,
          },
        ],
      }
    }))
  }, [categories, currentUser?.name, settings.weights.bonusCap])

  const exportData = useCallback(() => {
    const payload = JSON.stringify({ students, categories, applications, settings }, null, 2)
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `评分系统数据备份-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [applications, categories, settings, students])

  const importData = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredData>
      if (!Array.isArray(parsed.students) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.applications) || !parsed.settings) {
      return { ok: false, message: '备份文件格式不正确' }
      }
      const students = normalizeStudents(parsed.students)
      setStudents(students)
      setCategories(parsed.categories)
      setApplications(normalizeApplications(parsed.applications, students))
      setSettings(parsed.settings)
      return { ok: true, message: '数据已恢复', settings: parsed.settings }
    } catch {
      return { ok: false, message: '备份文件解析失败' }
    }
  }, [])

  const resetDemoData = useCallback(() => {
    const demo = makeInitialData()
    setStudents(demo.students)
    setCategories(demo.categories)
    setApplications(demo.applications)
    setSettings(demo.settings)
    return demo.settings
  }, [])

  const value: AppState = {
    students,
    categories,
    applications,
    settings,
    currentUser,
    rankings,
    login,
    logout,
    changePassword,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    resetUserPassword,
    updateUserAccountStatus,
    addCategory,
    updateCategory,
    deleteCategory,
    updateSettings,
    addApplication,
    deleteApplication,
    reviewApplication,
    exportData,
    importData,
    resetDemoData,
    getStudentByStudentId,
    getCategoryById,
    getStudentRanking,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useStore() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useStore must be inside AppProvider')
  return ctx
}
