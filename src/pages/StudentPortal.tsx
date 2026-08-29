import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CalendarClock, FileImage, Send, Trash2, UploadCloud, X } from 'lucide-react'
import { useStore } from '../store'
import type { BonusApplication, MaterialAttachment, ScoreCalculationSnapshot } from '../types'
import { Badge, Button, EmptyState, PageHeader, Panel, SectionHeader, StatCard } from '../components/ui'
import ScoreRuleCalculator from '../components/ScoreRuleCalculator'
import { getScoreRule } from '../scoringRules'

const statusLabels = {
  pending: '待复评',
  approved: '已通过',
  rejected: '已驳回',
}

const statusTones = {
  pending: 'amber',
  approved: 'emerald',
  rejected: 'red',
} as const

const logActionLabels = {
  submitted: '提交',
  approved: '复评通过',
  rejected: '复评驳回',
}

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const formatScore = (value: number) => value.toFixed(2)

const readImageFile = (file: File): Promise<MaterialAttachment> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    resolve({
      id: `file-${Date.now()}-${file.name}`,
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: String(reader.result),
      uploadedAt: new Date().toISOString(),
    })
  }
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.readAsDataURL(file)
})

export default function StudentPortal() {
  const {
    applications,
    batches,
    categories,
    currentUser,
    addApplication,
    deleteApplication,
    getCategoryById,
    getStudentByStudentId,
    getStudentRanking,
    settings,
  } = useStore()
  const student = currentUser?.studentId ? getStudentByStudentId(currentUser.studentId) : undefined
  const activeBatches = batches.filter(batch => batch.active)
  const activeCategories = useMemo(() => categories
    .filter(category => category.active)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)), [categories])
  const scoreableCategoryIds = useMemo(() => new Set(activeCategories.map(category => category.id)), [activeCategories])
  const firstActiveBatch = activeBatches[0]
  const firstActiveCategory = activeCategories[0]
  const [batchId, setBatchId] = useState(activeBatches[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(activeCategories[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requestedScore, setRequestedScore] = useState<number | null>(null)
  const [calculation, setCalculation] = useState<ScoreCalculationSnapshot | null>(null)
  const [attachments, setAttachments] = useState<MaterialAttachment[]>([])
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<MaterialAttachment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const myApplications = useMemo(() => (
    applications
      .filter(application => (
        application.studentId === currentUser?.studentId &&
        (settings.scoringMode === 'bonus' || scoreableCategoryIds.has(application.categoryId))
      ))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  ), [applications, currentUser?.studentId, scoreableCategoryIds, settings.scoringMode])

  const ranking = currentUser?.studentId ? getStudentRanking(currentUser.studentId) : undefined
  const pendingCount = myApplications.filter(application => application.status === 'pending').length
  const approvedCount = myApplications.filter(application => application.status === 'approved').length
  const effectiveBatchId = activeBatches.some(batch => batch.id === batchId) ? batchId : firstActiveBatch?.id ?? ''
  const effectiveCategoryId = activeCategories.some(category => category.id === categoryId) ? categoryId : firstActiveCategory?.id ?? ''
  const selectedCategory = getCategoryById(effectiveCategoryId)
  const selectedBatch = activeBatches.find(batch => batch.id === effectiveBatchId)
  const selectedRule = getScoreRule(effectiveCategoryId)
  const effectiveRequestedScore = selectedRule ? calculation?.score ?? 0 : requestedScore ?? selectedCategory?.defaultScore ?? 0
  const selectedCategoryApplications = myApplications.filter(application => (
    application.categoryId === effectiveCategoryId && application.status !== 'rejected'
  ))
  const selectedCategorySelfTotal = selectedCategoryApplications.reduce((sum, application) => sum + application.requestedScore, 0)
  const selectedCategoryApprovedTotal = selectedCategoryApplications
    .filter(application => application.status === 'approved')
    .reduce((sum, application) => sum + application.approvedScore, 0)
  const selectedCategoryRemainingSelf = Math.max(0, (selectedCategory?.maxScore ?? 0) - selectedCategorySelfTotal)

  const handleCategoryChange = (nextCategoryId: string) => {
    const nextCategory = getCategoryById(nextCategoryId)
    setCategoryId(nextCategoryId)
    setRequestedScore(nextCategory?.defaultScore ?? 0)
    setCalculation(null)
  }

  const handleCalculationChange = useCallback((nextCalculation: ScoreCalculationSnapshot | null) => {
    setCalculation(nextCalculation)
  }, [])

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const invalid = files.find(file => !file.type.startsWith('image/'))
    if (invalid) {
      setMessage('请上传图片格式的证明材料')
      return
    }

    const oversized = files.find(file => file.size > 2.5 * 1024 * 1024)
    if (oversized) {
      setMessage('单张图片建议控制在 2.5MB 以内')
      return
    }

    try {
      const nextAttachments = await Promise.all(files.map(readImageFile))
      setAttachments(prev => [...prev, ...nextAttachments])
      setMessage('')
    } catch {
      setMessage('图片读取失败，请重新选择')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!student) {
      setMessage('没有找到当前用户档案')
      return
    }
    if (!effectiveBatchId || !effectiveCategoryId || !title.trim()) {
      setMessage('请补全申报批次、评分项目和项目名称')
      return
    }
    if (effectiveRequestedScore <= 0) {
      setMessage('自评分必须大于 0')
      return
    }
    if (effectiveRequestedScore > selectedCategoryRemainingSelf) {
      setMessage(`该评分项目剩余可申报 ${formatScore(selectedCategoryRemainingSelf)} 分，请调整自评分`)
      return
    }
    if (!attachments.length) {
      setMessage('请至少上传一张证明图片')
      return
    }

    setSubmitting(true)
    const result = await addApplication({
      studentId: student.studentId,
      batchId: effectiveBatchId,
      categoryId: effectiveCategoryId,
      title: title.trim(),
      description: description.trim(),
      requestedScore: effectiveRequestedScore,
      calculation: calculation ?? undefined,
      attachments,
    })
    setSubmitting(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setTitle('')
    setDescription('')
    setAttachments([])
    setRequestedScore(null)
    setCalculation(null)
    setMessage('申报已提交，等待复评')
  }

  if (!student) {
    return (
      <Panel className="p-8">
        <h1 className="text-xl font-bold text-slate-900">未找到用户档案</h1>
        <p className="text-sm text-slate-500 mt-2">请联系管理员导入或修正用户基础信息。</p>
      </Panel>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="竞聘评分申报"
        description={`${settings.academicYear} · ${student.department} · ${student.major || '未填写学科/岗位'} · ${student.grade || '未填写竞聘类别'}`}
        actions={
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 border border-slate-200 text-sm text-slate-600 shadow-sm">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          截止日期 {settings.submissionDeadline}
        </div>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '自评分合计', value: formatScore(ranking?.selfScore ?? 0), tone: 'slate' as const },
          { label: '复评分合计', value: formatScore(ranking?.bonusScore ?? 0), tone: 'emerald' as const },
          { label: '待复评项目', value: pendingCount, tone: 'cyan' as const },
          { label: '当前排名', value: ranking ? `第 ${ranking.rank} 名` : '-', tone: 'amber' as const },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>

      <div className="grid xl:grid-cols-[420px_1fr] gap-6">
        <form onSubmit={handleSubmit} className="ds-panel p-5 h-fit">
          <h2 className="font-bold text-slate-900 mb-4">新增评分项目申报</h2>
          <div className="space-y-4">
            {activeBatches.length === 0 ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                当前暂无启用的申报批次，请联系审核端管理员添加或启用批次。
              </div>
            ) : (
              <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">申报批次</span>
                <select
                  value={effectiveBatchId}
                  onChange={event => setBatchId(event.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {activeBatches.map(batch => (
                    <option key={batch.id} value={batch.id}>{batch.name}</option>
                  ))}
                </select>
                {selectedBatch && (
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedBatch.startDate || '未设开始'} 至 {selectedBatch.endDate || '未设结束'} · {selectedBatch.description || '暂无批次说明'}
                  </p>
                )}
              </label>
            )}

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">评分项目</span>
              <select
                value={effectiveCategoryId}
                onChange={event => handleCategoryChange(event.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {activeCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.group ? `${category.group} / ` : ''}{category.name}</option>
                ))}
              </select>
            </label>

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">评分项目细则</p>
                <span className="text-xs text-blue-700">默认 {selectedCategory?.defaultScore ?? 0} 分 / 满分 {selectedCategory?.maxScore ?? 0} 分</span>
              </div>
              <p className="text-xs text-slate-600 leading-5 mt-2">
                {selectedCategory?.description || '管理员暂未填写说明，请按实际证明材料填写申报内容。'}
              </p>
              {selectedCategory?.requiredMaterials && (
                <p className="text-xs text-blue-700 leading-5 mt-2">
                  材料要求：{selectedCategory.requiredMaterials}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/80 px-2 py-2 ring-1 ring-blue-100">
                  <p className="text-[11px] text-slate-500">已自评</p>
                  <p className="text-sm font-bold text-slate-900">{formatScore(selectedCategorySelfTotal)}</p>
                </div>
                <div className="rounded-lg bg-white/80 px-2 py-2 ring-1 ring-blue-100">
                  <p className="text-[11px] text-slate-500">已认定</p>
                  <p className="text-sm font-bold text-emerald-600">{formatScore(selectedCategoryApprovedTotal)}</p>
                </div>
                <div className="rounded-lg bg-white/80 px-2 py-2 ring-1 ring-blue-100">
                  <p className="text-[11px] text-slate-500">剩余可报</p>
                  <p className="text-sm font-bold text-blue-700">{formatScore(selectedCategoryRemainingSelf)}</p>
                </div>
              </div>
            </div>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">项目名称</span>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：县级优秀教师 / 本科学历 / 工作年限认定"
              />
            </label>

            {selectedRule && selectedCategory ? (
              <ScoreRuleCalculator
                categoryId={effectiveCategoryId}
                maxScore={selectedCategory.maxScore}
                onChange={handleCalculationChange}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">自评分</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={selectedCategory?.maxScore}
                    value={effectiveRequestedScore}
                    onChange={event => setRequestedScore(Number(event.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </label>
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3">
                  <p className="text-xs text-slate-500">本项满分</p>
                  <p className="text-lg font-bold text-slate-900">{selectedCategory?.maxScore ?? 0} 分</p>
                </div>
              </div>
            )}

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">申报说明</span>
              <textarea
                value={description}
                onChange={event => setDescription(event.target.value)}
                className="w-full min-h-24 px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="填写取得时间、级别、本人排名、证书编号或其他需要说明的信息"
              />
            </label>

            <div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full min-h-24 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 text-sm text-slate-600 transition-colors"
              >
                <UploadCloud className="w-6 h-6 text-blue-600" />
                上传证明图片
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map(file => (
                  <div key={file.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                    <button type="button" onClick={() => setPreview(file)} className="w-full h-full">
                      <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter(item => item.id !== file.id))}
                      className="absolute top-1 right-1 p-1 rounded bg-white/90 text-slate-500 hover:text-red-600"
                      aria-label="移除图片"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {message && (
              <div className="text-sm px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                {message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || activeBatches.length === 0 || selectedCategoryRemainingSelf <= 0}
            >
              <Send className="w-4 h-4" />
              {submitting ? '提交中...' : '提交申报'}
            </Button>
          </div>
        </form>

        <Panel className="overflow-hidden">
          <SectionHeader title="申报记录" description={`待复评 ${pendingCount} 项 · 已通过 ${approvedCount} 项`} />

          {myApplications.length === 0 ? (
            <EmptyState icon={FileImage} title="暂无申报记录" />
          ) : (
            <div className="divide-y divide-slate-100">
              {myApplications.map(application => (
                <ApplicationItem
                  key={application.id}
                  application={application}
                  batchName={batches.find(batch => batch.id === application.batchId)?.name ?? '默认批次'}
                  categoryName={getCategoryById(application.categoryId)?.name ?? '未知项目'}
                  onPreview={setPreview}
                  onDelete={deleteApplication}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

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

function ApplicationItem({
  application,
  batchName,
  categoryName,
  onPreview,
  onDelete,
}: {
  application: BonusApplication
  batchName: string
  categoryName: string
  onPreview: (file: MaterialAttachment) => void
  onDelete: (id: string) => void
}) {
  const canDelete = application.status !== 'approved'

  return (
    <div className="p-5 transition-colors hover:bg-slate-50/70">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{application.title}</h3>
            <Badge tone={statusTones[application.status]}>{statusLabels[application.status]}</Badge>
            <Badge>{application.applicationNo}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">{batchName} · {categoryName} · 自评 {application.requestedScore} 分</p>
          {application.description && <p className="text-sm text-slate-600 mt-3 leading-6">{application.description}</p>}
          {application.calculation && (
            <div className="text-sm text-slate-600 mt-3 px-3 py-2 bg-blue-50/70 rounded-lg border border-blue-100">
              <span className="font-medium text-blue-800">计分过程：</span>{application.calculation.summary}
            </div>
          )}
          {application.reviewComment && (
            <p className="text-sm text-slate-600 mt-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
              复评意见：{application.reviewComment}
            </p>
          )}
          <ReviewTimeline application={application} />
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-xs text-slate-400">{formatDate(application.submittedAt)}</p>
          {application.status === 'approved' && <p className="text-lg font-bold text-emerald-600 mt-1">复评 {application.approvedScore} 分</p>}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(application.id)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          )}
        </div>
      </div>

      {application.attachments.length > 0 && (
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {application.attachments.map(file => (
            <button
              key={file.id}
              type="button"
              onClick={() => onPreview(file)}
              className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 transition-colors hover:border-blue-300"
            >
              <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewTimeline({ application }: { application: BonusApplication }) {
  return (
    <div className="mt-4 grid sm:grid-cols-2 gap-2">
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
  )
}

