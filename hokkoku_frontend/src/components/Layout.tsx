import { ReactNode, useState } from 'react'
import { Users, Calendar, Settings, Home, ChevronLeft, ChevronRight, CalendarCheck2, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'

interface LayoutProps {
  children: ReactNode
  activeTab?: string
  onTabChange?: (tabId: string) => void;
}

interface NavItem {
  id: string
  label: string
  icon: typeof Home
  badge?: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', icon: Home },
  { id: 'upload', label: '従業員管理', icon: Users },
  { id: 'schedule', label: 'シフト作成', icon: Calendar },
  { id: 'requests', label: '申請一覧', icon: ClipboardCheck },
  { id: 'settings', label: '設定', icon: Settings },
]

export function Layout({ children, activeTab = 'upload', onTabChange }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className={cn(
          "h-screen sticky top-0 bg-secondary text-secondary-foreground transition-all duration-300 ease-in-out flex flex-col",
          sidebarOpen ? "w-80" : "w-20"
        )}>
          <div className={cn("flex items-center justify-center h-20 border-b border-border/10", sidebarOpen ? "px-6" : "px-2")}>
            <CalendarCheck2 className="w-8 h-8 text-accent" />
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-primary-foreground ml-3 tracking-tight">
                AIシフト作成ツール
              </h1>
            )}
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange && onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    "hover:bg-muted/20",
                    isActive && "bg-gradient-to-r from-accent to-accent/70 text-accent-foreground shadow-lg shadow-accent/20"
                  )}
                  title={item.label}
                >
                  <Icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-accent-foreground" : "text-muted-foreground"
                  )} />
                  {sidebarOpen && (
                    <span className={cn(
                      "flex-1 text-left",
                      isActive ? "text-accent-foreground" : "text-primary-foreground"
                    )}>
                      {item.label}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
          <div className="p-4 border-t border-border/10">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted/20 transition-colors duration-200"
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
            <div className="px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3"></div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">管理者</p>
                  <p className="text-xs text-muted-foreground">admin@hokkoku-bank.co.jp</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/70 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-accent-foreground">管</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
