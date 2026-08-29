import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Edit2, FileSearch, Search, X, XCircle } from 'lucide-react'
import { useStore } from '../store'
import type { ApplicationStatus, BonusApplication, BonusCategory, MaterialAttachment } from '../types'
import { Badge, Button, EmptyState, FilterBar, PageHeader, StatCard } from '../components/ui'

const statusOptions: Array<{ value: 'all' | ApplicationStatus; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待复评' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
]

const statusAccentStyles = {
  pending: 'before:bg-amber-400',
  approved: 'before:bg-emerald-500',
  rejected: 'before:bg-red-500',
}

const statusTones = {
  pending: 'amber',
  approved: 'emerald',
  rejected: 'red',
} as const

const statusLabels = {
  pending: '待复评',
  approved: '已通过',
  rejected: '已驳回',
}

const logActionLabels = {
  submitted: '提交',
  approved: '复评通过',
  rejected: '复评驳回',
}

const formatDate = (value?: string) => value
  ? new Date(value).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  : '-'

export default function ReviewCenter() {
  const { applications, batches, categories, getCategoryById, getStudentByStudentId, reviewApplication, settings } = useStore()
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('pending')
  const [batchFilter, setBatchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<MaterialAttachment | null>(null)
  const sortedCategories = useMemo(() => categories
    .filter(category => category.active)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)), [categories])
  const scoreableCategoryIds = useMemo(() => new Set(sortedCategories.map(category => category.id)), [sortedCategories])
  const visibleApplications = useMemo(() => applications.filter(application => (
    settings.scoringMode === 'bonus' || scoreableCategoryIds.has(application.categoryId)
  )), [applications, scoreableCategoryIds, settings.scoringMode])

  const filtered = useMemo(() => visibleApplications.filter(application => {
    const student = getStudentByStudentId(application.studentId)
    if (statusFilter !== 'all' && application.status !== statusFilter) return false
    if (batchFilter && application.batchId !== batchFilter) return false
    if (categoryFilter && application.categoryId !== categoryFilter) return false
    if (search.trim()) {
      const keyword = search.trim()
      const inStudent = student && `${student.name}${student.studentId}${student.department}${student.major}`.includes(keyword)
      const inApplication = `${application.title}${application.description}`.includes(keyword)
      if (!inStudent && !inApplication) return false
    }
    return true
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
    return b.submittedAt.localeCompare(a.submittedAt)
  }), [batchFilter, categoryFilter, getStudentByStudentId, search, statusFilter, visibleApplications])

  const stats = [
    { label: '待复评', value: visibleApplications.filter(item => item.status === 'pending').length, tone: 'amber' as const },
    { label: '已通过', value: visibleApplications.filter(item => item.status === 'approved').length, tone: 'emerald' as const },
    { label: '已驳回', value: visibleApplications.filter(item => item.status === 'rejected').length, tone: 'red' as const },
    { label: '申报总数', value: visibleApplications.length, tone: 'slate' as const },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="材料复评" description="复核申报人的自评分、证明图片和评分项目细则，确认最终复评分" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(item => (
          <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>

      <FilterBar>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="搜索姓名、用户编号、项目名称"
          />
        </div>
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value as 'all' | ApplicationStatus)}
          className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={batchFilter}
          onChange={event => setBatchFilter(event.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">全部批次</option>
          {batches.map(batch => (
            <option key={batch.id} value={batch.id}>{batch.name}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">全部评分项目</option>
          {sortedCategories.map(category => (
            <option key={category.id} value={category.id}>{category.group ? `${category.group} / ` : ''}{category.name}</option>
          ))}
        </select>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState icon={FileSearch} title="没有符合条件的申报记录" />
      ) : (
        <div className="space-y-3">
          {filtered.map(application => (
            <ReviewCard
              key={application.id}
              application={application}
              allApplications={applications}
              batchName={batches.find(batch => batch.id === application.batchId)?.name ?? '默认批次'}
              category={getCategoryById(application.categoryId)}
              student={getStudentByStudentId(application.studentId)}
              onPreview={setPreview}
              onReview={reviewApplication}
            />
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-blue-950/55 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg overflow-hidden max-w-4xl w-full">
            <div className="h-12 px-4 flex items-center justify-between border-b border-slate-100">
              <p className="text-sm font-medium text-slate-700 truncate">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded hover:bg-slate-100" aria-label="关闭预览">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="bg-blue-950 p-4 max-h-[78vh] overflow-auto flex justify-center">
              <img src={preview.dataUrl} alt={preview.name} className="max-w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewCard({
  application,
  allApplications,
  batchName,
  category,
  student,
  onPreview,
  onReview,
}: {
  application: BonusApplication
  allApplications: BonusApplication[]
  batchName: string
  category?: BonusCategory
  student?: ReturnType<typeof useStore>['students'][number]
  onPreview: (file: MaterialAttachment) => void
  onReview: (id: string, status: 'approved' | 'rejected', approvedScore: number, comment: string) => Promise<{ ok: boolean; message: string }>
}) {
  const [score, setScore] = useState(String(application.approvedScore || application.requestedScore))
  const [comment, setComment] = useState(application.reviewComment ?? '')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(application.status === 'pending')
  const categoryMaxScore = category?.maxScore ?? 0
  const approvedByOthers = allApplications
    .filter(item => (
      item.id !== application.id &&
      item.studentId === application.studentId &&
      item.categoryId === application.categoryId &&
      item.status === 'approved'
    ))
    .reduce((sum, item) => sum + item.approvedScore, 0)
  const remainingReviewScore = Math.max(0, categoryMaxScore - approvedByOthers)

  const approve = async () => {
    const numericScore = Number(score)
    if (!Number.isFinite(numericScore) || numericScore <= 0) {
      setMessage('通过时复评分必须大于 0')
      return
    }
    if (numericScore > remainingReviewScore) {
      setMessage(`该评分项目剩余可认定 ${remainingReviewScore.toFixed(2)} 分，请调整复评分`)
      return
    }
    if (!window.confirm(`确认通过该申报并认定 ${numericScore} 分？`)) return
    setSubmitting(true)
    const result = await onReview(application.id, 'approved', numericScore, comment)
    setSubmitting(false)
    setMessage(result.message)
    if (result.ok) setIsEditing(false)
  }

  const reject = async () => {
    if (!comment.trim()) {
      setMessage('驳回时必须填写复评意见')
      return
    }
    if (!window.confirm('确认驳回该申报？驳回原因会展示给申报人。')) return
    setSubmitting(true)
    const result = await onReview(application.id, 'rejected', 0, comment.trim())
    setSubmitting(false)
    setMessage(result.message)
    if (result.ok) setIsEditing(false)
  }

  return (
    <article className={`relative bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm transition-all before:absolute before:inset-y-0 before:left-0 before:w-1 hover:-translate-y-0.5 hover:shadow-md ${statusAccentStyles[application.status]}`}>
      <div className="p-5">
        <div className="flex flex-col xl:flex-row xl:items-start gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTones[application.status]}>{statusLabels[application.status]}</Badge>
              <Badge>{application.applicationNo}</Badge>
              <Badge>{batchName}</Badge>
              <Badge>{category?.group ? `${category.group} / ` : ''}{category?.name ?? '未知项目'}</Badge>
              <span className="text-xs text-slate-400">提交于 {formatDate(application.submittedAt)}</span>
            </div>
            <h2 className="font-bold text-slate-900 mt-3">{application.title}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {student ? `${student.name} · ${student.studentId} · ${student.department} · ${student.major}` : application.studentId}
            </p>
            {application.description && <p className="text-sm text-slate-600 leading-6 mt-3">{application.description}</p>}
            {category && (
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-800">评分细则：{category.description || '管理员暂未填写细则。'}</p>
                {category.requiredMaterials && <p className="mt-1 text-blue-700">材料要求：{category.requiredMaterials}</p>}
              </div>
            )}
            {application.calculation && (
              <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-emerald-800">用户自动算分：{application.calculation.score.toFixed(2)} 分</p>
                <p className="mt-1">{application.calculation.summary}</p>
                {application.calculation.warnings.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {application.calculation.warnings.map(warning => (
                      <p key={warning} className="text-red-600">{warning}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-56">
            <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-3">
              <p className="text-xs text-slate-500">自评</p>
              <p className="text-xl font-bold text-slate-900">{application.requestedScore}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500">上限</p>
              <p className="text-xl font-bold text-slate-900">{categoryMaxScore}</p>
            </div>
            <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-3">
              <p className="text-xs text-slate-500">复评</p>
              <p className="text-xl font-bold text-indigo-600">{application.status === 'approved' ? application.approvedScore : '-'}</p>
            </div>
            <div className="rounded-lg bg-emerald-50/70 border border-emerald-100 p-3">
              <p className="text-xs text-slate-500">剩余</p>
              <p className="text-xl font-bold text-emerald-600">{remainingReviewScore.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {application.attachments.length > 0 ? (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {application.attachments.map(file => (
              <button
                key={file.id}
                type="button"
                onClick={() => onPreview(file)}
                className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 transition-colors hover:border-blue-300"
              >
                <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-500">
            该演示记录未附带图片，用户新提交的记录会展示图片预览。
          </div>
        )}

        {isEditing ? (
          <div className="mt-5 rounded-lg bg-slate-50/80 border border-slate-200 p-3 grid lg:grid-cols-[150px_1fr_auto] gap-3 items-start">
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">复评分数</span>
              <input
                type="number"
                min="0"
                step="0.01"
                max={remainingReviewScore}
                value={score}
                onChange={event => setScore(event.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">复评意见</span>
              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="通过时可简要说明复评依据，驳回时填写原因"
              />
            </label>
            <div className="flex flex-wrap gap-2 lg:pt-5">
              <Button
                type="button"
                onClick={() => void approve()}
                variant="success"
                className="flex-1 sm:flex-none"
                disabled={submitting}
              >
                <CheckCircle2 className="w-4 h-4" />
                通过
              </Button>
              <Button
                type="button"
                onClick={() => void reject()}
                variant="danger"
                className="flex-1 sm:flex-none"
                disabled={submitting}
              >
                <XCircle className="w-4 h-4" />
                驳回
              </Button>
            </div>
            {message && (
              <p className={`lg:col-span-3 text-sm ${message.includes('已') ? 'text-emerald-700' : 'text-red-600'}`}>
                {message}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-500">
                <Clock3 className="w-4 h-4" />
                {application.reviewerName ?? '管理员'} · {formatDate(application.reviewedAt)}
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4" />
                修改复评
              </Button>
            </div>
            <p className="mt-2">{application.reviewComment || '无复评意见'}</p>
            {message && <p className="mt-2 text-emerald-700">{message}</p>}
          </div>
        )}

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {application.reviewLogs.map(log => (
            <div key={log.id} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">{logActionLabels[log.action]}</span>
                <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{log.actorName} · {log.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

