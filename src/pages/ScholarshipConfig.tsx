import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download, Edit2, Plus, RotateCcw, Save, Settings2, Trash2, Upload, X } from 'lucide-react'
import { useStore } from '../store'
import type { ApplicationBatch, BonusCategory, SystemSettings } from '../types'
import { Badge, Button, PageHeader, Panel, SectionHeader, StatCard } from '../components/ui'

const emptyCategory: BonusCategory = {
  id: '',
  name: '',
  group: '奖励成果',
  defaultScore: 0,
  maxScore: 0,
  description: '',
  requiredMaterials: '',
  order: 99,
  active: true,
}

const emptyBatch: ApplicationBatch = {
  id: '',
  name: '',
  startDate: '',
  endDate: '',
  description: '',
  active: true,
}

export default function ScholarshipConfig() {
  const {
    addBatch,
    addCategory,
    batches,
    categories,
    deleteBatch,
    deleteCategory,
    exportData,
    importData,
    resetDemoData,
    settings,
    updateBatch,
    updateCategory,
    updateSettings,
  } = useStore()
  const [settingsDraft, setSettingsDraft] = useState<SystemSettings | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BonusCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<BonusCategory>(emptyCategory)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [editingBatch, setEditingBatch] = useState<ApplicationBatch | null>(null)
  const [batchForm, setBatchForm] = useState<ApplicationBatch>(emptyBatch)
  const [message, setMessage] = useState('')
  const backupFileRef = useRef<HTMLInputElement>(null)

  const settingsForm = settingsDraft ?? settings

  const sortedCategories = useMemo(() => [...categories]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)), [categories])
  const visibleCategories = sortedCategories.filter(category => category.group !== '旧版加分项目')
  const activeCategories = visibleCategories.filter(category => category.active)
  const activeScoreTotal = activeCategories.reduce((sum, category) => sum + (Number(category.maxScore) || 0), 0)
  const activeBatches = batches.filter(batch => batch.active).length

  const openAdd = () => {
    setEditing(null)
    setCategoryForm({ ...emptyCategory, id: `cat-${Date.now()}`, order: visibleCategories.length + 1 })
    setShowModal(true)
  }

  const openAddBatch = () => {
    setEditingBatch(null)
    setBatchForm({ ...emptyBatch, id: `batch-${Date.now()}` })
    setShowBatchModal(true)
  }

  const openEditBatch = (batch: ApplicationBatch) => {
    setEditingBatch(batch)
    setBatchForm({ ...batch })
    setShowBatchModal(true)
  }

  const openEdit = (category: BonusCategory) => {
    setEditing(category)
    setCategoryForm({ ...category })
    setShowModal(true)
  }

  const saveSettings = async () => {
    const result = await updateSettings({
      ...settingsForm,
      scoringMode: 'teacherCompetition',
      weights: {
        ...settingsForm.weights,
        academic: 0,
        moral: 0,
        practice: 0,
        sports: 0,
      },
    })
    setMessage(result.message)
    if (result.ok) setSettingsDraft(null)
  }

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return
    const result = editing ? await updateCategory(categoryForm) : await addCategory(categoryForm)
    setMessage(result.message)
    if (result.ok) setShowModal(false)
  }

  const saveBatch = async () => {
    if (!batchForm.name.trim()) return
    const result = editingBatch ? await updateBatch(batchForm) : await addBatch(batchForm)
    setMessage(result.message)
    if (result.ok) setShowBatchModal(false)
  }

  const updateTotalCap = (value: number) => {
    setSettingsDraft(prev => ({
      ...(prev ?? settings),
      scoringMode: 'teacherCompetition',
      weights: {
        ...(prev ?? settings).weights,
        academic: 0,
        moral: 0,
        practice: 0,
        sports: 0,
        bonusCap: value,
      },
    }))
  }

  const handleImportBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async loaded => {
      const result = await importData(String(loaded.target?.result ?? ''))
      setMessage(result.message)
      if (result.settings) setSettingsDraft(result.settings)
    }
    reader.readAsText(file)
    if (backupFileRef.current) backupFileRef.current.value = ''
  }

  const handleResetDemo = async () => {
    if (!window.confirm('确认恢复演示数据？当前数据会被覆盖。')) return
    const nextSettings = await resetDemoData()
    setSettingsDraft(nextSettings)
    setMessage('已恢复演示数据')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="评分规则"
        description="配置竞聘评分周期、申报批次和各评分项目细则"
        actions={
        <Button onClick={saveSettings} className="w-full lg:w-auto">
          <Save className="w-4 h-4" />
          保存规则
        </Button>
        }
      />

      {message && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-700 shadow-sm">
          {message}
        </div>
      )}

      <Panel className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900">数据维护</h2>
            <p className="text-sm text-slate-500 mt-1">可导出完整数据备份，也可以导入备份恢复到历史状态</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button type="button" onClick={exportData} variant="secondary" className="flex-1 sm:flex-none">
              <Download className="w-4 h-4" />
              导出备份
            </Button>
            <Button type="button" onClick={() => backupFileRef.current?.click()} variant="secondary" className="flex-1 sm:flex-none">
              <Upload className="w-4 h-4" />
              导入备份
            </Button>
            <Button type="button" onClick={handleResetDemo} variant="danger" className="flex-1 sm:flex-none">
              <RotateCcw className="w-4 h-4" />
              重置演示数据
            </Button>
            <input ref={backupFileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportBackup} />
          </div>
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2 mb-5">
          <Settings2 className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-slate-900">竞聘规则总览</h2>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <TextInput label="评分周期" value={settingsForm.academicYear} onChange={value => setSettingsDraft({ ...settingsForm, academicYear: value })} />
          <TextInput label="申报截止日期" value={settingsForm.submissionDeadline} onChange={value => setSettingsDraft({ ...settingsForm, submissionDeadline: value })} />
          <NumberInput label="总分上限" value={settingsForm.weights.bonusCap} onChange={updateTotalCap} />
          <StatCard label="启用项目满分" value={`${activeScoreTotal} 分`} tone={activeScoreTotal === 100 ? 'emerald' : 'amber'} />
          <StatCard label="启用批次数" value={activeBatches} tone="cyan" />
        </div>

        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm leading-6 text-slate-600">
          当前采用专业技术岗位竞聘评分模式：申报人逐项填写自评分并上传证明材料，审核端复评后按单项满分和总分上限自动汇总排名。
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          title="申报批次"
          description="可按竞聘类别、奖项或专项活动设置不同入口，只有启用批次会出现在用户端"
          action={
          <Button onClick={openAddBatch} size="sm">
            <Plus className="w-4 h-4" />
            添加批次
          </Button>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">批次名称</th>
                <th className="px-5 py-3 font-medium">时间范围</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">说明</th>
                <th className="px-5 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map(batch => (
                <tr key={batch.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-semibold text-slate-900">{batch.name}</td>
                  <td className="px-5 py-4 text-slate-700">{batch.startDate || '-'} 至 {batch.endDate || '-'}</td>
                  <td className="px-5 py-4">
                    <Badge tone={batch.active ? 'emerald' : 'slate'}>{batch.active ? '启用' : '停用'}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-500 max-w-md">{batch.description || '暂无说明'}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditBatch(batch)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        aria-label="编辑批次"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const result = await deleteBatch(batch.id)
                          setMessage(result.message)
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="删除批次"
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
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          title="评分项目"
          description="用户端会展示项目说明和材料要求；审核端会按这里的满分上限进行复评"
          action={
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4" />
            添加项目
          </Button>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">序号</th>
                <th className="px-5 py-3 font-medium">分组</th>
                <th className="px-5 py-3 font-medium">评分项目</th>
                <th className="px-5 py-3 font-medium">满分</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">评分细则</th>
                <th className="px-5 py-3 font-medium">材料要求</th>
                <th className="px-5 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCategories.map(category => (
                <tr key={category.id} className="hover:bg-slate-50/80 align-top">
                  <td className="px-5 py-4 text-slate-500">{category.order ?? '-'}</td>
                  <td className="px-5 py-4 text-slate-700">{category.group || '-'}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900 min-w-36">{category.name}</td>
                  <td className="px-5 py-4 text-slate-700">{category.maxScore}</td>
                  <td className="px-5 py-4">
                    <Badge tone={category.active ? 'emerald' : 'slate'}>{category.active ? '启用' : '停用'}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-500 min-w-72 max-w-xl leading-6">{category.description}</td>
                  <td className="px-5 py-4 text-slate-500 min-w-64 max-w-md leading-6">{category.requiredMaterials || '-'}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(category)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        aria-label="编辑评分项目"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const result = await deleteCategory(category.id)
                          setMessage(result.message)
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="删除评分项目"
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
      </Panel>

      {showModal && (
        <div className="fixed inset-0 bg-blue-950/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl shadow-slate-900/20 w-full max-w-2xl overflow-hidden">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editing ? '编辑评分项目' : '添加评分项目'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-slate-100" aria-label="关闭">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[72vh] overflow-auto">
              <div className="grid sm:grid-cols-2 gap-3">
                <TextInput label="分组" value={categoryForm.group || ''} onChange={value => setCategoryForm({ ...categoryForm, group: value })} />
                <TextInput label="评分项目名称" value={categoryForm.name} onChange={value => setCategoryForm({ ...categoryForm, name: value })} />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <NumberInput label="排序" value={categoryForm.order ?? 99} onChange={value => setCategoryForm({ ...categoryForm, order: value })} />
                <NumberInput label="默认自评分" value={categoryForm.defaultScore} onChange={value => setCategoryForm({ ...categoryForm, defaultScore: value })} />
                <NumberInput label="满分上限" value={categoryForm.maxScore} onChange={value => setCategoryForm({ ...categoryForm, maxScore: value })} />
              </div>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">评分细则</span>
                <textarea
                  value={categoryForm.description}
                  onChange={event => setCategoryForm({ ...categoryForm, description: event.target.value })}
                  className="w-full min-h-28 px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">材料要求</span>
                <textarea
                  value={categoryForm.requiredMaterials || ''}
                  onChange={event => setCategoryForm({ ...categoryForm, requiredMaterials: event.target.value })}
                  className="w-full min-h-20 px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={categoryForm.active}
                  onChange={event => setCategoryForm({ ...categoryForm, active: event.target.checked })}
                />
                启用该评分项目
              </label>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <Button onClick={() => setShowModal(false)} variant="secondary">
                取消
              </Button>
              <Button onClick={saveCategory}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 bg-blue-950/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl shadow-slate-900/20 w-full max-w-xl overflow-hidden">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editingBatch ? '编辑申报批次' : '添加申报批次'}</h2>
              <button onClick={() => setShowBatchModal(false)} className="p-1.5 rounded hover:bg-slate-100" aria-label="关闭">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <TextInput label="批次名称" value={batchForm.name} onChange={value => setBatchForm({ ...batchForm, name: value })} />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="开始日期" value={batchForm.startDate} onChange={value => setBatchForm({ ...batchForm, startDate: value })} />
                <TextInput label="结束日期" value={batchForm.endDate} onChange={value => setBatchForm({ ...batchForm, endDate: value })} />
              </div>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">批次说明</span>
                <textarea
                  value={batchForm.description}
                  onChange={event => setBatchForm({ ...batchForm, description: event.target.value })}
                  className="w-full min-h-24 px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：用于 2026 专业技术岗位竞聘、高级首聘或层级内晋升申报"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={batchForm.active}
                  onChange={event => setBatchForm({ ...batchForm, active: event.target.checked })}
                />
                启用该批次
              </label>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <Button onClick={() => setShowBatchModal(false)} variant="secondary">
                取消
              </Button>
              <Button onClick={saveBatch}>
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
        step="0.01"
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </label>
  )
}
