export type UserRole = 'student' | 'admin'

export type AccountStatus = 'inactive' | 'active' | 'locked'

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export type ApplicationReviewAction = 'submitted' | 'approved' | 'rejected'

export interface CurrentUser {
  id: string
  role: UserRole
  name: string
  username: string
  studentId?: string
  mustChangePassword?: boolean
}

export interface StudentProfile {
  id: string
  name: string
  studentId: string
  department: string
  major: string
  grade: string
  academicScore: number
  moralScore: number
  practiceScore: number
  sportsScore: number
  failedCourses: number
  hasPunishment: boolean
  volunteerHours: number
  accountStatus: AccountStatus
  password: string
  mustChangePassword: boolean
  inviteCode?: string
  inviteUsedAt?: string
  activatedAt?: string
  lastLoginAt?: string
}

export interface ScoreWeights {
  academic: number
  moral: number
  practice: number
  sports: number
  bonusCap: number
}

export interface SystemSettings {
  academicYear: string
  submissionDeadline: string
  scoringMode: 'bonus' | 'teacherCompetition'
  weights: ScoreWeights
}

export interface ApplicationBatch {
  id: string
  name: string
  startDate: string
  endDate: string
  description: string
  active: boolean
}

export interface BonusCategory {
  id: string
  name: string
  group?: string
  defaultScore: number
  maxScore: number
  description: string
  requiredMaterials?: string
  order?: number
  active: boolean
}

export interface MaterialAttachment {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
  uploadedAt: string
}

export interface ScoreCalculationSnapshot {
  ruleId: string
  ruleName: string
  score: number
  summary: string
  fields: Record<string, string | number | boolean>
  warnings: string[]
}

export interface ApplicationReviewLog {
  id: string
  action: ApplicationReviewAction
  actorName: string
  comment: string
  score?: number
  createdAt: string
}

export interface BonusApplication {
  id: string
  applicationNo: string
  studentId: string
  batchId?: string
  categoryId: string
  title: string
  description: string
  requestedScore: number
  approvedScore: number
  status: ApplicationStatus
  attachments: MaterialAttachment[]
  calculation?: ScoreCalculationSnapshot
  reviewLogs: ApplicationReviewLog[]
  submittedAt: string
  reviewedAt?: string
  reviewerName?: string
  reviewComment?: string
}

export interface RankingResult {
  studentId: string
  studentName: string
  department: string
  major: string
  grade: string
  baseScore: number
  bonusScore: number
  selfScore: number
  totalScore: number
  rank: number
  categoryScores: Record<string, number>
  categorySelfScores: Record<string, number>
  approvedApplications: BonusApplication[]
  warnings: string[]
}
