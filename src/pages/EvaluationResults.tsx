import { Fragment, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Download, Search, Trophy } from 'lucide-react'
import { useStore } from '../store'
import { Button, EmptyState, FilterBar, PageHeader, Panel, StatCard } from '../components/ui'
import { downloadCsv } from '../utils/csv'

const formatScore = (value: number) => value.toFixed(2)

export default function EvaluationResults() {
  const { categories, getCategoryById, rankings, settings } = useStore()
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [expandedId, setExpandedId] = useState('')

  const scoreCategories = useMemo(() => categories
    .filter(category => category.active)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)), [categories])
  const departments = useMemo(() => Array.from(new Set(rankings.map(row => row.department))), [rankings])
  const filtered = rankings.filter(row => {
    const keyword = search.trim()
    if (keyword && !`${row.studentName}${row.studentId}${row.major}`.includes(keyword)) return false
    if (departmentFilter && row.department !== departmentFilter) return false
    return true
  })

  const averageTotal = rankings.length
    ? formatScore(rankings.reduce((sum, row) => sum + row.totalScore, 0) / rankings.length)
    : '0.00'
  const approvedTotal = rankings.reduce((sum, row) => sum + row.approvedApplications.length, 0)

  const exportResults = () => {
    const categoryHeader = scoreCategories.map(category => `${category.group ? `${category.group}-` : ''}${category.name}`)
    const header = ['排名', '姓名', '用户编号', '所属单位', '任教学科/岗位', '竞聘类别', '自评分', '复评分', ...categoryHeader, '通过项目', '限制提醒']
    const rows = filtered.map(row => [
      row.rank,
      row.studentName,
      row.studentId,
      row.department,
      row.major,
      row.grade,
      row.selfScore,
      row.totalScore,
      ...scoreCategories.map(category => row.categoryScores[category.id] ?? 0),
      row.approvedApplications.map(app => `${app.applicationNo}-${getCategoryById(app.categoryId)?.name ?? '未知项目'}-${app.title}-${app.approvedScore}分`).join('；'),
      row.warnings.join('；'),
    ])
    downloadCsv('专业技术岗位竞聘评分排名.csv', [header, ...rows])
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="排名结果"
        description={`${settings.academicYear} · 仅统计复评通过的评分项目`}
        actions={
        <Button
          onClick={exportResults}
          className="w-full lg:w-auto"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '参评人数', value: rankings.length, tone: 'slate' as const },
          { label: '平均复评分', value: averageTotal, tone: 'cyan' as const },
          { label: '通过材料', value: approvedTotal, tone: 'emerald' as const },
          { label: '总分上限', value: settings.weights.bonusCap, tone: 'amber' as const },
        ].map(item => (
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
            placeholder="搜索姓名、用户编号、任教学科"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={event => setDepartmentFilter(event.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">全部单位</option>
          {departments.map(department => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>
      </FilterBar>

      <Panel className="overflow-hidden">
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.map(row => {
            const isExpanded = expandedId === row.studentId
            return (
              <div key={row.studentId} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                    row.rank <= 3 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {row.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{row.studentName}</p>
                        <p className="text-xs text-slate-500 mt-1">{row.studentId} · {row.grade}</p>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{formatScore(row.totalScore)}</p>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{row.department}</p>
                    <p className="text-xs text-slate-500 mt-1">{row.major}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                    <p className="text-xs text-slate-500">自评</p>
                    <p className="text-sm font-semibold text-slate-800">{formatScore(row.selfScore)}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2 text-center">
                    <p className="text-xs text-emerald-700">复评</p>
                    <p className="text-sm font-semibold text-emerald-700">{formatScore(row.totalScore)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                    <p className="text-xs text-slate-500">提醒</p>
                    <p className="text-sm font-semibold text-slate-800">{row.warnings.length ? `${row.warnings.length}项` : '无'}</p>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedId(isExpanded ? '' : row.studentId)}
                  className="mt-4 w-full h-9 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium flex items-center justify-center gap-1 hover:bg-blue-100"
                >
                  查看通过项目 {row.approvedApplications.length} 项
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {row.approvedApplications.length === 0 ? (
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-sm text-slate-500">暂无复评通过的评分项目</div>
                    ) : row.approvedApplications.map(application => (
                      <div key={application.id} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{application.title}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {application.applicationNo} · {getCategoryById(application.categoryId)?.name ?? '未知项目'}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-emerald-600 shrink-0">{application.approvedScore} 分</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium w-20">排名</th>
                <th className="px-4 py-3 font-medium">申报人</th>
                <th className="px-4 py-3 font-medium">单位/类别</th>
                <th className="px-4 py-3 font-medium">自评分</th>
                <th className="px-4 py-3 font-medium">复评分</th>
                <th className="px-4 py-3 font-medium">通过项目</th>
                <th className="px-4 py-3 font-medium">提醒</th>
                <th className="px-4 py-3 font-medium text-right">明细</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(row => {
                const isExpanded = expandedId === row.studentId
                return (
                  <Fragment key={row.studentId}>
                    <tr key={row.studentId} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                          row.rank <= 3 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {row.rank}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{row.studentName}</p>
                        <p className="text-xs text-slate-500">{row.studentId} · {row.grade}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{row.department}</p>
                        <p className="text-xs text-slate-500">{row.major}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatScore(row.selfScore)}</td>
                      <td className="px-4 py-3 text-slate-900 font-bold">{formatScore(row.totalScore)}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold">{row.approvedApplications.length} 项</td>
                      <td className="px-4 py-3">
                        {row.warnings.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {row.warnings.length} 项
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">无</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedId(isExpanded ? '' : row.studentId)}
                          className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800"
                        >
                          查看
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.studentId}-details`}>
                        <td colSpan={8} className="px-4 py-4 bg-slate-50">
                          {row.approvedApplications.length === 0 ? (
                            <div className="text-sm text-slate-500">暂无复评通过的评分项目</div>
                          ) : (
                            <div className="space-y-3">
                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                {scoreCategories
                                  .filter(category => row.categoryScores[category.id])
                                  .map(category => (
                                    <div key={category.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                                      <p className="text-xs text-slate-500">{category.name}</p>
                                      <p className="text-sm font-bold text-slate-900 mt-1">{formatScore(row.categoryScores[category.id])}</p>
                                    </div>
                                  ))}
                              </div>
                              <div className="grid lg:grid-cols-2 gap-3">
                              {row.approvedApplications.map(application => (
                                <div key={application.id} className="rounded-lg bg-white border border-slate-200 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-slate-900">{application.title}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {application.applicationNo} · {getCategoryById(application.categoryId)?.name ?? '未知项目'}
                                      </p>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600">{application.approvedScore} 分</span>
                                  </div>
                                  {application.reviewComment && (
                                    <p className="text-sm text-slate-600 mt-3 leading-6">{application.reviewComment}</p>
                                  )}
                                </div>
                              ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && <EmptyState icon={Trophy} title="暂无排名数据" />}
      </Panel>
    </div>
  )
}


