import { AlertCircle, CheckCircle2, ClipboardList, Clock3, Trophy, Users } from 'lucide-react'
import { useStore } from '../store'
import { Badge, PageHeader, Panel, SectionHeader, StatCard } from '../components/ui'

const statusLabels = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

export default function Dashboard() {
  const { applications, getCategoryById, getStudentByStudentId, rankings, settings, students } = useStore()
  const pendingCount = applications.filter(item => item.status === 'pending').length
  const approvedCount = applications.filter(item => item.status === 'approved').length
  const activeCount = students.filter(item => item.accountStatus === 'active').length
  const inactiveCount = students.filter(item => item.accountStatus === 'inactive').length
  const recentApplications = [...applications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6)
  const topStudents = rankings.slice(0, 5)

  const stats = [
    { label: '用户总数', value: students.length, icon: Users, tone: 'indigo' as const },
    { label: '已激活', value: activeCount, icon: CheckCircle2, tone: 'emerald' as const },
    { label: '未激活', value: inactiveCount, icon: AlertCircle, tone: 'amber' as const },
    { label: '申报总数', value: applications.length, icon: ClipboardList, tone: 'sky' as const },
    { label: '待审核', value: pendingCount, icon: Clock3, tone: 'amber' as const },
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
          总分 = 基础指标分 + 审核通过加分，单人加分上限 {settings.weights.bonusCap} 分
        </div>
        }
      />

      <Panel className="p-4">
        <div className="grid md:grid-cols-4 gap-3">
          {[
            ['1', '用户上传加分项', '填写项目名称、申请分和证明图片'],
            ['2', '审核员在线认定', '预览材料后通过、驳回或调整分值'],
            ['3', '规则自动核算', '按权重和加分上限生成总分'],
            ['4', '导出排名结果', '输出个人明细、总分和排名'],
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
                      <Badge>{getCategoryById(application.categoryId)?.name ?? '未知类型'}</Badge>
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
                    <span className="text-sm font-bold text-slate-900">{application.requestedScore} 分</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <SectionHeader title="当前排名前五" description="依据当前审核通过数据实时计算" />
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
                  <p className="font-bold text-slate-900">{row.totalScore.toFixed(1)}</p>
                  <p className="text-xs text-slate-500">加分 {row.bonusScore.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}


