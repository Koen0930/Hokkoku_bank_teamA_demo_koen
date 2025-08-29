import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  CalendarCheck2,
  AlertTriangle,
  MessageSquare,
  Info,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
} from "lucide-react"
import { toast } from "sonner"
import { MicroAdjustments } from "./MicroAdjustments"


// ─── types ─────────────────────────────────────────
interface Employee {
  id: number
  name: string
  email: string
  role: string
  skill_level: number
}

interface Shift {
  id: number
  employee_id: number
  date: string
  start_time: string
  end_time: string
}

interface StructuredWarning {
  type: string
  message: string
  employee_id?: number
  date?: string
  affected_employees?: number[]
  affected_dates?: string[]
}

interface ChatMessage {
  role: 'ai' | 'user'
  content: string
}

type ShiftTypeId = 'in_shift' | 'off'
type TimeSlotId = '8-16' | '16-24' | '0-8'

const DAYS_PER_WEEK = 7



const getWeekStart = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}



export const ShiftSchedule = () => {
  const [schedule, setSchedule] = useState<Record<number, Record<number, Record<string, ShiftTypeId>>>>(() => {
    const saved = localStorage.getItem('shift_schedule')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved schedule:', e)
      }
    }
    return {}
  })
  const [warnings, setWarnings] = useState<string[]>(() => {
    const saved = localStorage.getItem('shift_warnings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved warnings:', e)
      }
    }
    return []
  })
  const [structuredWarnings, setStructuredWarnings] = useState<StructuredWarning[]>(() => {
    const saved = localStorage.getItem('shift_structured_warnings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved structured warnings:', e)
      }
    }
    return []
  })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [llmAnalysis, setLlmAnalysis] = useState<string>('')
  const [isLlmEnabled, setIsLlmEnabled] = useState(false)
  const API_URL = (import.meta as any).env.VITE_API_URL || ''
  const [showConstraints, setShowConstraints] = useState(false)
  const [isAiChatOpen, setIsAiChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: 'こんにちは、生成AIによるシフト作成を行います、希望の条件を入力してください' }
  ])
  const [userInput, setUserInput] = useState('')
  const [generatedShifts, setGeneratedShifts] = useState<Shift[]>([])

  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [renderedDays, setRenderedDays] = useState<Date[]>(() => {
    const weekStart = getWeekStart(new Date())
    const arr: Date[] = []
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      arr.push(d)
    }
    return arr
  })

  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchEmployees = useCallback(async () => {
    try {
      const apiBase = API_URL as string
      const headers: HeadersInit = {}
      let apiUrl = apiBase
      if (apiBase.includes('@')) {
        const m = apiBase.match(/https:\/\/([^:]+):([^@]+)@(.+)/)
        if (m) {
          const [, u, p, domain] = m
          headers['Authorization'] = `Basic ${btoa(`${u}:${p}`)}`
          apiUrl = `https://${domain}`
        }
      }
      const response = await fetch(`${apiUrl}/api/employees`, { headers })
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      } else {
        console.error('Failed to fetch employees:', response.statusText)
        setEmployees([])
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      setEmployees([])
    }
  }, [API_URL])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    localStorage.setItem('shift_schedule', JSON.stringify(schedule))
  }, [schedule])

  useEffect(() => {
    localStorage.setItem('shift_warnings', JSON.stringify(warnings))
  }, [warnings])

  useEffect(() => {
    localStorage.setItem('shift_structured_warnings', JSON.stringify(structuredWarnings))
  }, [structuredWarnings])

  useEffect(() => {
    const arr: Date[] = []
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + i)
      arr.push(d)
    }
    setRenderedDays(arr)
  }, [currentWeekStart])

  // ─── Check LLM enabled status ────────────────
  useEffect(() => {
    const apiKey = localStorage.getItem('chatgpt_api_key')
    setIsLlmEnabled(!!apiKey)
  }, [])

  // ─── 初期スクロール位置（今日） ────────────────
  useEffect(() => {
    if (!scrollRef.current) return

    const container = scrollRef.current;
    container.scrollTo({ left: 0, behavior: 'auto' });
  }, [renderedDays.length])

  // ─── LLM analysis function ─────────────────────
  const analyzeDifficulties = async (optimizationStatus: string, warnings: string[], errorContent: string = '') => {
    if (!isLlmEnabled) return
    
    const apiKey = localStorage.getItem('chatgpt_api_key')
    if (!apiKey) return
    
    try {
      const apiBase = API_URL as string
      const baseHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
      let apiUrl = apiBase
      if (apiBase && apiBase.includes('@')) {
        const m = apiBase.match(/https:\/\/([^:]+):([^@]+)@(.+)/)
        if (m) {
          const [, u, p, domain] = m
          ;(baseHeaders as any)['Authorization'] = `Basic ${btoa(`${u}:${p}`)}`
          apiUrl = `https://${domain}`
        }
      }
      const response = await fetch(`${apiUrl}/api/shifts/analyze-difficulty`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          error_content: errorContent,
          optimization_status: optimizationStatus,
          warnings: warnings
        })
      })
      const data = await response.json()
      setLlmAnalysis(data.analysis || 'LLM分析でエラーが発生しました')
    } catch (error) {
      console.error('LLM analysis failed:', error)
      setLlmAnalysis('LLM分析でエラーが発生しました')
    }
  }

  const generateShifts = useCallback(async () => {
    if (!employees.length) {
      toast.warning("従業員データがありません。")
      return
    }
    
    const weekStart = currentWeekStart
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    setIsGenerating(true)
    setProgress(0)
    setProgressMessage('制約条件を準備中...')
    setWarnings([])
    setLlmAnalysis('')

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 90) return prev + 2
        return prev
      })
    }, 100)

    try {
      const apiBase = API_URL as string
      const baseHeaders: HeadersInit = { 'Content-Type': 'application/json' }
      let apiUrl = apiBase
      if (apiBase.includes('@')) {
        const m = apiBase.match(/https:\/\/([^:]+):([^@]+)@(.+)/)
        if (m) {
          const [, u, p, domain] = m
          ;(baseHeaders as any)['Authorization'] = `Basic ${btoa(`${u}:${p}`)}`
          apiUrl = `https://${domain}`
        }
      }
      const res = await fetch(`${apiUrl}/api/shifts/generate`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          start_date: weekStart.toISOString().split('T')[0],
          end_date: weekEnd.toISOString().split('T')[0],
          employee_ids: employees.map(e => e.id),
          constraints: []
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'シフト生成に失敗しました')
      }

      const data = await res.json()

      if (data.optimization_status === 'INFEASIBLE') {
        throw new Error('制約条件を満たすシフトを生成できませんでした。条件を緩和してください。')
      }

      setProgress(100)
      setProgressMessage('完了')
      
      if (isLlmEnabled) {
        await analyzeDifficulties(data.optimization_status || 'FEASIBLE', data.warnings || [])
      }
      
      toast.success(`シフト生成完了 (${data.shifts?.length || 0} 件)`)
      setWarnings(data.warnings || [])
      setStructuredWarnings(data.structured_warnings || [])
      
      const newSch: Record<number, Record<number, Record<string, ShiftTypeId>>> = {}
      const generatedShiftsList: Shift[] = []
      
      data.shifts?.forEach((s: Shift) => {
        generatedShiftsList.push(s)
        
        const day = new Date(s.date).getUTCDate()
        const startTime = s.start_time.split(":")[0]
        
        let timeSlotId: TimeSlotId;
        if (startTime >= '08' && startTime < '16') timeSlotId = '8-16'
        else if (startTime >= '16' && startTime < '24') timeSlotId = '16-24'
        else timeSlotId = '0-8'

        let shiftId: ShiftTypeId;
        if (s.start_time.startsWith("08:") || s.start_time.startsWith("16:") || s.start_time.startsWith("00:")) {
          shiftId = "in_shift"
        } else {
          shiftId = "off"
        }

        newSch[s.employee_id] ??= {}
        newSch[s.employee_id][day] ??= {}
        newSch[s.employee_id][day][timeSlotId] = shiftId
      })
      setSchedule(newSch)
      setGeneratedShifts(generatedShiftsList)
      
      clearInterval(progressInterval)
      setIsGenerating(false)
      setProgress(0)
      setProgressMessage('')
    } catch (error) {
      console.error('Shift generation failed:', error)
      clearInterval(progressInterval)
      setIsGenerating(false)
      setProgress(0)
      setProgressMessage('')
      
      if (isLlmEnabled) {
        await analyzeDifficulties('INFEASIBLE', [], error instanceof Error ? error.message : 'エラーが発生しました')
      }
      
      toast.error('シフト生成に失敗しました')
    }
  }, [employees, currentWeekStart, isLlmEnabled, API_URL])



  const handlePrevWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev)
      newStart.setDate(prev.getDate() - 7)
      return newStart
    })
  }, [])

  const handleNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev)
      newStart.setDate(prev.getDate() + 7)
      return newStart
    })
  }, [])

  const handleGoToThisWeek = useCallback(() => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }, [])

  const handleSendMessage = useCallback(() => {
    if (!userInput.trim()) return
    
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: userInput },
      { role: 'ai', content: 'ありがとうございます。現在、AI機能は開発中です。今後のアップデートをお待ちください。' }
    ])
    setUserInput('')
  }, [userInput])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])





  return (
    <TooltipProvider>

    <div className="space-y-6">
      {/* generate button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5" />
            シフト生成
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={generateShifts} 
            disabled={isGenerating || !employees.length}
            className="w-full"
          >
            {isGenerating ? `生成中... ${progress}%` : 'シフトを生成'}
          </Button>
          {isGenerating && (
            <div className="mt-4 space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center">{progressMessage}</p>
            </div>
          )}
          
          <Dialog open={isAiChatOpen} onOpenChange={setIsAiChatOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                disabled={!employees.length}
                className="w-full mt-2"
              >
                <BrainCircuit className="w-4 h-4 mr-2" />
                生成AIによるシフト作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5" />
                  生成AIによるシフト作成
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col h-[500px]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 border rounded-lg bg-gray-50">
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border shadow-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="希望の条件を入力してください..."
                    className="flex-1 min-h-[60px]"
                  />
                  <Button onClick={handleSendMessage} disabled={!userInput.trim()}>
                    送信
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <MicroAdjustments 
        generatedShifts={generatedShifts}
        schedule={schedule}
        employees={employees}
        currentWeekStart={currentWeekStart}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onGoToThisWeek={handleGoToThisWeek}
        onShiftChange={() => {}}
        warnings={structuredWarnings.map(w => ({
          employee_id: w.employee_id || 0,
          date: w.date || '',
          message: w.message
        }))}
      />

      {/* OR-Tools制約条件と目的関数の説明 */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle 
            className="flex items-center justify-between text-blue-900 text-base cursor-pointer"
            onClick={() => setShowConstraints(!showConstraints)}
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              OR-Tools最適化エンジンの制約条件と目的関数
            </div>
            {showConstraints ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showConstraints && (
          <CardContent>
            <div className="space-y-4 text-sm text-blue-800">
              <div>
                <h4 className="font-semibold mb-2">制約条件</h4>
                <ul className="space-y-1.5 pl-4">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span><strong>人員配置制約:</strong> 各時間帯（8-16時、16-24時、0-8時）で最低1人、最大3人を配置</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span><strong>管理職制約:</strong> 各時間帯で管理職を1人以上2人以下配置（管理職が在籍している場合）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span><strong>スキルレベル制約:</strong> 各時間帯でスキルレベルの合計を15以上確保</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span><strong>個人シフト制限:</strong> 従業員1人あたり週最大10シフトまで</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span><strong>シフトタイプ制限:</strong> 各シフトタイプ（早番・遅番・夜勤）で週最大3回まで</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span><strong>連続シフト制約:</strong> 連続する異なるシフトタイプの組み合わせを制限</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">目的関数</h4>
                <p className="pl-4">
                  <span className="text-blue-600">•</span> <strong>負荷均等化:</strong> 従業員間のシフト数の最大値を最小化し、公平な負荷分散を実現
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>最適化エンジン:</strong> Google OR-Tools CP-SAT ソルバーを使用し、30秒以内で最適解または実行可能解を探索します。
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* LLM分析結果表示 */}
      {isLlmEnabled && llmAnalysis && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900 text-base">
              <MessageSquare className="w-5 h-5" />
              LLMからのシフト作成構成する際に難しかった点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-800 whitespace-pre-wrap">{llmAnalysis}</p>
          </CardContent>
        </Card>
      )}

      {/* warnings */}
      {!!warnings.length && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 text-base">
              <AlertTriangle className="w-5 h-5" />
              生成結果に関する警告
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={i} className="pl-2 border-l-2 border-amber-200 text-sm text-amber-800">
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </div>
    </TooltipProvider>
  )
}
