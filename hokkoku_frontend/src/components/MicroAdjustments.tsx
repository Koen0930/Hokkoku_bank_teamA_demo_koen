import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ShiftTable } from './ShiftTable'
import { MessageSquare, X } from "lucide-react"

type TimeSlotId = '8-16' | '16-24' | '0-8'

type Shift = {
  id?: number | null
  employee_id: number
  date: string
  start_time: string
  end_time: string
}

type ChangeSet = {
  id: string
  created_at: string
  rule: Record<string, any>
  deltas: any[]
  score: number
  week_start: string
  week_end: string
  schedule_version: number
}

type SchedulePreviewResponse = {
  week_start: string
  week_end: string
  shifts: Shift[]
  added: Shift[]
  removed: Shift[]
  updated: { before: Shift; after: Shift }[]
  change_set: ChangeSet
}

type ChatParseResponse = {
  ok: boolean
  rule: any | null
  needs_disambiguation: boolean
  choices: Record<string, string[]>
}

type ChatShiftAdjustResponse = {
  message_id: string
  intent: string
  confidence: number
  assistant_text: string
  adjustment_rule: any | null
  preview: any | null
}

type Employee = {
  id: number
  name: string
}

type Mode = 'idle' | 'parsing' | 'generating_proposals' | 'previewing' | 'applied' | 'llm_processing'

const slots: { id: TimeSlotId; label: string; starts: string[] }[] = [
  { id: '8-16', label: '8-16', starts: ['08:'] },
  { id: '16-24', label: '16-24', starts: ['16:'] },
  { id: '0-8', label: '0-8', starts: ['00:', '0:'] },
]

export function MicroAdjustments({ 
  generatedShifts, 
  schedule, 
  employees: employeesProp, 
  currentWeekStart,
  onPrevWeek,
  onNextWeek,
  onGoToThisWeek,
  warnings 
}: { 
  generatedShifts?: Shift[]
  schedule: Record<number, Record<number, Record<string, any>>>
  employees: Employee[]
  currentWeekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onGoToThisWeek: () => void
  onShiftChange: (employeeId: number, date: Date, timeSlot: TimeSlotId, shiftId: any) => void
  warnings: Array<{ employee_id: number; date: string; message: string }>
}) {
  const [mode, setMode] = useState<Mode>('idle')
  const [text, setText] = useState('')
  const [llmResponse, setLlmResponse] = useState<ChatShiftAdjustResponse | null>(null)
  const [preview, setPreview] = useState<SchedulePreviewResponse | null>(null)
  const [useLlm, setUseLlm] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'generation' | 'modification'>('generation')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const lastAppliedId = useRef<string | null>(null)

  const { apiUrl, wsUrl, headers } = useMemo(() => {
    const base = import.meta.env.VITE_API_URL as string
    let apiUrl = base
    let wsUrl = ''
    const headers: HeadersInit = {}
    if (base && base.includes('@')) {
      const m = base.match(/https:\/\/([^:]+):([^@]+)@(.+)/)
      if (m) {
        const [, u, p, domain] = m
        headers['Authorization'] = `Basic ${btoa(`${u}:${p}`)}`
        apiUrl = `https://${domain}`
      }
    }
    if (apiUrl) {
      const wsHost = apiUrl.replace(/^http(s?):\/\//, 'ws$1://')
      wsUrl = `${wsHost}/ws/adjustments`
    }
    return { apiUrl, wsUrl, headers }
  }, [])

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/employees`, { headers })
        await res.json()
      } catch {
      }
    }
    fetchEmployees()
  }, [apiUrl, headers])

  useEffect(() => {
    if (generatedShifts) {
      return
    }
    
    const fetchCurrentShifts = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/shifts`, { headers })
        await res.json()
      } catch {
      }
    }
    fetchCurrentShifts()
  }, [apiUrl, headers, generatedShifts])

  useEffect(() => {
    let stop = false
    const connect = () => {
      if (stop) return
      const existing = wsRef.current
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return
      }
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        ws.onopen = () => {
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.type === 'proposals_ready') {
              if (preview && msg.change_set?.id === preview.change_set.id) {
                setMode('previewing')
              }
            }
            if (msg.type === 'schedule.updated') {
              if (lastAppliedId.current && msg.change_set_id === lastAppliedId.current) {
                setMode('applied')
              }
            }
          } catch {}
        }
        ws.onclose = () => {
          if (wsRef.current === ws) {
            wsRef.current = null
          }
          if (!stop) {
            setTimeout(connect, 1500)
          }
        }
        ws.onerror = () => {
        }
      } catch {
        if (!stop) setTimeout(connect, 1500)
      }
    }
    connect()
    return () => {
      stop = true
      const cur = wsRef.current
      try {
        cur?.close()
      } catch {}
      if (wsRef.current === cur) {
        wsRef.current = null
      }
    }
  }, [wsUrl, preview])

  const toSlot = (start_time: string): TimeSlotId => {
    if (start_time.startsWith('08:')) return '8-16'
    if (start_time.startsWith('16:')) return '16-24'
    return '0-8'
  }

  const buildPreviewGrids = useMemo(() => {
    if (!preview) return null
    const weekStart = new Date(preview.week_start)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      days.push(d)
    }
    const afterGrid: Record<number, Record<string, Record<TimeSlotId, boolean>>> = {}
    ;(preview.shifts || []).forEach((s: Shift) => {
      const st = String(s.start_time)
      const slot = st.startsWith('08:') ? '8-16' : st.startsWith('16:') ? '16-24' : '0-8'
      const ds = s.date
      afterGrid[s.employee_id] ??= {}
      afterGrid[s.employee_id][ds] ??= { '8-16': false, '16-24': false, '0-8': false }
      afterGrid[s.employee_id][ds][slot] = true
    })
    const key = (eid: number, dateStr: string, slot: TimeSlotId) => `${eid}-${dateStr}-${slot}`
    const addedSet = new Set<string>()
    ;(preview.added || []).forEach((s: Shift) => {
      addedSet.add(key(s.employee_id, s.date, toSlot(String(s.start_time))))
    })
    const removedSet = new Set<string>()
    ;(preview.removed || []).forEach((s: Shift) => {
      removedSet.add(key(s.employee_id, s.date, toSlot(String(s.start_time))))
    })
    const updatedAfterSet = new Set<string>()
    const updatedBeforeSet = new Set<string>()
    ;(preview.updated || []).forEach((p: { before: Shift; after: Shift }) => {
      updatedBeforeSet.add(key(p.before.employee_id, p.before.date, toSlot(String(p.before.start_time))))
      updatedAfterSet.add(key(p.after.employee_id, p.after.date, toSlot(String(p.after.start_time))))
    })
    return { days, afterGrid, addedSet, removedSet, updatedAfterSet, updatedBeforeSet }
  }, [preview])


  const handleSend = useCallback(async () => {
    if (!text.trim()) return
    
    if (useLlm) {
      // LLM統合機能を使用
      setMode('llm_processing')
      setPreview(null)
      setLlmResponse(null)
      
      try {
        const currentShifts = schedule ? Object.values(schedule).flat() : []
        
        const res = await fetch(`${apiUrl}/api/chat/shift-adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ 
            content: text,
            mode: 'auto',
            current_shifts: currentShifts
          }),
        })
        const data: ChatShiftAdjustResponse = await res.json()
        setLlmResponse(data)
        
        if (data.intent === 'adjust' && data.adjustment_rule) {
          setMode('generating_proposals')
          // 調整ルールからプレビュー生成
          const p = await fetch(`${apiUrl}/api/adjustments/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ rule: data.adjustment_rule }),
          })
          const pr: SchedulePreviewResponse = await p.json()
          setPreview(pr)
          setActiveTab('modification')
          setMode('previewing')
        } else {
          setMode('idle')
        }
      } catch (error) {
        console.error('LLM processing error:', error)
        setMode('idle')
      }
    } else {
      // 既存のparse機能を使用
      setMode('parsing')
      setPreview(null)
      setLlmResponse(null)
      
      try {
        const res = await fetch(`${apiUrl}/api/chat/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ text }),
        })
        const data: ChatParseResponse = await res.json()
        if (data.ok && data.rule) {
          setMode('generating_proposals')
          const p = await fetch(`${apiUrl}/api/adjustments/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ rule: data.rule }),
          })
          const pr: SchedulePreviewResponse = await p.json()
          setPreview(pr)
          setActiveTab('modification')
          setMode('previewing')
        } else {
          setMode('idle')
        }
      } catch {
        setMode('idle')
      }
    }
  }, [text, apiUrl, headers, useLlm])

  const handleApply = useCallback(async () => {
    if (!preview) return
    try {
      const res = await fetch(`${apiUrl}/api/adjustments/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Role': 'admin', ...headers },
        body: JSON.stringify({ change_set: preview.change_set }),
      })
      const data = await res.json()
      if (data.ok) {
        lastAppliedId.current = preview.change_set.id
      }
    } catch {}
  }, [preview, apiUrl, headers])

  const handleRollback = useCallback(async () => {
    if (!preview) return
    try {
      await fetch(`${apiUrl}/api/adjustments/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Role': 'admin', ...headers },
        body: JSON.stringify({ change_set_id: preview.change_set.id }),
      })
      setMode('idle')
      setPreview(null)
      setLlmResponse(null)
    } catch {}
  }, [preview, apiUrl, headers])

  useEffect(() => {
    if (preview) {
      setActiveTab('modification')
    }
  }, [preview])


  return (
    <>
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'generation' | 'modification')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generation">生成結果</TabsTrigger>
            <TabsTrigger value="modification">修正結果</TabsTrigger>
          </TabsList>
            
            <TabsContent value="generation" className="mt-4">
              {!schedule || Object.keys(schedule).length === 0 ? (
                <div className="text-xs text-muted-foreground">シフト生成結果がありません</div>
              ) : (
                <ShiftTable
                  schedule={schedule}
                  employees={employeesProp as any}
                  currentWeekStart={currentWeekStart}
                  onPrevWeek={onPrevWeek}
                  onNextWeek={onNextWeek}
                  onGoToThisWeek={onGoToThisWeek}
                  warnings={warnings}
                  readonly={true}
                />
              )}
            </TabsContent>
            
            <TabsContent value="modification" className="mt-4">
              {!preview ? (
                <div className="text-xs text-muted-foreground">修正結果が表示されます</div>
              ) : (
                (() => {
                  const data = buildPreviewGrids
                  if (!data) return null
                  const { days, afterGrid, addedSet, removedSet, updatedAfterSet, updatedBeforeSet } = data
                  const dateKey = (d: Date) => d.toISOString().split('T')[0]
                  return (
                    <div className="border rounded-md overflow-auto">
                      <div className="grid" style={{ gridTemplateColumns: '200px ' + 'repeat(' + days.length * 3 + ', 1fr)' }}>
                        <div className="h-10 border-b bg-white" />
                        {days.map((d, idx) => (
                          <div key={`d-${idx}`} className="h-10 border-b text-center bg-white font-medium" style={{ gridColumn: 'span 3' }}>
                            {d.getMonth() + 1}/{d.getDate()}
                          </div>
                        ))}
                        <div className="h-8 border-b bg-gray-50" />
                        {days.flatMap((d) =>
                          slots.map((ts) => (
                            <div key={`ts-${d.toISOString()}-${ts.id}`} className="h-8 border-b text-center text-xs bg-gray-50">{ts.label}</div>
                          ))
                        )}
                        {employeesProp.map((emp) => (
                          <Fragment key={`row-${emp.id}`}>
                            <div className="h-14 border-b bg-white px-2 flex items-center text-sm font-medium">
                              {emp.name}
                            </div>
                            {days.flatMap((d) => {
                              const dKey = dateKey(d)
                              return slots.map((ts) => {
                                const cellKey = `${emp.id}-${dKey}-${ts.id}`
                                const after = !!afterGrid[emp.id]?.[dKey]?.[ts.id]
                                const isAdded = addedSet.has(cellKey)
                                const isUpdatedAfter = updatedAfterSet.has(cellKey)
                                const isRemoved = removedSet.has(cellKey) || (updatedBeforeSet.has(cellKey) && !after)
                                let cls = 'h-14 border-b border-r flex items-center justify-center text-xs '
                                if (after) cls += 'bg-gray-100 '
                                if (isAdded) cls += 'bg-green-200 '
                                if (isUpdatedAfter) cls += 'bg-blue-200 '
                                if (isRemoved && !after) cls += 'bg-red-50 '
                                return (
                                  <div key={cellKey} className={cls}>
                                    {after ? '勤務' : ''}
                                    {isRemoved && !after ? <span className="text-red-600">−</span> : null}
                                  </div>
                                )
                              })
                            })}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  )
                })()
              )}
            </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-4 left-4 z-50">
        <div className={`bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-300 ${
          isChatOpen ? 'w-80 h-96' : 'w-auto h-auto'
        }`}>
          {!isChatOpen ? (
            <Button
              onClick={() => setIsChatOpen(true)}
              className="rounded-full w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">チャット微調整</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={useLlm ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseLlm(!useLlm)}
                    >
                      LLM機能 {useLlm ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {llmResponse && (
                <div className="p-3 border-b">
                  <div className="text-xs p-2 bg-gray-50 rounded">
                    <div className="font-medium">LLM応答:</div>
                    <div>{llmResponse.assistant_text}</div>
                    {llmResponse.intent && (
                      <div className="text-gray-600">意図: {llmResponse.intent} (信頼度: {Math.round(llmResponse.confidence * 100)}%)</div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex-1 p-3 flex flex-col gap-3">
                <Textarea
                  placeholder={useLlm ? "自然言語でシフト調整を指示してください..." : "指示を入力"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[100px] text-sm resize-none"
                />
                <Button 
                  onClick={async () => {
                    await handleSend()
                    setText('')
                  }}
                  className="w-full"
                  disabled={!text.trim() || mode === 'parsing' || mode === 'generating_proposals' || mode === 'llm_processing'}
                >
                  {mode === 'parsing' ? '解析中...' : 
                   mode === 'generating_proposals' ? '提案生成中...' : 
                   mode === 'llm_processing' ? 'LLM処理中...' : 
                   '送信'}
                </Button>
                {preview && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleApply} 
                      disabled={mode === 'parsing' || mode === 'generating_proposals' || mode === 'llm_processing'}
                      className="flex-1"
                    >
                      適用
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleRollback}
                      className="flex-1"
                    >
                      元に戻す
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
