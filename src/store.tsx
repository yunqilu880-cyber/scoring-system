/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AccountStatus,
  ApplicationBatch,
  BonusApplication,
  BonusCategory,
  CurrentUser,
  MaterialAttachment,
  RankingResult,
  ScoreCalculationSnapshot,
  StudentProfile,
  SystemSettings,
  UserRole,
} from './types'
import { previewState } from './previewData'

interface StoredData {
  students: StudentProfile[]
  batches: ApplicationBatch[]
  categories: BonusCategory[]
  applications: BonusApplication[]
  settings: SystemSettings
}

interface ApplicationInput {
  studentId: string
  batchId?: string
  categoryId: string
  title: string
  description: string
  requestedScore: number
  calculation?: ScoreCalculationSnapshot
  attachments: MaterialAttachment[]
}

interface ActionResult {
  ok: boolean
  message: string
  currentUser?: CurrentUser | null
  state?: StoredData | null
  settings?: SystemSettings
}

interface AppState extends StoredData {
  currentUser: CurrentUser | null
  isLoading: boolean
  rankings: RankingResult[]
  login: (role: UserRole, username: string, password: string) => Promise<ActionResult>
  activateWithInvite: (studentId: string, inviteCode: string, password: string) => Promise<ActionResult>
  logout: () => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<ActionResult>
  addStudent: (student: StudentProfile) => Promise<ActionResult>
  updateStudent: (student: StudentProfile) => Promise<ActionResult>
  deleteStudent: (id: string) => Promise<ActionResult>
  importStudents: (students: StudentProfile[]) => Promise<ActionResult>
  resetUserPassword: (id: string) => Promise<ActionResult>
  updateUserAccountStatus: (id: string, status: AccountStatus) => Promise<ActionResult>
  addBatch: (batch: ApplicationBatch) => Promise<ActionResult>
  updateBatch: (batch: ApplicationBatch) => Promise<ActionResult>
  deleteBatch: (id: string) => Promise<ActionResult>
  addCategory: (category: BonusCategory) => Promise<ActionResult>
  updateCategory: (category: BonusCategory) => Promise<ActionResult>
  deleteCategory: (id: string) => Promise<ActionResult>
  updateSettings: (settings: SystemSettings) => Promise<ActionResult>
  addApplication: (application: ApplicationInput) => Promise<ActionResult>
  deleteApplication: (id: string) => Promise<ActionResult>
  reviewApplication: (id: string, status: 'approved' | 'rejected', approvedScore: number, comment: string) => Promise<ActionResult>
  createBackup: () => Promise<ActionResult>
  exportData: () => Promise<void>
  importData: (raw: string) => Promise<ActionResult>
  resetDemoData: () => Promise<SystemSettings>
  getStudentByStudentId: (studentId: string) => StudentProfile | undefined
  getCategoryById: (id: string) => BonusCategory | undefined
  getStudentRanking: (studentId: string) => RankingResult | undefined
}

const emptySettings: SystemSettings = {
  academicYear: '',
  submissionDeadline: '',
  scoringMode: 'teacherCompetition',
  weights: {
    academic: 0,
    moral: 0,
    practice: 0,
    sports: 0,
    bonusCap: 100,
  },
}

const emptyData: StoredData = {
  students: [],
  batches: [],
  categories: [],
  applications: [],
  settings: emptySettings,
}

const AppContext = createContext<AppState | null>(null)
const previewUserKey = 'scoring-system-preview-user'

export const isStaticPreview = typeof window !== 'undefined' && (
  window.location.hostname.endsWith('github.io') ||
  window.location.search.includes('preview=1')
)

const cloneData = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const makePreviewState = (): StoredData => cloneData(previewState)

const makePreviewInviteCode = (studentId: string) => `SR-DEMO-${studentId.slice(-4) || '0000'}`

const createPreviewUser = (role: UserRole, sourceStudents: StudentProfile[], username = ''): CurrentUser | null => {
  if (role === 'admin') {
    return {
      id: 'preview-admin',
      role: 'admin',
      name: '审核端预览',
      username: 'preview-admin',
      mustChangePassword: false,
    }
  }

  const student = sourceStudents.find(item => item.studentId === username && item.accountStatus !== 'locked')
    ?? sourceStudents.find(item => item.accountStatus === 'active')
    ?? sourceStudents[0]

  if (!student) return null
  return {
    id: student.id,
    role: 'student',
    name: student.name,
    username: student.studentId,
    studentId: student.studentId,
    mustChangePassword: false,
  }
}

const readPreviewUser = (sourceStudents: StudentProfile[]) => {
  if (!isStaticPreview) return null
  try {
    const raw = window.localStorage.getItem(previewUserKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CurrentUser
    if (parsed.role === 'admin') return parsed
    if (parsed.role === 'student' && parsed.studentId && sourceStudents.some(student => student.studentId === parsed.studentId)) {
      return parsed
    }
  } catch {
    window.localStorage.removeItem(previewUserKey)
  }
  return null
}

const writePreviewUser = (user: CurrentUser | null) => {
  if (!isStaticPreview) return
  if (user) window.localStorage.setItem(previewUserKey, JSON.stringify(user))
  else window.localStorage.removeItem(previewUserKey)
}

const initialData = isStaticPreview ? makePreviewState() : emptyData
const initialUser = isStaticPreview
  ? readPreviewUser(initialData.students) ?? createPreviewUser('admin', initialData.students)
  : null

const apiRequest = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
  const hasBody = typeof options.body !== 'undefined'
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || `请求失败：${response.status}`)
  }
  return payload as T
}

const roundScore = (value: number) => Math.round(value * 100) / 100

const calculateBaseScore = (student: StudentProfile, settings: SystemSettings) => {
  const { weights } = settings
  const weighted =
    student.academicScore * (weights.academic / 100) +
    student.moralScore * (weights.moral / 100) +
    student.practiceScore * (weights.practice / 100) +
    student.sportsScore * (weights.sports / 100)
  return roundScore(weighted)
}

const createCategoryScores = (
  applications: BonusApplication[],
  categories: BonusCategory[],
  scoreKey: 'requestedScore' | 'approvedScore',
) => {
  const categoryMap = new Map(categories.filter(category => category.active !== false).map(category => [category.id, category]))
  const scores: Record<string, number> = {}

  applications.forEach(application => {
    const category = categoryMap.get(application.categoryId)
    if (!category) return
    const currentScore = scores[application.categoryId] ?? 0
    const nextScore = currentScore + (Number(application[scoreKey]) || 0)
    scores[application.categoryId] = roundScore(Math.min(nextScore, Number(category.maxScore) || 0))
  })

  const total = roundScore(Object.values(scores).reduce((sum, score) => sum + score, 0))
  return { scores, total }
}

const createRankings = (
  students: StudentProfile[],
  applications: BonusApplication[],
  categories: BonusCategory[],
  settings: SystemSettings,
): RankingResult[] => {
  const isTeacherCompetition = settings.scoringMode !== 'bonus'
  const totalCap = Number(settings.weights.bonusCap) || 100
  const activeCategoryIds = new Set(categories.filter(category => category.active !== false).map(category => category.id))

  const rows = students.map(student => {
    const studentApplications = applications.filter(app => app.studentId === student.studentId)
    const scoreableApplications = isTeacherCompetition
      ? studentApplications.filter(app => activeCategoryIds.has(app.categoryId))
      : studentApplications
    const approvedApplications = scoreableApplications.filter(app => app.status === 'approved')
    const submittedApplications = scoreableApplications.filter(app => app.status !== 'rejected')
    const approvedCategoryScores = createCategoryScores(approvedApplications, categories, 'approvedScore')
    const requestedCategoryScores = createCategoryScores(submittedApplications, categories, 'requestedScore')
    const baseScore = isTeacherCompetition ? 0 : calculateBaseScore(student, settings)
    const bonusScore = isTeacherCompetition
      ? roundScore(Math.min(approvedCategoryScores.total, totalCap))
      : roundScore(Math.min(approvedApplications.reduce((sum, app) => sum + app.approvedScore, 0), totalCap))
    const selfScore = isTeacherCompetition
      ? roundScore(Math.min(requestedCategoryScores.total, totalCap))
      : roundScore(Math.min(submittedApplications.reduce((sum, app) => sum + app.requestedScore, 0), totalCap))
    const warnings: string[] = []
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
  }).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    if (b.selfScore !== a.selfScore) return b.selfScore - a.selfScore
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

const fallbackResult = (error: unknown): ActionResult => ({
  ok: false,
  message: error instanceof Error ? error.message : '操作失败，请稍后重试',
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<StudentProfile[]>(initialData.students)
  const [batches, setBatches] = useState<ApplicationBatch[]>(initialData.batches)
  const [categories, setCategories] = useState<BonusCategory[]>(initialData.categories)
  const [applications, setApplications] = useState<BonusApplication[]>(initialData.applications)
  const [settings, setSettings] = useState<SystemSettings>(initialData.settings)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(initialUser)
  const [isLoading, setIsLoading] = useState(!isStaticPreview)

  const applyState = useCallback((state?: StoredData | null) => {
    if (!state) return
    setStudents(state.students || [])
    setBatches(state.batches || [])
    setCategories(state.categories || [])
    setApplications(state.applications || [])
    setSettings(state.settings || emptySettings)
  }, [])

  const applyResult = useCallback((result: ActionResult) => {
    if (typeof result.currentUser !== 'undefined') setCurrentUser(result.currentUser)
    applyState(result.state)
    return result
  }, [applyState])

  useEffect(() => {
    if (isStaticPreview) return undefined

    let active = true
    apiRequest<ActionResult>('/api/auth/me')
      .then(result => {
        if (!active) return
        setCurrentUser(result.currentUser || null)
        applyState(result.state)
      })
      .catch(() => {
        if (active) setCurrentUser(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [applyState])

  const rankings = useMemo(() => createRankings(students, applications, categories, settings), [students, applications, categories, settings])

  const getStudentByStudentId = useCallback((studentId: string) => (
    students.find(student => student.studentId === studentId)
  ), [students])

  const getCategoryById = useCallback((id: string) => (
    categories.find(category => category.id === id)
  ), [categories])

  const getStudentRanking = useCallback((studentId: string) => (
    rankings.find(row => row.studentId === studentId)
  ), [rankings])

  const currentState = useCallback((): StoredData => ({
    students,
    batches,
    categories,
    applications,
    settings,
  }), [students, batches, categories, applications, settings])

  const previewOk = useCallback((message: string, user: CurrentUser | null = currentUser): ActionResult => ({
    ok: true,
    message,
    currentUser: user,
    state: currentState(),
  }), [currentState, currentUser])

  const login = useCallback(async (role: UserRole, username: string, password: string) => {
    if (isStaticPreview) {
      const user = createPreviewUser(role, students, username)
      if (!user) return { ok: false, message: '预览数据中没有可用账号' }
      setCurrentUser(user)
      writePreviewUser(user)
      return { ok: true, message: '已进入 GitHub 预览模式', currentUser: user, state: currentState() }
    }

    try {
      const result = await apiRequest<ActionResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role, username, password }),
      })
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult, currentState, students])

  const activateWithInvite = useCallback(async (studentId: string, inviteCode: string, password: string) => {
    if (isStaticPreview) {
      if (!password.trim()) return { ok: false, message: '请先设置登录密码' }
      const student = students.find(item => item.studentId === studentId && item.accountStatus !== 'locked')
      if (!student) return { ok: false, message: '没有找到可激活的预览用户' }
      const expectedCode = student.inviteCode ?? makePreviewInviteCode(student.studentId)
      if (inviteCode.trim() && inviteCode.trim() !== expectedCode) {
        return { ok: false, message: `预览模式邀请码可填写 ${expectedCode}` }
      }
      const nextStudent = {
        ...student,
        accountStatus: 'active' as AccountStatus,
        password,
        inviteCode: undefined,
        inviteUsedAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        mustChangePassword: false,
      }
      setStudents(prev => prev.map(item => item.id === student.id ? nextStudent : item))
      const user = createPreviewUser('student', [nextStudent], nextStudent.studentId)
      setCurrentUser(user)
      writePreviewUser(user)
      return { ok: true, message: '已在预览模式完成激活', currentUser: user, state: currentState() }
    }

    try {
      const result = await apiRequest<ActionResult>('/api/auth/activate', {
        method: 'POST',
        body: JSON.stringify({ studentId, inviteCode, password }),
      })
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult, currentState, students])

  const logout = useCallback(async () => {
    if (isStaticPreview) {
      setCurrentUser(null)
      writePreviewUser(null)
      return
    }

    try {
      await apiRequest<ActionResult>('/api/auth/logout', { method: 'POST' })
    } finally {
      setCurrentUser(null)
      applyState(emptyData)
    }
  }, [applyState])

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (isStaticPreview) {
      if (!oldPassword || !newPassword) return { ok: false, message: '请填写原密码和新密码' }
      return previewOk('预览模式已模拟修改密码')
    }

    try {
      const result = await apiRequest<ActionResult>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult, previewOk])

  const runMutation = useCallback(async (url: string, options: RequestInit = {}) => {
    if (isStaticPreview) return previewOk('GitHub 预览模式仅临时演示，不会保存到服务器')

    try {
      const result = await apiRequest<ActionResult>(url, options)
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult, previewOk])

  const addStudent = useCallback((student: StudentProfile) => {
    if (isStaticPreview) {
      const nextStudent = {
        ...student,
        id: student.id || `stu-preview-${Date.now()}`,
        accountStatus: student.accountStatus || 'inactive',
        inviteCode: student.accountStatus === 'active' ? undefined : student.inviteCode ?? makePreviewInviteCode(student.studentId),
      }
      setStudents(prev => [...prev.filter(item => item.studentId !== nextStudent.studentId), nextStudent])
      return Promise.resolve(previewOk('预览模式已新增申报人'))
    }

    return runMutation('/api/students', {
      method: 'POST',
      body: JSON.stringify({ student }),
    })
  }, [previewOk, runMutation])

  const updateStudent = useCallback((student: StudentProfile) => {
    if (isStaticPreview) {
      setStudents(prev => prev.map(item => item.id === student.id ? student : item))
      return Promise.resolve(previewOk('预览模式已更新申报人'))
    }

    return runMutation(`/api/students/${student.id}`, {
      method: 'PUT',
      body: JSON.stringify({ student }),
    })
  }, [previewOk, runMutation])

  const deleteStudent = useCallback((id: string) => {
    if (isStaticPreview) {
      const removed = students.find(student => student.id === id)
      setStudents(prev => prev.filter(student => student.id !== id))
      if (removed) setApplications(prev => prev.filter(application => application.studentId !== removed.studentId))
      return Promise.resolve(previewOk('预览模式已删除申报人'))
    }

    return runMutation(`/api/students/${id}`, {
      method: 'DELETE',
    })
  }, [previewOk, runMutation, students])

  const importStudents = useCallback((nextStudents: StudentProfile[]) => {
    if (isStaticPreview) {
      setStudents(prev => {
        const byStudentId = new Map(prev.map(student => [student.studentId, student]))
        nextStudents.forEach(student => {
          byStudentId.set(student.studentId, {
            ...student,
            id: student.id || `stu-preview-${Date.now()}-${student.studentId}`,
            accountStatus: 'inactive',
            inviteCode: makePreviewInviteCode(student.studentId),
            mustChangePassword: true,
          })
        })
        return Array.from(byStudentId.values())
      })
      return Promise.resolve(previewOk(`预览模式已导入或更新 ${nextStudents.length} 名申报人`))
    }

    return runMutation('/api/students/import', {
      method: 'POST',
      body: JSON.stringify({ students: nextStudents }),
    })
  }, [previewOk, runMutation])

  const resetUserPassword = useCallback((id: string) => {
    if (isStaticPreview) {
      setStudents(prev => prev.map(student => student.id === id
        ? {
            ...student,
            accountStatus: 'inactive',
            password: '123456',
            mustChangePassword: true,
            inviteCode: makePreviewInviteCode(student.studentId),
          }
        : student))
      return Promise.resolve(previewOk('预览模式已重置邀请码'))
    }

    return runMutation(`/api/students/${id}/reset-password`, {
      method: 'POST',
    })
  }, [previewOk, runMutation])

  const updateUserAccountStatus = useCallback((id: string, status: AccountStatus) => {
    if (isStaticPreview) {
      setStudents(prev => prev.map(student => student.id === id ? { ...student, accountStatus: status } : student))
      return Promise.resolve(previewOk('预览模式已更新账号状态'))
    }

    return runMutation(`/api/students/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }, [previewOk, runMutation])

  const addBatch = useCallback((batch: ApplicationBatch) => {
    if (isStaticPreview) {
      setBatches(prev => [...prev.filter(item => item.id !== batch.id), { ...batch, id: batch.id || `batch-preview-${Date.now()}` }])
      return Promise.resolve(previewOk('预览模式已添加批次'))
    }

    return runMutation('/api/batches', {
      method: 'POST',
      body: JSON.stringify({ batch }),
    })
  }, [previewOk, runMutation])

  const updateBatch = useCallback((batch: ApplicationBatch) => {
    if (isStaticPreview) {
      setBatches(prev => prev.map(item => item.id === batch.id ? batch : item))
      return Promise.resolve(previewOk('预览模式已更新批次'))
    }

    return runMutation(`/api/batches/${batch.id}`, {
      method: 'PUT',
      body: JSON.stringify({ batch }),
    })
  }, [previewOk, runMutation])

  const deleteBatch = useCallback((id: string) => {
    if (isStaticPreview) {
      setBatches(prev => prev.filter(batch => batch.id !== id))
      return Promise.resolve(previewOk('预览模式已删除批次'))
    }

    return runMutation(`/api/batches/${id}`, {
      method: 'DELETE',
    })
  }, [previewOk, runMutation])

  const addCategory = useCallback((category: BonusCategory) => {
    if (isStaticPreview) {
      setCategories(prev => [...prev.filter(item => item.id !== category.id), { ...category, id: category.id || `cat-preview-${Date.now()}` }])
      return Promise.resolve(previewOk('预览模式已添加评分项目'))
    }

    return runMutation('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ category }),
    })
  }, [previewOk, runMutation])

  const updateCategory = useCallback((category: BonusCategory) => {
    if (isStaticPreview) {
      setCategories(prev => prev.map(item => item.id === category.id ? category : item))
      return Promise.resolve(previewOk('预览模式已更新评分项目'))
    }

    return runMutation(`/api/categories/${category.id}`, {
      method: 'PUT',
      body: JSON.stringify({ category }),
    })
  }, [previewOk, runMutation])

  const deleteCategory = useCallback((id: string) => {
    if (isStaticPreview) {
      setCategories(prev => prev.filter(category => category.id !== id))
      return Promise.resolve(previewOk('预览模式已删除评分项目'))
    }

    return runMutation(`/api/categories/${id}`, {
      method: 'DELETE',
    })
  }, [previewOk, runMutation])

  const updateSettings = useCallback((nextSettings: SystemSettings) => {
    if (isStaticPreview) {
      setSettings(nextSettings)
      return Promise.resolve(previewOk('预览模式已保存评分规则'))
    }

    return runMutation('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: nextSettings }),
    })
  }, [previewOk, runMutation])

  const addApplication = useCallback((application: ApplicationInput) => {
    if (isStaticPreview) {
      const student = students.find(item => item.studentId === application.studentId)
      const year = settings.academicYear.match(/\d{4}/)?.[0] ?? new Date().getFullYear().toString()
      const sequence = applications.length + 1
      const nextApplication: BonusApplication = {
        id: `app-preview-${Date.now()}`,
        applicationNo: `SQ-${year}-${String(sequence).padStart(4, '0')}`,
        ...application,
        requestedScore: roundScore(application.requestedScore),
        approvedScore: 0,
        status: 'pending',
        reviewLogs: [
          {
            id: `log-preview-submit-${Date.now()}`,
            action: 'submitted',
            actorName: student?.name ?? '预览用户',
            comment: '提交申报材料',
            score: roundScore(application.requestedScore),
            createdAt: new Date().toISOString(),
          },
        ],
        submittedAt: new Date().toISOString(),
      }
      setApplications(prev => [nextApplication, ...prev])
      return Promise.resolve(previewOk('预览模式已提交申报，刷新后恢复演示数据'))
    }

    return runMutation('/api/applications', {
      method: 'POST',
      body: JSON.stringify({ application }),
    })
  }, [applications.length, previewOk, runMutation, settings.academicYear, students])

  const deleteApplication = useCallback((id: string) => {
    if (isStaticPreview) {
      setApplications(prev => prev.filter(application => application.id !== id))
      return Promise.resolve(previewOk('预览模式已删除申报'))
    }

    return runMutation(`/api/applications/${id}`, {
      method: 'DELETE',
    })
  }, [previewOk, runMutation])

  const reviewApplication = useCallback((id: string, status: 'approved' | 'rejected', approvedScore: number, comment: string) => {
    if (isStaticPreview) {
      setApplications(prev => prev.map(application => {
        if (application.id !== id) return application
        const category = categories.find(item => item.id === application.categoryId)
        const score = status === 'approved'
          ? roundScore(Math.min(Math.max(approvedScore, 0), category?.maxScore ?? approvedScore))
          : 0
        return {
          ...application,
          status,
          approvedScore: score,
          reviewedAt: new Date().toISOString(),
          reviewerName: currentUser?.name ?? '审核端预览',
          reviewComment: comment,
          reviewLogs: [
            ...application.reviewLogs,
            {
              id: `log-preview-review-${Date.now()}`,
              action: status,
              actorName: currentUser?.name ?? '审核端预览',
              comment: comment || (status === 'approved' ? '预览模式复评通过' : '材料不符合评分细则要求'),
              score,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      }))
      return Promise.resolve(previewOk('预览模式已更新复评结果'))
    }

    return runMutation(`/api/applications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, approvedScore, comment }),
    })
  }, [categories, currentUser?.name, previewOk, runMutation])

  const createBackup = useCallback(() => runMutation('/api/backup', {
    method: 'POST',
    body: JSON.stringify({ reason: 'manual' }),
  }), [runMutation])

  const exportData = useCallback(async () => {
    if (isStaticPreview) {
      const blob = new Blob([JSON.stringify(currentState(), null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `评分系统预览数据-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      return
    }

    const response = await fetch('/api/export', { credentials: 'include' })
    if (!response.ok) throw new Error('导出失败')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `评分系统数据备份-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [currentState])

  const importData = useCallback(async (raw: string) => {
    if (isStaticPreview) {
      try {
        const parsed = JSON.parse(raw) as Partial<StoredData>
        const nextState: StoredData = {
          students: parsed.students || [],
          batches: parsed.batches || [],
          categories: parsed.categories || [],
          applications: parsed.applications || [],
          settings: parsed.settings || emptySettings,
        }
        applyState(nextState)
        return { ok: true, message: '预览模式已导入备份数据', state: nextState, settings: nextState.settings }
      } catch {
        return { ok: false, message: '备份文件格式不正确' }
      }
    }

    try {
      const result = await apiRequest<ActionResult>('/api/import-json', {
        method: 'POST',
        body: JSON.stringify({ raw }),
      })
      applyResult(result)
      return { ...result, settings: result.state?.settings }
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult, applyState])

  const resetDemoData = useCallback(async () => {
    if (isStaticPreview) {
      const nextState = makePreviewState()
      applyState(nextState)
      return nextState.settings
    }

    const result = await apiRequest<ActionResult>('/api/reset-demo', { method: 'POST' })
    applyResult(result)
    return result.state?.settings || emptySettings
  }, [applyResult, applyState])

  const value: AppState = {
    students,
    batches,
    categories,
    applications,
    settings,
    currentUser,
    isLoading,
    rankings,
    login,
    activateWithInvite,
    logout,
    changePassword,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    resetUserPassword,
    updateUserAccountStatus,
    addBatch,
    updateBatch,
    deleteBatch,
    addCategory,
    updateCategory,
    deleteCategory,
    updateSettings,
    addApplication,
    deleteApplication,
    reviewApplication,
    createBackup,
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
