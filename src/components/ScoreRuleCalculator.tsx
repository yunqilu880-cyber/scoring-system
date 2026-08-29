import { useEffect, useMemo, useState } from 'react'
import { Calculator } from 'lucide-react'
import type { ScoreCalculationSnapshot } from '../types'
import {
  calculateRuleSnapshot,
  getInitialRuleValues,
  getScoreRule,
  type ScoreRuleField,
  type ScoreRuleValue,
  type ScoreRuleValues,
} from '../scoringRules'

type ScoreRuleCalculatorProps = {
  categoryId: string
  maxScore: number
  onChange: (calculation: ScoreCalculationSnapshot | null) => void
}

const inputClass = 'w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

export default function ScoreRuleCalculator({ categoryId, maxScore, onChange }: ScoreRuleCalculatorProps) {
  const rule = getScoreRule(categoryId)
  const [draft, setDraft] = useState<{ categoryId: string; values: ScoreRuleValues }>(() => ({
    categoryId,
    values: getInitialRuleValues(categoryId),
  }))
  const values = useMemo(() => (
    draft.categoryId === categoryId ? draft.values : getInitialRuleValues(categoryId)
  ), [categoryId, draft])

  const calculation = useMemo(() => (
    calculateRuleSnapshot(categoryId, values, maxScore)
  ), [categoryId, maxScore, values])

  useEffect(() => {
    onChange(calculation)
  }, [calculation, onChange])

  if (!rule || !calculation) return null

  const updateValue = (field: ScoreRuleField, value: ScoreRuleValue) => {
    setDraft(prev => {
      const baseValues = prev.categoryId === categoryId ? prev.values : getInitialRuleValues(categoryId)
      return {
        categoryId,
        values: { ...baseValues, [field.key]: value },
      }
    })
  }

  const visibleFields = rule.fields.filter(field => !field.visibleWhen || field.visibleWhen(values))

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100 flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">自动算分</p>
            <p className="text-xs text-slate-500">{rule.name}</p>
          </div>
        </div>
        <div className="rounded-lg bg-blue-600 px-3 py-2 text-white text-right">
          <p className="text-[11px] opacity-80">系统建议分</p>
          <p className="text-xl font-bold">{calculation.score.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        {visibleFields.map(field => (
          <RuleField key={field.key} field={field} value={values[field.key] ?? field.defaultValue} onChange={updateValue} />
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-blue-50/70 border border-blue-100 px-3 py-2">
        <p className="text-xs font-medium text-blue-800">计分过程</p>
        <p className="text-xs text-slate-600 leading-5 mt-1">{calculation.summary}</p>
        {calculation.warnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {calculation.warnings.map(warning => (
              <p key={warning} className="text-xs text-red-600">{warning}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RuleField({
  field,
  value,
  onChange,
}: {
  field: ScoreRuleField
  value: ScoreRuleValue
  onChange: (field: ScoreRuleField, value: ScoreRuleValue) => void
}) {
  if (field.type === 'checkbox') {
    return (
      <label className="min-h-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={value === true}
          onChange={event => onChange(field, event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>{field.label}</span>
      </label>
    )
  }

  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{field.label}</span>
      {field.type === 'select' ? (
        <select
          value={String(value)}
          onChange={event => onChange(field, event.target.value)}
          className={inputClass}
        >
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <div className="relative">
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 0.01}
            value={Number(value)}
            onChange={event => onChange(field, Number(event.target.value))}
            className={`${inputClass} ${field.suffix ? 'pr-12' : ''}`}
          />
          {field.suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{field.suffix}</span>
          )}
        </div>
      )}
    </label>
  )
}
