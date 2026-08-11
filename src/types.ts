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
  weights: ScoreWeights
}

export interface BonusCategory {
  id: string
  name: string
  defaultScore: number
  maxScore: number
  description: string
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
  categoryId: string
  title: string
  description: string
  requestedScore: number
  approvedScore: number
  status: ApplicationStatus
  attachments: MaterialAttachment[]
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
  totalScore: number
  rank: number
  approvedApplications: BonusApplication[]
  warnings: string[]
}
