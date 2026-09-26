import { Outlet, Link, useLocation } from 'react-router-dom'
import { Upload as UploadIcon, Home, BookOpen, Settings } from 'lucide-react'

export default function Layout() {
  const location = useLocation()
  
  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Upload PDF', path: '/upload', icon: UploadIcon },
  ]

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <BookOpen size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">SkimAI</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-indigo-600' : 'text-slate-500'} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-200">
          <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium">
            <Settings size={20} className="text-slate-500" />
            Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              U
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
