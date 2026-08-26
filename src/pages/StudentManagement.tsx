import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download, Edit2, FileSpreadsheet, KeyRound, Lock, Plus, Search, Trash2, Unlock, Upload, X } from 'lucide-react'
import { useStore } from '../store'
import type { StudentProfile } from '../types'
import { Badge, Button, EmptyState, FilterBar, PageHeader, Panel, StatCard } from '../components/ui'
import { downloadCsv, parseCsv } from '../utils/csv'

const defaultDepartments = ['石马镇中心小学', '石马镇第二小学', '石马镇第三小学']
const defaultCompetitionTypes = ['中级首聘', '高级首聘', '层级内晋升']

const emptyStudent: StudentProfile = {
  id: '',
  name: '',
  studentId: '',
  department: '',
  major: '',
  grade: '',
  academicScore: 0,
  moralScore: 0,
  practiceScore: 0,
  sportsScore: 0,
  failedCourses: 0,
  hasPunishment: false,
  volunteerHours: 0,
  accountStatus: 'inactive',
  password: '123456',
  mustChangePassword: true,
}

const accountStatusLabels = {
  inactive: '未激活',
  active: '已激活',
  locked: '已锁定',
}

const accountStatusTones = {
  inactive: 'amber',
  active: 'emerald',
  locked: 'red',
} as const

const toText = (value: unknown) => String(value ?? '').trim()
const toNumber = (value: unknown) => Number.parseFloat(toText(value)) || 0
const parseBooleanText = (value: unknown) => ['是', '有', 'true', '1', '存在'].includes(toText(value).toLowerCase())

const studentImportHeader = ['姓名', '用户编号', '所属单位', '任教学科/岗位', '竞聘类别', '限制项数', '参评限制记录']
const studentTemplateRows = [
  studentImportHeader,
  ['张老师', 'JS2026001', '石马镇中心小学', '语文', '中级首聘', 0, '否'],
  ['李老师', 'JS2026002', '石马镇中心小学', '数学', '高级首聘', 0, '否'],
  ['王老师', 'JS2026003', '石马镇第二小学', '英语', '层级内晋升', 1, '是'],
]

export default function StudentManagement() {
  const {
    addStudent,
    deleteStudent,
    importStudents,
    resetUserPassword,
    students,
    updateStudent,
    updateUserAccountStatus,
  } = useStore()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<StudentProfile | null>(null)
  const [form, setForm] = useState<StudentProfile>(emptyStudent)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importMessage, setImportMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const departments = useMemo(() => {
    const values = students.map(student => student.department).filter(Boolean)
    return Array.from(new Set([...defaultDepartments, ...values]))
  }, [students])

  const filtered = students.filter(student => {
    const keyword = search.trim()
    if (keyword && !`${student.name}${student.studentId}${student.department}${student.major}${student.grade}`.includes(keyword)) return false
    if (deptFilter && student.department !== deptFilter) return false
    return true
  })

  const activeCount = students.filter(student => student.accountStatus === 'active').length
  const inactiveCount = students.filter(student => student.accountStatus === 'inactive').length
  const lockedCount = students.filter(student => student.accountStatus === 'locked').length

  const openAdd = () => {
    setEditing(null)
    setForm({
      ...emptyStudent,
      id: `stu-${Date.now()}`,
      department: departments[0] || defaultDepartments[0],
      grade: defaultCompetitionTypes[0],
    })
    setShowModal(true)
  }

  const openEdit = (student: StudentProfile) => {
    setEditing(student)
    setForm({ ...student })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.studentId.trim()) return
    const result = editing ? await updateStudent(form) : await addStudent(form)
    setImportMessage(result.message)
    if (result.ok) setShowModal(false)
  }

  const parseRows = async (rows: unknown[][]) => {
    const nextStudents: StudentProfile[] = []
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index]
      const name = toText(row[0])
      const studentId = toText(row[1])
      if (!name || !studentId) continue
      nextStudents.push({
        id: `stu-${Date.now()}-${index}`,
        name,
        studentId,
        department: toText(row[2]),
        major: toText(row[3]),
        grade: toText(row[4]),
        academicScore: 0,
        moralScore: 0,
        practiceScore: 0,
        sportsScore: 0,
        failedCourses: toNumber(row[5]),
        volunteerHours: 0,
        hasPunishment: parseBooleanText(row[6]),
        accountStatus: 'inactive',
        password: '123456',
        mustChangePassword: true,
      })
    }
    const result = await importStudents(nextStudents)
    setImportMessage(result.message || `已导入或更新 ${nextStudents.length} 名申报人`)
  }

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()

    reader.onload = loaded => {
      const text = String(loaded.target?.result ?? '')
      void parseRows(parseCsv(text))
    }
    reader.readAsText(file)

    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(student => student.id)))
  }

  const batchDelete = async () => {
    await Promise.all(Array.from(selectedIds).map(id => deleteStudent(id)))
    setSelectedIds(new Set())
  }

  const exportStudents = () => {
    const source = selectedIds.size ? students.filter(student => selectedIds.has(student.id)) : filtered
    const header = ['姓名', '用户编号', '所属单位', '任教学科/岗位', '竞聘类别', '账号状态', '邀请码', '限制项数', '参评限制记录', '激活时间', '最后登录']
    const rows = source.map(student => [
      student.name,
      student.studentId,
      student.department,
      student.major,
      student.grade,
      accountStatusLabels[student.accountStatus],
      student.inviteCode ?? '',
      student.failedCourses,
      student.hasPunishment ? '是' : '否',
      student.activatedAt ? new Date(student.activatedAt).toLocaleString('zh-CN') : '',
      student.lastLoginAt ? new Date(student.lastLoginAt).toLocaleString('zh-CN') : '',
    ])
    downloadCsv('申报人名单导出.csv', [header, ...rows])
  }

  const downloadTemplate = () => {
    downloadCsv('申报人名单导入模板.csv', studentTemplateRows)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="申报人数据"
        description="维护申报人名单、任教学科、竞聘类别和登录邀请码"
        actions={
        <>
          <Button onClick={downloadTemplate} variant="secondary" className="flex-1 sm:flex-none">
            <FileSpreadsheet className="w-4 h-4" />
            下载模板
          </Button>
          <Button onClick={() => fileRef.current?.click()} variant="secondary" className="flex-1 sm:flex-none">
            <Upload className="w-4 h-4" />
            一键导入名单
          </Button>
          <Button onClick={exportStudents} variant="secondary" className="flex-1 sm:flex-none">
            <Download className="w-4 h-4" />
            一键导出名单
          </Button>
          <Button onClick={openAdd} className="flex-1 sm:flex-none">
            <Plus className="w-4 h-4" />
            新增
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
        </>
        }
      />

      {importMessage && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-700 shadow-sm">
          {importMessage}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          ['已激活', activeCount, 'text-emerald-600'],
          ['未激活', inactiveCount, 'text-amber-600'],
          ['已锁定', lockedCount, 'text-red-600'],
        ].map(([label, value, color]) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            tone={color === 'text-emerald-600' ? 'emerald' : color === 'text-red-600' ? 'red' : 'amber'}
          />
        ))}
      </div>

      <FilterBar>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="搜索姓名、用户编号、单位、学科或竞聘类别"
          />
        </div>
        <select
          value={deptFilter}
          onChange={event => setDeptFilter(event.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">全部单位</option>
          {departments.map(department => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>
        {selectedIds.size > 0 && (
          <Button onClick={batchDelete} variant="danger">
            <Trash2 className="w-4 h-4" />
            删除 {selectedIds.size} 项
          </Button>
        )}
      </FilterBar>

      <Panel className="overflow-hidden">
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.map(student => (
            <div key={student.id} className="p-4 transition-colors hover:bg-slate-50/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{student.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{student.studentId} · {student.grade || '未填写竞聘类别'}</p>
                </div>
                <Badge tone={accountStatusTones[student.accountStatus]} className="shrink-0">
                  {accountStatusLabels[student.accountStatus]}
                </Badge>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-3">
                <p className="text-sm text-slate-700">{student.department || '未填写单位'}</p>
                <p className="text-xs text-slate-500 mt-1">{student.major || '未填写任教学科/岗位'}</p>
                {student.inviteCode && (
                  <p className="text-xs text-blue-700 mt-2 font-medium">邀请码：{student.inviteCode}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  限制项：{student.failedCourses > 0 ? `${student.failedCourses} 项` : '无'}
                  {student.hasPunishment ? ' · 存在参评限制记录' : ''}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={async () => {
                    const result = await resetUserPassword(student.id)
                    setImportMessage(`${student.name}：${result.message}`)
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1 h-9 px-3 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium"
                >
                  <KeyRound className="w-4 h-4" />
                  重置
                </button>
                <button
                  onClick={async () => {
                    const result = await updateUserAccountStatus(student.id, student.accountStatus === 'locked' ? 'inactive' : 'locked')
                    setImportMessage(`${student.name}：${result.message}`)
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1 h-9 px-3 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium"
                >
                  {student.accountStatus === 'locked' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {student.accountStatus === 'locked' ? '解锁' : '锁定'}
                </button>
                <button
                  onClick={() => openEdit(student)}
                  className="inline-flex flex-1 items-center justify-center gap-1 h-9 px-3 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
                >
                  <Edit2 className="w-4 h-4" />
                  编辑
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-500">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    aria-label="全选申报人"
                  />
                </th>
                <th className="px-4 py-3 font-medium">申报人</th>
                <th className="px-4 py-3 font-medium">账号状态</th>
                <th className="px-4 py-3 font-medium">邀请码</th>
                <th className="px-4 py-3 font-medium">所属单位</th>
                <th className="px-4 py-3 font-medium">任教学科/岗位</th>
                <th className="px-4 py-3 font-medium">竞聘类别</th>
                <th className="px-4 py-3 font-medium">限制项</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(student => (
                <tr key={student.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(student.id)}
                      onChange={() => toggleSelect(student.id)}
                      aria-label={`选择${student.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.studentId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge tone={accountStatusTones[student.accountStatus]}>
                        {accountStatusLabels[student.accountStatus]}
                      </Badge>
                      {student.lastLoginAt && (
                        <span className="text-xs text-slate-400">
                          最近 {new Date(student.lastLoginAt).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {student.inviteCode ? (
                      <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded ring-1 ring-blue-100">
                        {student.inviteCode}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">已激活</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{student.department || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{student.major || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{student.grade || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {student.failedCourses > 0 ? `${student.failedCourses} 项` : '无'}
                    {student.hasPunishment ? ' · 有限制' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={async () => {
                          const result = await resetUserPassword(student.id)
                          setImportMessage(`${student.name}：${result.message}`)
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                        aria-label="重置密码"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const result = await updateUserAccountStatus(student.id, student.accountStatus === 'locked' ? 'inactive' : 'locked')
                          setImportMessage(`${student.name}：${result.message}`)
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100"
                      >
                        {student.accountStatus === 'locked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {student.accountStatus === 'locked' ? '解锁' : '锁定'}
                      </button>
                      <button
                        onClick={() => openEdit(student)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        aria-label="编辑申报人"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const result = await deleteStudent(student.id)
                          setImportMessage(`${student.name}：${result.message}`)
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="删除申报人"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <EmptyState icon={FileSpreadsheet} title="暂无申报人数据" />
        )}
      </Panel>

      {showModal && (
        <div className="fixed inset-0 bg-blue-950/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl shadow-slate-900/20 w-full max-w-2xl overflow-hidden">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editing ? '编辑申报人' : '新增申报人'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-slate-100" aria-label="关闭">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-auto">
              {!editing && (
                <div className="sm:col-span-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-700">
                  新增申报人默认未激活，初始密码为 123456，首次登录后必须修改密码。
                </div>
              )}
              <TextInput label="姓名" value={form.name} onChange={value => setForm({ ...form, name: value })} />
              <TextInput label="用户编号" value={form.studentId} onChange={value => setForm({ ...form, studentId: value })} />
              <TextInput label="所属单位" value={form.department} onChange={value => setForm({ ...form, department: value })} />
              <TextInput label="任教学科/岗位" value={form.major} onChange={value => setForm({ ...form, major: value })} />
              <TextInput label="竞聘类别" value={form.grade} onChange={value => setForm({ ...form, grade: value })} />
              <NumberInput label="限制项数" value={form.failedCourses} onChange={value => setForm({ ...form, failedCourses: value })} />
              <label className="flex items-center gap-2 text-sm text-slate-700 pt-7">
                <input
                  type="checkbox"
                  checked={form.hasPunishment}
                  onChange={event => setForm({ ...form, hasPunishment: event.target.checked })}
                />
                存在参评限制记录
              </label>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <Button onClick={() => setShowModal(false)} variant="secondary">
                取消
              </Button>
              <Button onClick={handleSave}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </label>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </label>
  )
}
