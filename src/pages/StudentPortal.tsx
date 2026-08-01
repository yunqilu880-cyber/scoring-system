import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CalendarClock, FileImage, Send, Trash2, UploadCloud, X } from 'lucide-react'
import { useStore } from '../store'
import type { BonusApplication, MaterialAttachment } from '../types'
import { Badge, Button, EmptyState, PageHeader, Panel, SectionHeader, StatCard } from '../components/ui'

const statusLabels = {
  pending: '待审核',
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
  approved: '通过',
  rejected: '驳回',
}

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

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
  const activeCategories = categories.filter(category => category.active)
  const [categoryId, setCategoryId] = useState(activeCategories[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requestedScore, setRequestedScore] = useState(activeCategories[0]?.defaultScore ?? 0)
  const [attachments, setAttachments] = useState<MaterialAttachment[]>([])
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<MaterialAttachment | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const myApplications = useMemo(() => (
    applications
      .filter(application => application.studentId === currentUser?.studentId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  ), [applications, currentUser?.studentId])

  const ranking = currentUser?.studentId ? getStudentRanking(currentUser.studentId) : undefined
  const pendingCount = myApplications.filter(application => application.status === 'pending').length
  const approvedCount = myApplications.filter(application => application.status === 'approved').length
  const selectedCategory = getCategoryById(categoryId)

  const handleCategoryChange = (nextCategoryId: string) => {
    const nextCategory = getCategoryById(nextCategoryId)
    setCategoryId(nextCategoryId)
    setRequestedScore(nextCategory?.defaultScore ?? 0)
  }

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!student) {
      setMessage('没有找到当前用户档案')
      return
    }
    if (!categoryId || !title.trim()) {
      setMessage('请补全加分类型和项目名称')
      return
    }
    if (!attachments.length) {
      setMessage('请至少上传一张证明图片')
      return
    }

    addApplication({
      studentId: student.studentId,
      categoryId,
      title: title.trim(),
      description: description.trim(),
      requestedScore,
      attachments,
    })
    setTitle('')
    setDescription('')
    setAttachments([])
    setRequestedScore(selectedCategory?.defaultScore ?? 0)
    setMessage('申报已提交，等待审核')
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
        title="用户上传加分项"
        description={`${settings.academicYear} · ${student.department} · ${student.major}`}
        actions={
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 border border-slate-200 text-sm text-slate-600 shadow-sm">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          截止日期 {settings.submissionDeadline}
        </div>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '基础指标分', value: ranking?.baseScore.toFixed(1) ?? '0.0', tone: 'slate' as const },
          { label: '已认定加分', value: ranking?.bonusScore.toFixed(1) ?? '0.0', tone: 'emerald' as const },
          { label: '当前总分', value: ranking?.totalScore.toFixed(1) ?? '0.0', tone: 'cyan' as const },
          { label: '当前排名', value: ranking ? `第 ${ranking.rank} 名` : '-', tone: 'amber' as const },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>

      <div className="grid xl:grid-cols-[420px_1fr] gap-6">
        <form onSubmit={handleSubmit} className="ds-panel p-5 h-fit">
          <h2 className="font-bold text-slate-900 mb-4">新增申报</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">加分类型</span>
              <select
                value={categoryId}
                onChange={event => handleCategoryChange(event.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {activeCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">项目名称</span>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：年度技能评比二等奖"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">申请分数</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  max={selectedCategory?.maxScore}
                  value={requestedScore}
                  onChange={event => setRequestedScore(Number(event.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3">
                <p className="text-xs text-slate-500">类型上限</p>
                <p className="text-lg font-bold text-slate-900">{selectedCategory?.maxScore ?? 0} 分</p>
              </div>
            </div>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">申报说明</span>
              <textarea
                value={description}
                onChange={event => setDescription(event.target.value)}
                className="w-full min-h-24 px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="填写项目时间、证明单位、关键说明等信息"
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
            >
              <Send className="w-4 h-4" />
              提交审核
            </Button>
          </div>
        </form>

        <Panel className="overflow-hidden">
          <SectionHeader title="申报记录" description={`待审核 ${pendingCount} 项 · 已通过 ${approvedCount} 项`} />

          {myApplications.length === 0 ? (
            <EmptyState icon={FileImage} title="暂无申报记录" />
          ) : (
            <div className="divide-y divide-slate-100">
              {myApplications.map(application => (
                <ApplicationItem
                  key={application.id}
                  application={application}
                  categoryName={getCategoryById(application.categoryId)?.name ?? '未知类型'}
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
  categoryName,
  onPreview,
  onDelete,
}: {
  application: BonusApplication
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
          <p className="text-sm text-slate-500 mt-1">{categoryName} · 申请 {application.requestedScore} 分</p>
          {application.description && <p className="text-sm text-slate-600 mt-3 leading-6">{application.description}</p>}
          {application.reviewComment && (
            <p className="text-sm text-slate-600 mt-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
              审核意见：{application.reviewComment}
            </p>
          )}
          <ReviewTimeline application={application} />
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-xs text-slate-400">{formatDate(application.submittedAt)}</p>
          {application.status === 'approved' && <p className="text-lg font-bold text-emerald-600 mt-1">{application.approvedScore} 分</p>}
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

