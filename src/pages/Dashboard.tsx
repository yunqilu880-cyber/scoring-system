import { AlertCircle, CheckCircle2, ClipboardList, Clock3, Trophy, Users } from 'lucide-react'
import { useStore } from '../store'
import { Badge, PageHeader, Panel, SectionHeader, StatCard } from '../components/ui'

const statusLabels = {
  pending: '待复评',
  approved: '已通过',
  rejected: '已驳回',
}

const formatScore = (value: number) => value.toFixed(2)

export default function Dashboard() {
  const { applications, categories, getCategoryById, getStudentByStudentId, rankings, settings, students } = useStore()
  const activeCategoryIds = new Set(categories.filter(category => category.active).map(category => category.id))
  const visibleApplications = applications.filter(application => (
    settings.scoringMode === 'bonus' || activeCategoryIds.has(application.categoryId)
  ))
  const pendingCount = visibleApplications.filter(item => item.status === 'pending').length
  const approvedCount = visibleApplications.filter(item => item.status === 'approved').length
  const activeCount = students.filter(item => item.accountStatus === 'active').length
  const inactiveCount = students.filter(item => item.accountStatus === 'inactive').length
  const recentApplications = [...visibleApplications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6)
  const topStudents = rankings.slice(0, 5)

  const stats = [
    { label: '申报人数', value: students.length, icon: Users, tone: 'indigo' as const },
    { label: '已激活', value: activeCount, icon: CheckCircle2, tone: 'emerald' as const },
    { label: '未激活', value: inactiveCount, icon: AlertCircle, tone: 'amber' as const },
    { label: '申报总数', value: visibleApplications.length, icon: ClipboardList, tone: 'sky' as const },
    { label: '待复评', value: pendingCount, icon: Clock3, tone: 'amber' as const },
    { label: '已通过', value: approvedCount, icon: Trophy, tone: 'violet' as const },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Review Dashboard"
        title="工作台"
        description={`${settings.academicYear} · 申报截止 ${settings.submissionDeadline}`}
        actions={
        <div className="text-sm text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
          总分 = 复评通过的各评分项目汇总，按单项满分和总分上限 {settings.weights.bonusCap} 分控制
        </div>
        }
      />

      <Panel className="p-4">
        <div className="grid md:grid-cols-4 gap-3">
          {[
            ['1', '申报人逐项自评', '选择评分项目，填写自评分并上传证明图片'],
            ['2', '审核端材料复评', '预览材料后通过、驳回或调整复评分'],
            ['3', '规则自动核算', '按项目满分和总分上限生成复评总分'],
            ['4', '导出排名结果', '输出个人明细、分项得分和排名'],
          ].map(([step, title, desc]) => (
            <div key={step} className="rounded-lg bg-slate-50/90 border border-slate-100 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/30">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-blue-200">{step}</div>
              <p className="mt-3 font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-xs text-slate-500 leading-5">{desc}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map(item => (
          <StatCard key={item.label} label={item.label} value={item.value} icon={item.icon} tone={item.tone} />
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_420px] gap-6">
        <Panel className="overflow-hidden">
          <SectionHeader title="最新申报" description="按提交时间倒序展示最近 6 条" />
          <div className="divide-y divide-slate-100">
            {recentApplications.map(application => {
              const student = getStudentByStudentId(application.studentId)
              return (
                <div key={application.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-slate-50/70">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{application.title}</p>
                      <Badge tone="cyan">{application.applicationNo}</Badge>
                      <Badge>{getCategoryById(application.categoryId)?.name ?? '未知项目'}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {student ? `${student.name} · ${student.studentId} · ${student.department}` : application.studentId}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold ${
                      application.status === 'approved' ? 'text-emerald-600' :
                      application.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {statusLabels[application.status]}
                    </span>
                    <span className="text-sm font-bold text-slate-900">自评 {application.requestedScore} 分</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <SectionHeader title="当前排名前五" description="依据当前复评通过数据实时计算" />
          <div className="divide-y divide-slate-100">
            {topStudents.map(row => (
              <div key={row.studentId} className="px-5 py-4 flex items-center justify-between transition-colors hover:bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                    row.rank <= 3 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {row.rank}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{row.studentName}</p>
                    <p className="text-xs text-slate-500">{row.department}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{formatScore(row.totalScore)}</p>
                  <p className="text-xs text-slate-500">自评 {formatScore(row.selfScore)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}


