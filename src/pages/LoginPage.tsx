import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, FileImage, GraduationCap, ShieldCheck, UserRound } from 'lucide-react'
import { useStore } from '../store'
import type { UserRole } from '../types'

export default function LoginPage() {
  const { currentUser, login } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [role, setRole] = useState<UserRole>('student')
  const [username, setUsername] = useState('2021001')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')

  if (currentUser) {
    return <Navigate to={currentUser.role === 'student' ? (currentUser.mustChangePassword ? '/change-password' : '/submit') : '/'} replace />
  }

  const from = typeof location.state === 'object' && location.state && 'from' in location.state
    ? String(location.state.from)
    : ''

  const switchRole = (nextRole: UserRole) => {
    setRole(nextRole)
    setUsername(nextRole === 'student' ? '2021001' : 'admin')
    setPassword(nextRole === 'student' ? '123456' : 'admin123')
    setError('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = login(role, username, password)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate(role === 'student' && result.message.includes('首次登录') ? '/change-password' : from || (role === 'student' ? '/submit' : '/'), { replace: true })
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-3 sm:px-4 py-4 sm:py-8">
      <div className="w-full max-w-5xl grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] bg-white border border-blue-100 rounded-lg overflow-hidden shadow-2xl shadow-blue-200/35">
        <section className="min-w-0 p-6 sm:p-8 lg:p-10 bg-blue-50/90 text-slate-900 flex flex-col justify-between lg:min-h-[560px] border-r border-blue-100">
          <div>
            <div className="inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-white ring-1 ring-blue-100 shadow-sm">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">评分系统</span>
            </div>
            <h1 className="mt-8 lg:mt-10 text-3xl sm:text-4xl lg:text-[42px] font-bold leading-tight tracking-normal break-words">
              加分项申报、材料审核、分数排名一站式完成
            </h1>
            <p className="mt-4 sm:mt-5 text-sm sm:text-base text-slate-600 leading-7 max-w-xl">
              面向内部百人规模使用，用户按名单登录后上传加分项和证明图片，审核端在线预览材料并认定分数，截止后自动汇总个人明细和总分排名。
            </p>

            <div className="mt-8 grid gap-3">
              {[
                { icon: FileImage, title: '上传证明', desc: '图片材料直接预览，减少下载和反复确认' },
                { icon: ClipboardCheck, title: '在线审核', desc: '支持通过、驳回、调整分数和审核意见' },
                { icon: CheckCircle2, title: '形成排名', desc: '按规则核算总分，导出结果用于公示归档' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white/85 px-3 py-3 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-8 lg:mt-10">
            {[
              ['100+', '内部评价规模'],
              ['图片', '证明材料预览'],
              ['Excel', '排名一键导出'],
            ].map(([value, label]) => (
              <div key={label} className="border border-blue-100 bg-white/85 rounded-lg p-3 sm:p-4 shadow-sm">
                <p className="text-xl sm:text-2xl font-bold text-blue-700">{value}</p>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 p-5 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-7">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
              名单制账号激活
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-4">登录系统</h2>
            <p className="text-sm text-slate-500 mt-2 leading-6">
              用户首次使用初始密码 123456 登录，修改密码后才能上传材料。审核账号：admin / admin123
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-blue-50 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => switchRole('student')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                role === 'student' ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-slate-500 hover:text-blue-700'
              }`}
            >
              <UserRound className="w-4 h-4" />
              用户端
            </button>
            <button
              type="button"
              onClick={() => switchRole('admin')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                role === 'admin' ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-slate-500 hover:text-blue-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              审核端
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{role === 'student' ? '用户编号' : '账号'}</span>
              <input
                value={username}
                onChange={event => setUsername(event.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={role === 'student' ? '请输入用户编号' : '请输入审核账号'}
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">密码</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入密码"
              />
            </label>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200/70"
            >
              进入系统
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}


