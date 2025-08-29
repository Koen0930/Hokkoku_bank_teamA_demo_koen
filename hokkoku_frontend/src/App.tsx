import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, Users, Search, Filter, Download, Sparkles, FileSpreadsheet, TrendingUp, Edit, Trash2, Eye, Mail, UserPlus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Layout } from '@/components/Layout'
import { ContextMenu } from '@/components/ContextMenu'
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { cn } from '@/lib/utils'

interface Employee {
  id: number
  name: string
  email: string | null
  role: string
  skill_level: number
  created_at: string
  updated_at: string
}

interface ImportResponse {
  message: string
  imported_count: number
  employees: Employee[]
}

interface StatCard {
  title: string
  value: string | number
  change?: string
  icon: typeof Users
}

import { ShiftSchedule } from '@/components/ShiftSchedule'
import { SettingsPage } from '@/components/SettingsPage'
import { ShiftRequests } from '@/components/ShiftRequests'
import { DashboardPage } from '@/components/DashboardPage'

function App() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading && progress < 90) {
      timer = setTimeout(() => setProgress(prev => prev + 1), 20);
    } else if (loading && progress >= 90 && progress < 100) {
      // Hold at 90% until loading is almost complete
    }
    return () => {
      clearTimeout(timer);
    };
  }, [loading, progress]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('CSVファイルのみアップロード可能です');
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('ファイルサイズが大きすぎます（最大10MB）');
      return
    }

    setLoading(true)
    setLoadingEmployees(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      let apiUrl = API_URL;
      const headers: HeadersInit = {};
      
      if (API_URL.includes('@')) {
        const urlMatch = API_URL.match(/https:\/\/([^:]+):([^@]+)@(.+)/);
        if (urlMatch) {
          const [, username, password, domain] = urlMatch;
          apiUrl = `https://${domain}`;
          headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
        }
      }

      const response = await fetch(`${apiUrl}/api/employees/import`, {
        method: 'POST',
        body: formData,
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json()
        let errorMessage = errorData.detail || 'アップロードに失敗しました'
        
        if (errorMessage.includes('Missing required columns:')) {
          const missingCols = errorMessage.match(/Missing required columns: (.+)/)?.[1]
          errorMessage = `CSVファイルに必要な列が不足しています: ${missingCols}\n必要な列: id, name, role, skill_level`
        } else if (errorMessage.includes('必要な列が不足しています')) {
        } else if (errorMessage.includes('行')) {
        } else if (errorMessage.includes('encoding') || errorMessage.includes('decode')) {
          errorMessage = 'CSVファイルの文字エンコーディングに問題があります。UTF-8形式で保存してください。'
        } else if (errorMessage.includes('empty') || errorMessage.includes('空')) {
          errorMessage = 'CSVファイルが空か、正しい形式ではありません。'
        } else if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
          errorMessage = 'サーバーとの通信に失敗しました。ネットワーク接続を確認してください。'
        } else if (errorMessage.includes('NetworkError') || errorMessage.includes('TypeError')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
        } else if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
          errorMessage = 'サーバーの応答がタイムアウトしました。しばらく待ってから再試行してください。'
        }
        
        throw new Error(errorMessage)
      }

      const data: ImportResponse = await response.json()
      
      setProgress(100)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setEmployees(data.employees)
      toast.success(data.message);
    } catch (error) {
      let errorMessage = 'アップロードに失敗しました';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'サーバーとの通信に失敗しました。ネットワーク接続を確認してください。';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      setProgress(0)
    } finally {
      setLoading(false)
      setLoadingEmployees(false)
    }
  }, [API_URL])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      const dragDropArea = document.getElementById('drag-drop-area');
      if (dragDropArea && !dragDropArea.contains(e.relatedTarget as Node)) {
        setDragActive(false);
      }
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }, [handleFileUpload])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0])
      e.target.value = ''
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'manager': 
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'senior_staff': 
        return 'bg-green-100 text-green-800 border-green-200'
      case 'staff': 
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default: 
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'manager': return '管理職'
      case 'senior_staff': return '上級スタッフ'
      case 'staff': return 'スタッフ'
      default: return role
    }
  }

  const stats: StatCard[] = [
    {
      title: '総従業員数',
      value: employees.length,
      change: '+12%',
      icon: Users,
    },
    {
      title: '平均スキルレベル',
      value: employees.length > 0 
        ? (employees.reduce((sum, emp) => sum + emp.skill_level, 0) / employees.length).toFixed(1)
        : '0',
      icon: TrendingUp,
    },
    {
      title: '管理職数',
      value: employees.filter(emp => emp.role === 'manager').length,
      icon: Sparkles,
    }
  ]

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getRoleLabel(employee.role).includes(searchQuery)
  )

  const getEmployeeContextMenuItems = (employee: Employee) => [
    { label: '詳細を表示', icon: <Eye className="w-4 h-4" />, onClick: () => console.log('View details', employee) },
    { label: '編集', icon: <Edit className="w-4 h-4" />, onClick: () => console.log('Edit', employee) },
    { separator: true },
    { label: 'メールを送信', icon: <Mail className="w-4 h-4" />, onClick: () => console.log('Send email', employee), disabled: !employee.email },
    { label: 'シフトに追加', icon: <UserPlus className="w-4 h-4" />, onClick: () => console.log('Add to shift', employee) },
    { separator: true },
    { label: '削除', icon: <Trash2 className="w-4 h-4 text-destructive" />, onClick: () => console.log('Delete', employee) },
  ]

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
        disabled={loading}
      />
      <div className="space-y-8">
        {activeTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
        {activeTab === 'upload' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">従業員管理</h1>
                <p className="text-muted-foreground">従業員データのインポート、表示、編集を行います。</p>
              </div>
              {employees.length > 0 && (
                <Button onClick={handleButtonClick}>
                  <Upload className="w-4 h-4 mr-2" />
                  CSVを再アップロード
                </Button>
              )}
            </div>

            {employees.length === 0 && !loadingEmployees ? (
              <div className="text-center flex flex-col items-center justify-center h-[calc(100vh-20rem)] animate-fade-in">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <FileSpreadsheet className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">従業員データをインポート</h2>
                <p className="text-muted-foreground max-w-md mb-8">CSVファイルをドラッグ＆ドロップするか、下のボタンから選択して、従業員データの管理を始めましょう。</p>
                <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/20 rounded-lg max-w-md">
                  <p className="font-medium mb-2">📋 必要なCSV列:</p>
                  <p className="font-mono text-xs">id, name, role, skill_level</p>
                  <p className="mt-1">例: 1,田中太郎,一般職員,3 (スキルレベル: 1-10)</p>
                </div>
                <div
                  id="drag-drop-area"
                  className={cn(
                    "relative overflow-hidden w-full max-w-lg border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300",
                    dragActive 
                      ? "border-primary bg-primary/10 scale-[1.02]"
                      : "border-muted/50 hover:border-primary/50 hover:bg-primary/5",
                    loading && "pointer-events-none opacity-60"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-4">
                    <Upload className={cn("w-10 h-10 transition-all duration-300", dragActive ? "text-primary" : "text-muted-foreground")} />
                    <p className="text-lg font-medium text-foreground">
                      CSVファイルをドラッグ&amp;ドロップ
                    </p>
                    <p className="text-muted-foreground">または</p>
                    <Button 
                      onClick={handleButtonClick}
                      disabled={loading} 
                      size="lg"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft-glow transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      ファイルを選択
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const csvContent = "id,name,role,skill_level,email\n1,田中太郎,一般職員,3,tanaka@example.com\n2,佐藤花子,主任,4,sato@example.com\n3,鈴木次郎,一般職員,2,suzuki@example.com\n4,高橋美咲,係長,5,takahashi@example.com\n5,山田健一,manager,8,yamada@example.com\n6,佐藤太郎,senior staff,7,sato2@example.com\n7,鈴木美咲,staff,6,suzuki2@example.com\n8,高橋次郎,manager,9,takahashi2@example.com\n9,田中花子,senior staff,10,tanaka2@example.com\n10,佐藤健一,一般職員,1,sato3@example.com"
                        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
                        const link = document.createElement('a')
                        link.href = URL.createObjectURL(blob)
                        link.download = 'employee_template.csv'
                        link.click()
                      }}
                      className="mt-2"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      テンプレートをダウンロード
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {loadingEmployees ? (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>アップロード中...</CardTitle>
                  <CardDescription>ファイルを処理しています。しばらくお待ちください。</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <Progress value={progress} className="w-full" />
                  <p className="text-right text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
                </CardContent>
              </Card>
            ) : null}

            {employees.length > 0 && (
              <div className="animate-fade-in-up space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {stats.map((stat, index) => {
                    const Icon = stat.icon
                    return (
                      <Card key={index} className="card-hover">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Icon className="w-6 h-6 text-primary" />
                            </div>
                            {stat.change && (
                              <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded-full">
                                {stat.change}
                              </span>
                            )}
                          </div>
                          <h3 className="text-3xl font-bold text-foreground mb-1 tracking-tight">{stat.value}</h3>
                          <p className="text-sm text-muted-foreground">{stat.title}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">従業員一覧</CardTitle>
                        <CardDescription>{filteredEmployees.length}名の従業員</CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-64"
                          />
                        </div>
                        <Button variant="outline">
                          <Filter className="h-4 w-4 mr-2" />
                          フィルター
                        </Button>
                        <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          エクスポート
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-4 font-semibold text-muted-foreground text-sm">ID</th>
                            <th className="text-left p-4 font-semibold text-muted-foreground text-sm">名前</th>
                            <th className="text-left p-4 font-semibold text-muted-foreground text-sm">メール</th>
                            <th className="text-left p-4 font-semibold text-muted-foreground text-sm">役職</th>
                            <th className="text-left p-4 font-semibold text-muted-foreground text-sm">スキルレベル</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEmployees.map((employee, index) => (
                            <ContextMenu key={employee.id} items={getEmployeeContextMenuItems(employee)}>
                              <tr 
                                className={cn(
                                  "border-b hover:bg-muted/10 transition-colors cursor-pointer",
                                  "animate-fade-in-up"
                                )}
                                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                              >
                                <td className="p-4">
                                  <span className="font-mono text-sm text-muted-foreground">#{employee.id.toString().padStart(3, '0')}</span>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                                      <span className="font-semibold text-primary">
                                        {employee.name.charAt(0)}
                                      </span>
                                    </div>
                                    <span className="font-medium text-foreground">{employee.name}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-muted-foreground text-sm">{employee.email || '-'}</span>
                                </td>
                                <td className="p-4">
                                  <Badge variant="outline" className={cn("text-xs font-medium", getRoleBadgeVariant(employee.role))}>
                                    {getRoleLabel(employee.role)}
                                  </Badge>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => {
                                      const starValue = i + 1;
                                      const skillLevel = employee.skill_level;
                                      const normalizedSkill = Math.min(Math.max(skillLevel / 2, 0), 5);
                                      const isFilled = starValue <= normalizedSkill;
                                      const isHalfFilled = starValue - 0.5 <= normalizedSkill && starValue > normalizedSkill;
                                      
                                      return (
                                        <Star
                                          key={i}
                                          className={`w-4 h-4 transition-colors duration-300 ${
                                            isFilled 
                                              ? "text-yellow-400 fill-yellow-400" 
                                              : isHalfFilled 
                                                ? "text-yellow-400 fill-yellow-400/50"
                                                : "text-muted-foreground"
                                          }`}
                                        />
                                      );
                                    })}
                                    <span className="ml-1 text-sm font-medium text-foreground">
                                      {employee.skill_level}/10
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            </ContextMenu>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
        {activeTab === 'schedule' && <ShiftSchedule />}
        {activeTab === 'requests' && <ShiftRequests />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>
    </Layout>
  )
}

export default App
