import type { ScoreCalculationSnapshot } from './types'

export type ScoreRuleValue = string | number | boolean
export type ScoreRuleValues = Record<string, ScoreRuleValue>

type SelectOption = {
  value: string
  label: string
}

export type ScoreRuleField = {
  key: string
  label: string
  type: 'number' | 'select' | 'checkbox'
  defaultValue: ScoreRuleValue
  options?: SelectOption[]
  min?: number
  max?: number
  step?: number
  suffix?: string
  visibleWhen?: (values: ScoreRuleValues) => boolean
}

export type ScoreRuleResult = {
  score: number
  summary: string
  warnings?: string[]
}

export type ScoreRuleDefinition = {
  categoryId: string
  name: string
  fields: ScoreRuleField[]
  calculate: (values: ScoreRuleValues, maxScore: number) => ScoreRuleResult
}

const roundScore = (value: number) => Math.round(value * 100) / 100
const clampScore = (value: number, maxScore: number) => roundScore(Math.max(0, Math.min(value, maxScore)))
const numberValue = (values: ScoreRuleValues, key: string) => Number(values[key] || 0)
const stringValue = (values: ScoreRuleValues, key: string) => String(values[key] ?? '')
const boolValue = (values: ScoreRuleValues, key: string) => values[key] === true

const option = (value: string, label: string): SelectOption => ({ value, label })

const getOptionLabel = (field: ScoreRuleField, value: ScoreRuleValue) => (
  field.options?.find(option => option.value === String(value))?.label ?? String(value)
)

const getFieldLabel = (fields: ScoreRuleField[], key: string, values: ScoreRuleValues) => {
  const field = fields.find(field => field.key === key)
  return field ? getOptionLabel(field, values[key]) : String(values[key] ?? '')
}

const levels = [
  option('national', '国家级'),
  option('province', '省级'),
  option('city', '市级'),
  option('county', '县级'),
  option('area', '片区级'),
  option('town', '乡镇级'),
  option('school', '校级'),
]

const prizes = [
  option('first', '一等奖'),
  option('second', '二等奖'),
  option('third', '三等奖'),
]

const comprehensiveAwardScores: Record<string, number> = {
  national: 3,
  province: 2,
  city: 1.5,
  county: 1,
  town: 0.5,
  school: 0.3,
}

const competitionScores: Record<string, Record<string, number>> = {
  national: { first: 3, second: 2.5, third: 2 },
  province: { first: 2.5, second: 2, third: 1.5 },
  city: { first: 2, second: 1.5, third: 1 },
  county: { first: 1.5, second: 1, third: 0.5 },
  area: { first: 1, second: 0.5, third: 0.3 },
  school: { first: 0.5, second: 0.3, third: 0.1 },
}

const guidanceScores: Record<string, Record<string, number>> = {
  national: { first: 1.5, second: 1.25, third: 1 },
  province: { first: 1.25, second: 1, third: 0.75 },
  city: { first: 1, second: 0.75, third: 0.5 },
  county: { first: 0.75, second: 0.5, third: 0.25 },
  area: { first: 0.5, second: 0.25, third: 0.15 },
  school: { first: 0.25, second: 0.15, third: 0.1 },
}

const sportsScores: Record<string, Record<string, number>> = {
  national: { first: 0.75, secondToFourth: 0.625, fifthToEighth: 0.5 },
  province: { first: 0.625, secondToFourth: 0.5, fifthToEighth: 0.3 },
  city: { first: 0.5, secondToFourth: 0.375, fifthToEighth: 0.25 },
  county: { first: 0.375, secondToFourth: 0.25, fifthToEighth: 0.125 },
}

const paperAwardScores: Record<string, Record<string, number>> = {
  national: { first: 1, second: 0.8, third: 0.5 },
  province: { first: 0.8, second: 0.6, third: 0.5 },
  city: { first: 0.5, second: 0.4, third: 0.3 },
  county: { first: 0.3, second: 0.2, third: 0.1 },
}

const yesNoApprovedField = (key: string, label: string): ScoreRuleField => ({
  key,
  label,
  type: 'checkbox',
  defaultValue: true,
})

const rules: ScoreRuleDefinition[] = [
  {
    categoryId: 'score-work-years',
    name: '工作年限自动计分',
    fields: [
      {
        key: 'yearType',
        label: '年限类型',
        type: 'select',
        defaultValue: 'teaching',
        options: [option('teaching', '教龄 0.5 分/年'), option('service', '工龄 0.4 分/年')],
      },
      { key: 'years', label: '整周年数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '年' },
    ],
    calculate: (values, maxScore) => {
      const type = stringValue(values, 'yearType')
      const years = numberValue(values, 'years')
      const rate = type === 'service' ? 0.4 : 0.5
      const label = type === 'service' ? '工龄' : '教龄'
      const raw = years * rate
      return {
        score: clampScore(raw, maxScore),
        summary: `${label} ${years} 年 × ${rate} 分/年 = ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-education',
    name: '学历自动计分',
    fields: [
      {
        key: 'educationLevel',
        label: '学历层次',
        type: 'select',
        defaultValue: 'bachelor',
        options: [option('bachelor', '本科及以上'), option('college', '专科'), option('normal', '中师/中专')],
      },
      { key: 'hasTeacherCert', label: '已取得相应层次教师资格证', type: 'checkbox', defaultValue: true },
    ],
    calculate: (values, maxScore) => {
      const level = stringValue(values, 'educationLevel')
      const base = level === 'college' ? 4 : level === 'normal' ? 3 : 5
      const hasTeacherCert = boolValue(values, 'hasTeacherCert')
      const score = hasTeacherCert ? base : 2
      const fields = rules.find(rule => rule.categoryId === 'score-education')?.fields ?? []
      return {
        score: clampScore(score, maxScore),
        summary: `${getFieldLabel(fields, 'educationLevel', values)}${hasTeacherCert ? '，有对应教师资格证' : '，无对应教师资格证'}，计 ${score} 分`,
      }
    },
  },
  {
    categoryId: 'score-assessment',
    name: '年度、师德考核自动计分',
    fields: [
      { key: 'annualExcellent', label: '年度考核优秀次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'annualQualified', label: '年度考核合格次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'moralExcellent', label: '师德考核优秀次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'moralQualified', label: '师德考核合格次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'hasBelowQualified', label: '近三年存在合格以下情况', type: 'checkbox', defaultValue: false },
    ],
    calculate: (values, maxScore) => {
      if (boolValue(values, 'hasBelowQualified')) {
        return { score: 0, summary: '近三年年度考核或师德考核存在合格以下情况，按细则不得参评。', warnings: ['存在合格以下情况，需管理员确认参评资格。'] }
      }
      const raw = (numberValue(values, 'annualExcellent') + numberValue(values, 'moralExcellent')) * 1
        + (numberValue(values, 'annualQualified') + numberValue(values, 'moralQualified')) * 0.9
      return {
        score: clampScore(raw, maxScore),
        summary: `优秀 ${numberValue(values, 'annualExcellent') + numberValue(values, 'moralExcellent')} 次 × 1，合格 ${numberValue(values, 'annualQualified') + numberValue(values, 'moralQualified')} 次 × 0.9，合计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-professional-post',
    name: '专业技术职务自动计分',
    fields: [
      {
        key: 'competitionType',
        label: '竞聘类型',
        type: 'select',
        defaultValue: 'level',
        options: [option('level', '层级首聘'), option('grade', '同层级内等级竞聘')],
      },
      { key: 'qualificationYears', label: '任职资格整周年', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '年' },
      { key: 'appointmentYears', label: '聘任职务整周年', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '年' },
    ],
    calculate: (values, maxScore) => {
      const raw = numberValue(values, 'qualificationYears') * 0.5 + numberValue(values, 'appointmentYears') * 0.5
      const label = stringValue(values, 'competitionType') === 'grade' ? '同层级内等级竞聘' : '层级首聘'
      return {
        score: clampScore(raw, maxScore),
        summary: `${label}：任职资格 ${numberValue(values, 'qualificationYears')} 年 × 0.5，聘任职务 ${numberValue(values, 'appointmentYears')} 年 × 0.5，合计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-duty',
    name: '任职自动计分',
    fields: [
      {
        key: 'primaryRole',
        label: '主要任职',
        type: 'select',
        defaultValue: 'principal',
        options: [
          option('principal', '校长/书记 1 分/学年'),
          option('vicePrincipal', '副校长/副书记 0.8 分/学年'),
          option('middleChief', '中层正职 0.6 分/学年'),
          option('deputy', '副职 0.5 分/学年'),
          option('accountant', '报账员 0.4 分/学年'),
          option('office', '处室干事/工会副主席/年级组长 0.3 分/学年'),
          option('classTeacher', '备课组长/班主任 0.2 分/学年'),
          option('union', '工会委员 0.15 分/学年'),
        ],
      },
      { key: 'primaryYears', label: '主要任职学年数', type: 'number', defaultValue: 0, min: 0, max: 3, step: 0.5, suffix: '学年' },
      {
        key: 'concurrentRole',
        label: '兼任职务',
        type: 'select',
        defaultValue: 'none',
        options: [
          option('none', '无兼任职务'),
          option('principal', '校长/书记 1 分/学年'),
          option('vicePrincipal', '副校长/副书记 0.8 分/学年'),
          option('middleChief', '中层正职 0.6 分/学年'),
          option('deputy', '副职 0.5 分/学年'),
          option('accountant', '报账员 0.4 分/学年'),
          option('office', '处室干事/工会副主席/年级组长 0.3 分/学年'),
          option('classTeacher', '备课组长/班主任 0.2 分/学年'),
          option('union', '工会委员 0.15 分/学年'),
        ],
      },
      { key: 'concurrentYears', label: '兼任职务学年数', type: 'number', defaultValue: 0, min: 0, max: 3, step: 0.5, suffix: '学年' },
    ],
    calculate: (values, maxScore) => {
      const rates: Record<string, number> = {
        none: 0,
        principal: 1,
        vicePrincipal: 0.8,
        middleChief: 0.6,
        deputy: 0.5,
        accountant: 0.4,
        office: 0.3,
        classTeacher: 0.2,
        union: 0.15,
      }
      const fields = rules.find(rule => rule.categoryId === 'score-duty')?.fields ?? []
      const primary = stringValue(values, 'primaryRole')
      const concurrent = stringValue(values, 'concurrentRole')
      const raw = numberValue(values, 'primaryYears') * rates[primary]
        + numberValue(values, 'concurrentYears') * rates[concurrent] * 0.5
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'primaryRole', values)} ${numberValue(values, 'primaryYears')} 学年；兼任 ${getFieldLabel(fields, 'concurrentRole', values)} ${numberValue(values, 'concurrentYears')} 学年按 1/2 计，合计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-honor-comprehensive',
    name: '综合奖自动计分',
    fields: [
      yesNoApprovedField('recommended', '经组织推荐或主管部门表彰'),
      { key: 'level', label: '奖励级别', type: 'select', defaultValue: 'county', options: levels.filter(item => item.value !== 'area') },
      { key: 'count', label: '不同年度次数', type: 'number', defaultValue: 1, min: 1, step: 1, suffix: '次' },
    ],
    calculate: (values, maxScore) => {
      if (!boolValue(values, 'recommended')) return { score: 0, summary: '未经组织推荐或主管部门表彰，按细则不计分。', warnings: ['不符合推荐或表彰来源要求。'] }
      const fields = rules.find(rule => rule.categoryId === 'score-honor-comprehensive')?.fields ?? []
      const level = stringValue(values, 'level')
      const raw = (comprehensiveAwardScores[level] ?? 0) * numberValue(values, 'count')
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'level', values)}综合奖 ${numberValue(values, 'count')} 次，合计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-honor-single',
    name: '单项奖自动计分',
    fields: [
      yesNoApprovedField('recommended', '经组织推荐或主管部门表彰'),
      {
        key: 'singleAwardType',
        label: '单项奖类别',
        type: 'select',
        defaultValue: 'firstClass',
        options: [option('firstClass', '一类单项奖，按同级综合奖 1/2'), option('secondClass', '二类单项奖，按同级综合奖 1/4')],
      },
      { key: 'level', label: '奖励级别', type: 'select', defaultValue: 'county', options: levels.filter(item => item.value !== 'area') },
    ],
    calculate: (values, maxScore) => {
      if (!boolValue(values, 'recommended')) return { score: 0, summary: '未经组织推荐的单项奖不计分。', warnings: ['不符合推荐来源要求。'] }
      const fields = rules.find(rule => rule.categoryId === 'score-honor-single')?.fields ?? []
      const level = stringValue(values, 'level')
      const factor = stringValue(values, 'singleAwardType') === 'secondClass' ? 0.25 : 0.5
      const raw = (comprehensiveAwardScores[level] ?? 0) * factor
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'level', values)}${getFieldLabel(fields, 'singleAwardType', values)}，计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-business-competition',
    name: '个人业务竞赛自动计分',
    fields: [
      yesNoApprovedField('schoolApproved', '经学校同意参加'),
      {
        key: 'competitionKind',
        label: '竞赛类型',
        type: 'select',
        defaultValue: 'qualityLesson',
        options: [
          option('qualityLesson', '现场优质课竞赛'),
          option('otherFirst', '其他业务竞赛第一类，按 1/2'),
          option('otherSecond', '其他业务竞赛第二类，按 1/4'),
        ],
      },
      { key: 'level', label: '获奖级别', type: 'select', defaultValue: 'county', options: levels.filter(item => item.value !== 'town') },
      { key: 'prize', label: '获奖等次', type: 'select', defaultValue: 'first', options: prizes },
    ],
    calculate: (values, maxScore) => {
      if (!boolValue(values, 'schoolApproved')) return { score: 0, summary: '未经学校同意参加的竞赛获奖不计分。', warnings: ['不符合学校同意参加要求。'] }
      const fields = rules.find(rule => rule.categoryId === 'score-business-competition')?.fields ?? []
      const base = competitionScores[stringValue(values, 'level')]?.[stringValue(values, 'prize')] ?? 0
      const kind = stringValue(values, 'competitionKind')
      const factor = kind === 'otherSecond' ? 0.25 : kind === 'otherFirst' ? 0.5 : 1
      const raw = base * factor
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'competitionKind', values)}，${getFieldLabel(fields, 'level', values)}${getFieldLabel(fields, 'prize', values)}，计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-guidance',
    name: '指导获奖自动计分',
    fields: [
      yesNoApprovedField('schoolApproved', '经学校同意指导参赛'),
      {
        key: 'guidanceType',
        label: '指导类别',
        type: 'select',
        defaultValue: 'subject',
        options: [option('subject', '学科竞赛指导奖'), option('other', '其他竞赛指导奖'), option('sports', '文艺体育竞赛指导奖')],
      },
      {
        key: 'level',
        label: '获奖级别',
        type: 'select',
        defaultValue: 'county',
        options: levels.filter(item => item.value !== 'town'),
        visibleWhen: values => stringValue(values, 'guidanceType') !== 'sports',
      },
      {
        key: 'prize',
        label: '获奖等次',
        type: 'select',
        defaultValue: 'first',
        options: prizes,
        visibleWhen: values => stringValue(values, 'guidanceType') !== 'sports',
      },
      {
        key: 'sportsLevel',
        label: '体育竞赛级别',
        type: 'select',
        defaultValue: 'county',
        options: levels.filter(item => ['national', 'province', 'city', 'county'].includes(item.value)),
        visibleWhen: values => stringValue(values, 'guidanceType') === 'sports',
      },
      {
        key: 'sportsRank',
        label: '单项名次',
        type: 'select',
        defaultValue: 'first',
        options: [option('first', '第 1 名'), option('secondToFourth', '第 2-4 名'), option('fifthToEighth', '第 5-8 名')],
        visibleWhen: values => stringValue(values, 'guidanceType') === 'sports',
      },
      {
        key: 'recordLevel',
        label: '破纪录级别',
        type: 'select',
        defaultValue: 'none',
        options: [option('none', '未破纪录'), option('county', '破县纪录 0.5 分'), option('city', '破市纪录 1 分'), option('province', '破省纪录 1.25 分'), option('national', '破国家纪录 1.5 分')],
        visibleWhen: values => stringValue(values, 'guidanceType') === 'sports',
      },
      { key: 'instructorCount', label: '共同指导教师人数', type: 'number', defaultValue: 1, min: 1, step: 1, suffix: '人' },
    ],
    calculate: (values, maxScore) => {
      if (!boolValue(values, 'schoolApproved')) return { score: 0, summary: '未经学校同意指导参赛的奖项不计分。', warnings: ['不符合学校同意指导要求。'] }
      const fields = rules.find(rule => rule.categoryId === 'score-guidance')?.fields ?? []
      const instructors = Math.max(1, numberValue(values, 'instructorCount'))
      const type = stringValue(values, 'guidanceType')
      if (type === 'sports') {
        const recordScores: Record<string, number> = { none: 0, county: 0.5, city: 1, province: 1.25, national: 1.5 }
        const award = sportsScores[stringValue(values, 'sportsLevel')]?.[stringValue(values, 'sportsRank')] ?? 0
        const record = recordScores[stringValue(values, 'recordLevel')] ?? 0
        const raw = (award + record) / instructors
        return {
          score: clampScore(raw, maxScore),
          summary: `体育竞赛 ${getFieldLabel(fields, 'sportsLevel', values)}${getFieldLabel(fields, 'sportsRank', values)}，破纪录 ${getFieldLabel(fields, 'recordLevel', values)}，${instructors} 人共同指导，计 ${roundScore(raw)} 分`,
        }
      }
      const raw = (guidanceScores[stringValue(values, 'level')]?.[stringValue(values, 'prize')] ?? 0) / instructors
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'guidanceType', values)}，${getFieldLabel(fields, 'level', values)}${getFieldLabel(fields, 'prize', values)}，${instructors} 人共同指导，计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-paper-published',
    name: '论文发表自动计分',
    fields: [
      yesNoApprovedField('searchable', '论文可在知网、万方、维普等主流数据库检索'),
      {
        key: 'publicationKind',
        label: '成果类型',
        type: 'select',
        defaultValue: 'paper',
        options: [option('paper', '论文发表'), option('book', '正规出版专著，按 2 倍')],
      },
      {
        key: 'level',
        label: '发表级别',
        type: 'select',
        defaultValue: 'province',
        options: [option('province', '省级及以上'), option('city', '市级')],
      },
      {
        key: 'authorRole',
        label: '作者排序',
        type: 'select',
        defaultValue: 'sole',
        options: [option('sole', '独立作者'), option('first', '多人合作第一作者，计 2/3'), option('other', '其他作者，均分 1/3')],
      },
      {
        key: 'otherAuthorCount',
        label: '其他作者人数',
        type: 'number',
        defaultValue: 1,
        min: 1,
        step: 1,
        suffix: '人',
        visibleWhen: values => stringValue(values, 'authorRole') === 'other',
      },
    ],
    calculate: (values, maxScore) => {
      if (!boolValue(values, 'searchable')) return { score: 0, summary: '缺少主流数据库检索审验或有效发表证明，暂不计分。', warnings: ['需补充论文检索页或有效发表证明。'] }
      const fields = rules.find(rule => rule.categoryId === 'score-paper-published')?.fields ?? []
      const base = stringValue(values, 'level') === 'city' ? 0.4 : 1
      const kindFactor = stringValue(values, 'publicationKind') === 'book' ? 2 : 1
      const role = stringValue(values, 'authorRole')
      const authorFactor = role === 'first' ? 2 / 3 : role === 'other' ? 1 / 3 / Math.max(1, numberValue(values, 'otherAuthorCount')) : 1
      const raw = base * kindFactor * authorFactor
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'publicationKind', values)}，${getFieldLabel(fields, 'level', values)}，${getFieldLabel(fields, 'authorRole', values)}，计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-paper-award',
    name: '论文获奖自动计分',
    fields: [
      yesNoApprovedField('recommended', '经组织或学校推荐参赛'),
      { key: 'level', label: '获奖级别', type: 'select', defaultValue: 'county', options: levels.filter(item => ['national', 'province', 'city', 'county'].includes(item.value)) },
      { key: 'prize', label: '获奖等次', type: 'select', defaultValue: 'first', options: prizes },
    ],
    calculate: (values, maxScore) => {
      if (!boolValue(values, 'recommended')) return { score: 0, summary: '未经组织或学校推荐的论文竞赛不计分。', warnings: ['不符合推荐参赛要求。'] }
      const fields = rules.find(rule => rule.categoryId === 'score-paper-award')?.fields ?? []
      const raw = paperAwardScores[stringValue(values, 'level')]?.[stringValue(values, 'prize')] ?? 0
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'level', values)}论文获奖${getFieldLabel(fields, 'prize', values)}，计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-news',
    name: '新闻报道自动计分',
    fields: [
      {
        key: 'level',
        label: '采用级别',
        type: 'select',
        defaultValue: 'county',
        options: [option('national', '国家级'), option('province', '省级'), option('city', '市级'), option('county', '县级')],
      },
      { key: 'count', label: '不同内容篇数', type: 'number', defaultValue: 1, min: 1, step: 1, suffix: '篇' },
    ],
    calculate: (values, maxScore) => {
      const fields = rules.find(rule => rule.categoryId === 'score-news')?.fields ?? []
      const scores: Record<string, number> = { national: 1, province: 0.5, city: 0.3, county: 0.2 }
      const raw = (scores[stringValue(values, 'level')] ?? 0) * numberValue(values, 'count')
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'level', values)}新闻报道 ${numberValue(values, 'count')} 篇，合计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-research-topic',
    name: '课题研究自动计分',
    fields: [
      {
        key: 'level',
        label: '课题级别',
        type: 'select',
        defaultValue: 'city',
        options: [option('national', '国家级'), option('province', '省级'), option('city', '市级')],
      },
      {
        key: 'topicStatus',
        label: '课题状态',
        type: 'select',
        defaultValue: 'completed',
        options: [option('completed', '已结题'), option('approved', '立项当年，按 1/3')],
      },
      {
        key: 'role',
        label: '本人角色',
        type: 'select',
        defaultValue: 'host',
        options: [option('host', '主持人 70%'), option('top3', '排名前三参与人 30%'), option('participant', '其他参与人员 20%')],
      },
    ],
    calculate: (values, maxScore) => {
      const fields = rules.find(rule => rule.categoryId === 'score-research-topic')?.fields ?? []
      const baseScores: Record<string, number> = { national: 2, province: 1.5, city: 1 }
      const roleFactors: Record<string, number> = { host: 0.7, top3: 0.3, participant: 0.2 }
      const statusFactor = stringValue(values, 'topicStatus') === 'approved' ? 1 / 3 : 1
      const raw = (baseScores[stringValue(values, 'level')] ?? 0) * statusFactor * (roleFactors[stringValue(values, 'role')] ?? 0)
      return {
        score: clampScore(raw, maxScore),
        summary: `${getFieldLabel(fields, 'level', values)}课题，${getFieldLabel(fields, 'topicStatus', values)}，${getFieldLabel(fields, 'role', values)}，计 ${roundScore(raw)} 分`,
      }
    },
  },
  {
    categoryId: 'score-attendance',
    name: '出勤自动计分',
    fields: [
      { key: 'personalLeaveDays', label: '事假累计天数', type: 'number', defaultValue: 0, min: 0, step: 0.5, suffix: '天' },
      { key: 'sickLeaveDays', label: '病假累计天数', type: 'number', defaultValue: 0, min: 0, step: 0.5, suffix: '天' },
      { key: 'meetingAbsences', label: '旷会节次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '节次' },
      { key: 'classAbsences', label: '旷课节次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '节次' },
      { key: 'workAbsencePeriods', label: '旷工节次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '节次' },
      { key: 'workAbsenceDays', label: '旷工天数', type: 'number', defaultValue: 0, min: 0, step: 0.5, suffix: '天' },
    ],
    calculate: (values, maxScore) => {
      const deductions = Math.max(0, numberValue(values, 'personalLeaveDays') - 12) * 0.1
        + Math.max(0, numberValue(values, 'sickLeaveDays') - 18) * 0.05
        + (numberValue(values, 'meetingAbsences') + numberValue(values, 'classAbsences') + numberValue(values, 'workAbsencePeriods')) * 0.5
        + numberValue(values, 'workAbsenceDays') * 1
      const raw = 6 - deductions
      return {
        score: clampScore(raw, maxScore),
        summary: `满勤基础 6 分，扣分 ${roundScore(deductions)} 分，计 ${clampScore(raw, maxScore)} 分`,
      }
    },
  },
  {
    categoryId: 'score-workload',
    name: '工作量自动计分',
    fields: [
      { key: 'adminCountAsFull', label: '按学校工作需要认定行政人员满工作量', type: 'checkbox', defaultValue: false },
      { key: 'extraHours', label: '每学期平均超课时', type: 'number', defaultValue: 0, min: 0, step: 0.5, suffix: '课时' },
      { key: 'shortHours', label: '每学期平均少课时', type: 'number', defaultValue: 0, min: 0, step: 0.5, suffix: '课时' },
    ],
    calculate: (values, maxScore) => {
      if (boolValue(values, 'adminCountAsFull')) {
        return { score: clampScore(8, maxScore), summary: '按学校工作需要认定满工作量，计 8 分' }
      }
      const raw = 8 + numberValue(values, 'extraHours') * 0.5 - numberValue(values, 'shortHours') * 0.5
      return {
        score: clampScore(raw, maxScore),
        summary: `满工作量基础 8 分，超课时加 ${roundScore(numberValue(values, 'extraHours') * 0.5)} 分，少课时扣 ${roundScore(numberValue(values, 'shortHours') * 0.5)} 分，计 ${clampScore(raw, maxScore)} 分`,
      }
    },
  },
  {
    categoryId: 'score-teaching-process',
    name: '教育教学工作过程自动计分',
    fields: [
      { key: 'lessonPlanProblems', label: '教案不合格次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'missingListening', label: '少听课节数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '节' },
      { key: 'invigilationLate', label: '监考迟到场次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '场' },
      { key: 'invigilationAbsent', label: '监考缺席场次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '场' },
      { key: 'schoolPraise', label: '校本级书面通报表扬次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'schoolCriticism', label: '校本级书面通报批评次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'superiorPraise', label: '上级书面通报表扬次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'superiorCriticism', label: '上级书面通报批评次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'refusedTasks', label: '拒绝完成工作次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'offDutyCases', label: '脱岗人次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '人次' },
    ],
    calculate: (values, maxScore) => {
      const additions = numberValue(values, 'schoolPraise') * 0.15 + numberValue(values, 'superiorPraise') * 1
      const deductions = numberValue(values, 'lessonPlanProblems') * 0.01
        + numberValue(values, 'missingListening') * 0.01
        + numberValue(values, 'invigilationLate') * 0.1
        + numberValue(values, 'invigilationAbsent') * 0.5
        + numberValue(values, 'schoolCriticism') * 0.15
        + numberValue(values, 'superiorCriticism') * 2
        + numberValue(values, 'refusedTasks') * 1
        + numberValue(values, 'offDutyCases') * 1
      const raw = 3 + additions - deductions
      return {
        score: clampScore(raw, maxScore),
        summary: `常规基础 3 分，加分 ${roundScore(additions)} 分，扣分 ${roundScore(deductions)} 分，计 ${clampScore(raw, maxScore)} 分`,
      }
    },
  },
  {
    categoryId: 'score-teaching-effect',
    name: '教学效果自动计分',
    fields: [
      { key: 'tierOneSemesters', label: '教学成绩一档学期数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '学期' },
      { key: 'tierTwoSemesters', label: '教学成绩二档学期数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '学期' },
      { key: 'tierThreeSemesters', label: '教学成绩三档学期数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '学期' },
      { key: 'nonExamExcellent', label: '非统考优秀学期数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '学期' },
      { key: 'nonExamQualified', label: '非统考合格学期数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '学期' },
      { key: 'graduationMetYears', label: '毕业班达标年数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '年' },
      { key: 'graduationUnmetYears', label: '毕业班未达标年数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '年' },
      { key: 'takeoverSmall', label: '中途接班小幅提升次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'takeoverLarge', label: '中途接班明显提升次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'demoProvince', label: '省级示范课次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'demoCity', label: '市级示范课次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'demoCounty', label: '县级示范课次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'paperTasks', label: '完成校级及以上出卷任务次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'mentorYears', label: '青蓝工程师傅学年数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '学年' },
      { key: 'textbookPublished', label: '公开出版校本教材项次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '项次' },
      { key: 'textbookUsed', label: '使用未出版校本教材项次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '项次' },
      { key: 'featureHonors', label: '特色工作县级及以上荣誉项次', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '项次' },
      { key: 'sixthRetainTop', label: '六年级留任成绩前半次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
      { key: 'sixthRetainBottom', label: '六年级留任成绩后半次数', type: 'number', defaultValue: 0, min: 0, step: 1, suffix: '次' },
    ],
    calculate: (values, maxScore) => {
      const achievement = Math.min(14, numberValue(values, 'tierOneSemesters') * 2
        + numberValue(values, 'tierTwoSemesters') * 1.8
        + numberValue(values, 'tierThreeSemesters') * 1.6
        + numberValue(values, 'nonExamExcellent') * 1.9
        + numberValue(values, 'nonExamQualified') * 1.7)
      const graduation = Math.min(1, numberValue(values, 'graduationMetYears') * 0.5 + numberValue(values, 'graduationUnmetYears') * 0.2)
      const takeover = Math.min(1, numberValue(values, 'takeoverSmall') * 0.1 + numberValue(values, 'takeoverLarge') * 0.2)
      const demonstration = Math.min(1, numberValue(values, 'demoProvince') * 0.3 + numberValue(values, 'demoCity') * 0.15 + numberValue(values, 'demoCounty') * 0.08 + numberValue(values, 'paperTasks') * 0.05 + numberValue(values, 'mentorYears') * 0.05)
      const outcomes = Math.min(2, numberValue(values, 'textbookPublished') * 0.5 + numberValue(values, 'textbookUsed') * 0.3 + numberValue(values, 'featureHonors') * 0.5)
      const retained = Math.min(1, numberValue(values, 'sixthRetainTop') * 0.3 + numberValue(values, 'sixthRetainBottom') * 0.15)
      const raw = achievement + graduation + takeover + demonstration + outcomes + retained
      return {
        score: clampScore(raw, maxScore),
        summary: `教学成绩 ${roundScore(achievement)} 分，毕业班 ${roundScore(graduation)} 分，接班提升 ${roundScore(takeover)} 分，教学示范 ${roundScore(demonstration)} 分，工作成果 ${roundScore(outcomes)} 分，六年级留任 ${roundScore(retained)} 分，合计 ${roundScore(raw)} 分`,
      }
    },
  },
]

const ruleMap = new Map(rules.map(rule => [rule.categoryId, rule]))

export const getScoreRule = (categoryId?: string) => categoryId ? ruleMap.get(categoryId) : undefined

export const getInitialRuleValues = (categoryId?: string): ScoreRuleValues => {
  const rule = getScoreRule(categoryId)
  if (!rule) return {}
  return Object.fromEntries(rule.fields.map(field => [field.key, field.defaultValue]))
}

export const calculateRuleSnapshot = (
  categoryId: string | undefined,
  values: ScoreRuleValues,
  maxScore: number,
): ScoreCalculationSnapshot | null => {
  const rule = getScoreRule(categoryId)
  if (!rule) return null
  const result = rule.calculate(values, maxScore)
  return {
    ruleId: rule.categoryId,
    ruleName: rule.name,
    score: result.score,
    summary: result.summary,
    fields: Object.fromEntries(rule.fields.map(field => [field.key, values[field.key] ?? field.defaultValue])),
    warnings: result.warnings ?? [],
  }
}
