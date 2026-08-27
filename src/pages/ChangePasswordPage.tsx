import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { useStore } from '../store'
import { Button } from '../components/ui'

export default function ChangePasswordPage() {
  const { changePassword, currentUser } = useStore()
  const navigate = useNavigate()
  const isFirstLogin = currentUser?.role === 'student' && currentUser.mustChangePassword
  const [oldPassword, setOldPassword] = useState(isFirstLogin ? '123456' : '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!oldPassword || !newPassword) {
      setMessage('请填写原密码和新密码')
      setSuccess(false)
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('两次输入的新密码不一致')
      setSuccess(false)
      return
    }
    if (newPassword.length < 6 || newPassword === '123456' || newPassword === oldPassword) {
      setMessage('新密码至少 6 位，不能与原密码或初始密码相同')
      setSuccess(false)
      return
    }

    const result = await changePassword(oldPassword, newPassword)
    setMessage(result.message)
    setSuccess(result.ok)
    if (result.ok) {
      window.setTimeout(() => navigate(currentUser?.role === 'admin' ? '/' : '/submit', { replace: true }), 500)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center py-8 px-2">
      <section className="ds-panel w-full max-w-xl overflow-hidden shadow-xl shadow-slate-300/25">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="w-11 h-11 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-4 shadow-sm shadow-blue-200">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{isFirstLogin ? '首次登录修改密码' : '修改登录密码'}</h1>
          <p className="text-sm text-slate-500 mt-2">
            {currentUser?.name}，
            {isFirstLogin
              ? '为了避免账号被冒用，修改初始密码后才能提交评分申报材料。'
              : currentUser?.role === 'admin'
                ? '可在这里修改审核端管理员密码，修改后请妥善保存新密码。'
                : '可在这里修改自己的登录密码，建议使用不容易被猜到的新密码。'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">{isFirstLogin ? '初始密码' : '原密码'}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={event => setOldPassword(event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={isFirstLogin ? '默认初始密码 123456' : '请输入当前登录密码'}
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">新密码</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="至少 6 位，不能继续使用 123456"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">确认新密码</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>

          {message && (
            <div className={`px-3 py-2 rounded-lg text-sm ${success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isFirstLogin ? '完成激活' : '保存新密码'}
          </Button>
        </form>
      </section>
    </div>
  )
}
