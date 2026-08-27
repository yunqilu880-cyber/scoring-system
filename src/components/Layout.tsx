import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  FilePlus2,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Trophy,
  Users,
} from 'lucide-react'
import { isStaticPreview, useStore } from '../store'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { currentUser, logout } = useStore()
  const navigate = useNavigate()

  const navItems = currentUser?.role === 'student'
    ? [
        { to: '/submit', icon: FilePlus2, label: '我的申报', end: true },
        { to: '/change-password', icon: KeyRound, label: '修改密码' },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: '工作台', end: true },
        { to: '/users', icon: Users, label: '申报人数据' },
        { to: '/rules', icon: Settings2, label: '评分规则' },
        { to: '/review', icon: ClipboardCheck, label: '材料复评' },
        { to: '/results', icon: Trophy, label: '排名结果' },
        { to: '/change-password', icon: KeyRound, label: '修改密码' },
      ]

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <>
      <div className="h-16 flex items-center gap-3 px-5 border-b border-blue-100 shrink-0">
        <div className="w-10 h-10 rounded-lg bg-blue-600 text-white ring-1 ring-blue-200 flex items-center justify-center shadow-sm shadow-blue-200">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-base text-slate-900 leading-5">评分系统</p>
          <p className="text-xs text-blue-600 mt-0.5">Bonus Review</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-blue-100 shrink-0">
        <div className="mb-3 rounded-lg bg-blue-50/80 ring-1 ring-blue-100 px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-900 truncate">{currentUser?.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentUser?.role === 'student' ? currentUser.studentId : '管理端'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-dvh bg-transparent">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white/95 border-r border-blue-100 shadow-xl shadow-blue-100/40 shrink-0">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="关闭导航"
            className="absolute inset-0 bg-blue-950/25 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-2xl shadow-blue-950/20">
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto flex flex-col">
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 bg-white/85 backdrop-blur border-b border-slate-200/80 shadow-sm shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            aria-label="打开导航"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-slate-900">评分系统</span>
        </div>

        <div className="p-3 sm:p-4 lg:p-6 flex-1">
          {isStaticPreview && (
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-800 shadow-sm">
              GitHub 预览模式：当前使用浏览器演示数据，方便查看界面和流程；正式登录、上传和数据保存请使用服务器地址。
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  )
}


