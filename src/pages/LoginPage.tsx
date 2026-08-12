import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { useStore } from '../store'
import type { UserRole } from '../types'

type LoginMode = 'login' | 'activate'

export default function LoginPage() {
  const { activateWithInvite, currentUser, isLoading, login } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<LoginMode>('login')
  const [role, setRole] = useState<UserRole>('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isLoading) {
    return <div className="min-h-dvh flex items-center justify-center text-sm text-slate-500">正在连接服务器...</div>
  }

  if (currentUser) {
    return <Navigate to={currentUser.role === 'student' ? (currentUser.mustChangePassword ? '/change-password' : '/submit') : '/'} replace />
  }

  const from = typeof location.state === 'object' && location.state && 'from' in location.state
    ? String(location.state.from)
    : ''

  const switchRole = (nextRole: UserRole) => {
    setRole(nextRole)
    setMode('login')
    setUsername('')
    setPassword('')
    setError('')
  }

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode)
    setRole('student')
    setUsername('')
    setPassword('')
    setInviteCode('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
  }

  const handleLogin = async () => {
    const result = await login(role, username, password)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate(
      role === 'student' && result.currentUser?.mustChangePassword
        ? '/change-password'
        : from || (role === 'student' ? '/submit' : '/'),
      { replace: true },
    )
  }

  const handleActivate = async () => {
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    const result = await activateWithInvite(username, inviteCode, newPassword)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate('/submit', { replace: true })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'activate') await handleActivate()
      else await handleLogin()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-8 sm:py-10">
      <section className="w-full max-w-[430px] rounded-lg border border-blue-100 bg-white/95 p-5 shadow-2xl shadow-blue-200/35 sm:p-7">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-200/70">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">评分系统</h1>
          <p className="mt-2 text-sm text-slate-500">请选择身份并完成登录</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-blue-50 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
              mode === 'login' ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-slate-500 hover:text-blue-700'
            }`}
          >
            <UserRound className="h-4 w-4" />
            账号登录
          </button>
          <button
            type="button"
            onClick={() => switchMode('activate')}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
              mode === 'activate' ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-slate-500 hover:text-blue-700'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            邀请码激活
          </button>
        </div>

        {mode === 'login' && (
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => switchRole('student')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
                role === 'student' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-blue-700'
              }`}
            >
              <UserRound className="h-4 w-4" />
              用户端
            </button>
            <button
              type="button"
              onClick={() => switchRole('admin')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
                role === 'admin' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-blue-700'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              审核端
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{role === 'student' ? '用户编号' : '账号'}</span>
            <input
              value={username}
              onChange={event => setUsername(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={mode === 'activate' ? '请输入用户编号' : role === 'student' ? '请输入用户编号' : '请输入审核账号'}
            />
          </label>

          {mode === 'login' ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">密码</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入密码"
              />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">邀请码</span>
                <input
                  value={inviteCode}
                  onChange={event => setInviteCode(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入管理员发放的邀请码"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">设置密码</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请设置登录密码"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">确认密码</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请再次输入密码"
                />
              </label>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-200/70 transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? '处理中...' : mode === 'activate' ? '完成激活' : '进入系统'}
          </button>
        </form>
      </section>
    </div>
  )
}
