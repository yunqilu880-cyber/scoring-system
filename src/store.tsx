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
  addCategory: (category: BonusCategory) => Promise<ActionResult>
  updateCategory: (category: BonusCategory) => Promise<ActionResult>
  deleteCategory: (id: string) => Promise<ActionResult>
  updateSettings: (settings: SystemSettings) => Promise<ActionResult>
  addApplication: (application: ApplicationInput) => Promise<ActionResult>
  deleteApplication: (id: string) => Promise<ActionResult>
  reviewApplication: (id: string, status: 'approved' | 'rejected', approvedScore: number, comment: string) => Promise<ActionResult>
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
  weights: {
    academic: 60,
    moral: 15,
    practice: 15,
    sports: 10,
    bonusCap: 20,
  },
}

const emptyData: StoredData = {
  students: [],
  categories: [],
  applications: [],
  settings: emptySettings,
}

const AppContext = createContext<AppState | null>(null)

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

const roundScore = (value: number) => Math.round(value * 10) / 10

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

const fallbackResult = (error: unknown): ActionResult => ({
  ok: false,
  message: error instanceof Error ? error.message : '操作失败，请稍后重试',
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<StudentProfile[]>(emptyData.students)
  const [categories, setCategories] = useState<BonusCategory[]>(emptyData.categories)
  const [applications, setApplications] = useState<BonusApplication[]>(emptyData.applications)
  const [settings, setSettings] = useState<SystemSettings>(emptyData.settings)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const applyState = useCallback((state?: StoredData | null) => {
    if (!state) return
    setStudents(state.students || [])
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

  const login = useCallback(async (role: UserRole, username: string, password: string) => {
    try {
      const result = await apiRequest<ActionResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role, username, password }),
      })
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult])

  const activateWithInvite = useCallback(async (studentId: string, inviteCode: string, password: string) => {
    try {
      const result = await apiRequest<ActionResult>('/api/auth/activate', {
        method: 'POST',
        body: JSON.stringify({ studentId, inviteCode, password }),
      })
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult])

  const logout = useCallback(async () => {
    try {
      await apiRequest<ActionResult>('/api/auth/logout', { method: 'POST' })
    } finally {
      setCurrentUser(null)
      applyState(emptyData)
    }
  }, [applyState])

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    try {
      const result = await apiRequest<ActionResult>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult])

  const runMutation = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      const result = await apiRequest<ActionResult>(url, options)
      return applyResult(result)
    } catch (error) {
      return fallbackResult(error)
    }
  }, [applyResult])

  const addStudent = useCallback((student: StudentProfile) => runMutation('/api/students', {
    method: 'POST',
    body: JSON.stringify({ student }),
  }), [runMutation])

  const updateStudent = useCallback((student: StudentProfile) => runMutation(`/api/students/${student.id}`, {
    method: 'PUT',
    body: JSON.stringify({ student }),
  }), [runMutation])

  const deleteStudent = useCallback((id: string) => runMutation(`/api/students/${id}`, {
    method: 'DELETE',
  }), [runMutation])

  const importStudents = useCallback((nextStudents: StudentProfile[]) => runMutation('/api/students/import', {
    method: 'POST',
    body: JSON.stringify({ students: nextStudents }),
  }), [runMutation])

  const resetUserPassword = useCallback((id: string) => runMutation(`/api/students/${id}/reset-password`, {
    method: 'POST',
  }), [runMutation])

  const updateUserAccountStatus = useCallback((id: string, status: AccountStatus) => runMutation(`/api/students/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }), [runMutation])

  const addCategory = useCallback((category: BonusCategory) => runMutation('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ category }),
  }), [runMutation])

  const updateCategory = useCallback((category: BonusCategory) => runMutation(`/api/categories/${category.id}`, {
    method: 'PUT',
    body: JSON.stringify({ category }),
  }), [runMutation])

  const deleteCategory = useCallback((id: string) => runMutation(`/api/categories/${id}`, {
    method: 'DELETE',
  }), [runMutation])

  const updateSettings = useCallback((nextSettings: SystemSettings) => runMutation('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings: nextSettings }),
  }), [runMutation])

  const addApplication = useCallback((application: ApplicationInput) => runMutation('/api/applications', {
    method: 'POST',
    body: JSON.stringify({ application }),
  }), [runMutation])

  const deleteApplication = useCallback((id: string) => runMutation(`/api/applications/${id}`, {
    method: 'DELETE',
  }), [runMutation])

  const reviewApplication = useCallback((id: string, status: 'approved' | 'rejected', approvedScore: number, comment: string) => runMutation(`/api/applications/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, approvedScore, comment }),
  }), [runMutation])

  const exportData = useCallback(async () => {
    const response = await fetch('/api/export', { credentials: 'include' })
    if (!response.ok) throw new Error('导出失败')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `评分系统数据备份-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const importData = useCallback(async (raw: string) => {
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
  }, [applyResult])

  const resetDemoData = useCallback(async () => {
    const result = await apiRequest<ActionResult>('/api/reset-demo', { method: 'POST' })
    applyResult(result)
    return result.state?.settings || emptySettings
  }, [applyResult])

  const value: AppState = {
    students,
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
