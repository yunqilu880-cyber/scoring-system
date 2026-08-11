import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download, Edit2, Plus, RotateCcw, Save, Settings2, Trash2, Upload, X } from 'lucide-react'
import { useStore } from '../store'
import type { BonusCategory, SystemSettings } from '../types'
import { Badge, Button, PageHeader, Panel, SectionHeader } from '../components/ui'

const emptyCategory: BonusCategory = {
  id: '',
  name: '',
  defaultScore: 0,
  maxScore: 0,
  description: '',
  active: true,
}

export default function ScholarshipConfig() {
  const {
    addCategory,
    categories,
    deleteCategory,
    exportData,
    importData,
    resetDemoData,
    settings,
    updateCategory,
    updateSettings,
  } = useStore()
  const [settingsForm, setSettingsForm] = useState<SystemSettings>(settings)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BonusCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<BonusCategory>(emptyCategory)
  const [message, setMessage] = useState('')
  const backupFileRef = useRef<HTMLInputElement>(null)

  const weightTotal =
    settingsForm.weights.academic +
    settingsForm.weights.moral +
    settingsForm.weights.practice +
    settingsForm.weights.sports

  const openAdd = () => {
    setEditing(null)
    setCategoryForm({ ...emptyCategory, id: `cat-${Date.now()}` })
    setShowModal(true)
  }

  const openEdit = (category: BonusCategory) => {
    setEditing(category)
    setCategoryForm({ ...category })
    setShowModal(true)
  }

  const saveSettings = async () => {
    const result = await updateSettings(settingsForm)
    setMessage(result.message)
  }

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return
    const result = editing ? await updateCategory(categoryForm) : await addCategory(categoryForm)
    setMessage(result.message)
    if (result.ok) setShowModal(false)
  }

  const updateWeight = (key: keyof SystemSettings['weights'], value: number) => {
    setSettingsForm(prev => ({
      ...prev,
      weights: {
        ...prev.weights,
        [key]: value,
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
      if (result.settings) setSettingsForm(result.settings)
    }
    reader.readAsText(file)
    if (backupFileRef.current) backupFileRef.current.value = ''
  }

  const handleResetDemo = async () => {
    if (!window.confirm('确认恢复演示数据？当前本地数据会被覆盖。')) return
    const nextSettings = await resetDemoData()
    setSettingsForm(nextSettings)
    setMessage('已恢复演示数据')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="评分规则"
        description="配置基础指标权重、加分上限和可申报的加分类型"
        actions={
        <Button
          onClick={saveSettings}
          className="w-full lg:w-auto"
        >
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
            <p className="text-sm text-slate-500 mt-1">本地演示数据可备份、恢复，也可以一键回到默认样例</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button
              type="button"
              onClick={exportData}
              variant="secondary"
              className="flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4" />
              导出备份
            </Button>
            <Button
              type="button"
              onClick={() => backupFileRef.current?.click()}
              variant="secondary"
              className="flex-1 sm:flex-none"
            >
              <Upload className="w-4 h-4" />
              导入备份
            </Button>
            <Button
              type="button"
              onClick={handleResetDemo}
              variant="danger"
              className="flex-1 sm:flex-none"
            >
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
          <h2 className="font-bold text-slate-900">基础指标核算</h2>
          <span className={`ml-auto text-sm font-medium ${weightTotal === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
            权重合计 {weightTotal}%
          </span>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <TextInput label="评分周期" value={settingsForm.academicYear} onChange={value => setSettingsForm({ ...settingsForm, academicYear: value })} />
          <TextInput label="申报截止日期" value={settingsForm.submissionDeadline} onChange={value => setSettingsForm({ ...settingsForm, submissionDeadline: value })} />
          <NumberInput label="基础表现%" value={settingsForm.weights.academic} onChange={value => updateWeight('academic', value)} />
          <NumberInput label="综合表现%" value={settingsForm.weights.moral} onChange={value => updateWeight('moral', value)} />
          <NumberInput label="贡献表现%" value={settingsForm.weights.practice} onChange={value => updateWeight('practice', value)} />
          <NumberInput label="规范记录%" value={settingsForm.weights.sports} onChange={value => updateWeight('sports', value)} />
          <NumberInput label="单人加分上限" value={settingsForm.weights.bonusCap} onChange={value => updateWeight('bonusCap', value)} />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          title="加分类型"
          description="用户上传加分项时会从启用的类型中选择"
          action={
          <Button
            onClick={openAdd}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            添加
          </Button>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">类型名称</th>
                <th className="px-5 py-3 font-medium">默认分</th>
                <th className="px-5 py-3 font-medium">上限</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">说明</th>
                <th className="px-5 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map(category => (
                <tr key={category.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-semibold text-slate-900">{category.name}</td>
                  <td className="px-5 py-4 text-slate-700">{category.defaultScore}</td>
                  <td className="px-5 py-4 text-slate-700">{category.maxScore}</td>
                  <td className="px-5 py-4">
                    <Badge tone={category.active ? 'emerald' : 'slate'}>{category.active ? '启用' : '停用'}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-500 max-w-md">{category.description}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(category)}
                        className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        aria-label="编辑类型"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="删除类型"
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
          <div className="bg-white rounded-lg shadow-2xl shadow-slate-900/20 w-full max-w-xl overflow-hidden">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editing ? '编辑加分类型' : '添加加分类型'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-slate-100" aria-label="关闭">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <TextInput label="类型名称" value={categoryForm.name} onChange={value => setCategoryForm({ ...categoryForm, name: value })} />
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="默认分" value={categoryForm.defaultScore} onChange={value => setCategoryForm({ ...categoryForm, defaultScore: value })} />
                <NumberInput label="上限分" value={categoryForm.maxScore} onChange={value => setCategoryForm({ ...categoryForm, maxScore: value })} />
              </div>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">说明</span>
                <textarea
                  value={categoryForm.description}
                  onChange={event => setCategoryForm({ ...categoryForm, description: event.target.value })}
                  className="w-full min-h-24 px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={categoryForm.active}
                  onChange={event => setCategoryForm({ ...categoryForm, active: event.target.checked })}
                />
                启用该类型
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
        step="0.5"
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </label>
  )
}

