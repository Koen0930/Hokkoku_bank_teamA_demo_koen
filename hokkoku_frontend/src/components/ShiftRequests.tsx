import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, Clock3, User, RefreshCcw, Check, X, Eye } from 'lucide-react'

type ShiftChangeRequest = {
  id: number
  employee_id?: number | null
  employee_name?: string | null
  type: string
  date: string
  from_slot?: string | null
  to_slot?: string | null
  target_employee_id?: number | null
  reason?: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_via?: string | null
  line_user_id?: string | null
  created_at?: string
  updated_at?: string
}

type Employee = {
  id: number
  name: string
  email: string | null
  role: string
  skill_level: number
}

type TimeSlotId = '8-16' | '16-24' | '0-8'

const intentLabel = (t?: string) => {
  switch (t) {
    case 'absence': return '欠勤';
    case 'change_time': return '時間帯変更';
    case 'swap': return '入れ替え';
    case 'add_shift': return '追加';
    case 'cancel_request': return '取消';
    default: return t || '';
  }
}

const intentColor = (t?: string) => {
  switch (t) {
    case 'absence': return 'border-l-red-400/70';
    case 'change_time': return 'border-l-blue-400/70';
    case 'swap': return 'border-l-amber-400/70';
    case 'add_shift': return 'border-l-emerald-400/70';
    default: return 'border-l-gray-300';
  }
}

export function ShiftRequests() {
  const [items, setItems] = useState<ShiftChangeRequest[]>([])
  const [activeStatus, setActiveStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [suggestionMap, setSuggestionMap] = useState<Record<number, string[]>>({})
  const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000'
  const { apiUrl, headers } = useMemo(() => {
    let apiUrl = API_URL
    const headers: HeadersInit = {}
    if (API_URL.includes('@')) {
      const urlMatch = API_URL.match(/https:\/\/([^:]+):([^@]+)@(.+)/)
      if (urlMatch) {
        const [, username, password, domain] = urlMatch
        apiUrl = `https://${domain}`
        headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
      }
    }
    return { apiUrl, headers }
  }, [API_URL])

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/shift-change?status=${activeStatus}`, { headers })
      const data = await res.json()
      setItems(data.requests || [])
    } catch (e) {
      setItems([])
      toast.error('申請の取得に失敗しました')
    }
  }, [apiUrl, headers, activeStatus])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/employees`, { headers })
      const data = await res.json()
      setEmployees(data.employees || [])
    } catch (e) {
      setEmployees([])
    }
  }, [apiUrl, headers])

  useEffect(() => {
    fetchRequests()
    fetchEmployees()
    const id = setInterval(fetchRequests, 10000)
    return () => clearInterval(id)
  }, [fetchRequests, fetchEmployees])

  // Prefetch top-2 suggestion names for each request block
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      const pendingIds = items
        .filter((r) => r.status === 'pending')
        .map((r) => r.id)
        .filter((id) => !(id in suggestionMap))
      if (!pendingIds.length) return
      try {
        const updates: Record<number, string[]> = {}
        await Promise.all(
          pendingIds.map(async (id) => {
            try {
              const res = await fetch(`${apiUrl}/api/shift-change/${id}/preview`, { headers, signal: controller.signal })
              if (!res.ok) return
              const data = await res.json()
              const s = (data.suggestions || [])[0]
              if (s && Array.isArray(s.candidates) && s.candidates.length) {
                const names = s.candidates.slice(0, 2).map((c: any) => (c.name || `従業員${c.employee_id}`) + 'さん')
                updates[id] = names
              } else {
                updates[id] = []
              }
            } catch {}
          })
        )
        if (Object.keys(updates).length) {
          setSuggestionMap((prev) => ({ ...prev, ...updates }))
        }
      } catch {}
    }
    load()
    return () => controller.abort()
  }, [items, apiUrl, headers, suggestionMap])

  const approve = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/shift-change/${id}/approve`, { method: 'POST', headers })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `HTTP ${res.status}`)
      }
      toast.success('承認しました')
      // 承認後、プレビューを取得してローカルのシフト表を更新
      try {
        const p = await fetch(`${apiUrl}/api/shift-change/${id}/preview`, { headers })
        if (p.ok) {
          const data = await p.json()
          // preview.shifts -> ShiftSchedule の schedule 形式へ変換
          const newSch: Record<number, Record<number, Record<string, 'in_shift' | 'off'>>> = {}
          ;(data.shifts || []).forEach((s: any) => {
            const day = new Date(s.date).getUTCDate()
            const st: string = String(s.start_time)
            let slot: '8-16' | '16-24' | '0-8'
            if (st.startsWith('08:')) slot = '8-16'
            else if (st.startsWith('16:')) slot = '16-24'
            else slot = '0-8'
            newSch[s.employee_id] ??= {}
            newSch[s.employee_id][day] ??= {}
            newSch[s.employee_id][day][slot] = 'in_shift'
          })
          localStorage.setItem('shift_schedule', JSON.stringify(newSch))
        }
      } catch {}
      fetchRequests()
    } catch {
      toast.error('承認に失敗しました（詳細は開発者ツールのNetworkを確認）')
    }
  }

  const reject = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/shift-change/${id}/reject`, { method: 'POST', headers })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `HTTP ${res.status}`)
      }
      toast.success('却下しました')
      fetchRequests()
    } catch {
      toast.error('却下に失敗しました（詳細は開発者ツールのNetworkを確認）')
    }
  }

  const openPreview = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/shift-change/${id}/preview`, { headers })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPreview(data)
      setPreviewOpen(true)
      setSelectedRequestId(id)
    } catch {
      toast.error('プレビューの取得に失敗しました')
    }
  }

  // ===== preview grid helpers =====
  const timeSlots: { id: TimeSlotId; label: string }[] = [
    { id: '8-16', label: '8-16' },
    { id: '16-24', label: '16-24' },
    { id: '0-8', label: '0-8' },
  ]

  const buildPreviewGrids = () => {
    if (!preview) return null
    const weekStart = new Date(preview.week_start)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      days.push(d)
    }

    const afterGrid: Record<number, Record<string, Record<TimeSlotId, boolean>>> = {}
    ;(preview.shifts || []).forEach((s: any) => {
      const dateStr = s.date
      const st: string = String(s.start_time)
      let slot: TimeSlotId
      if (st.startsWith('08:')) slot = '8-16'
      else if (st.startsWith('16:')) slot = '16-24'
      else slot = '0-8'
      afterGrid[s.employee_id] ??= {}
      afterGrid[s.employee_id][dateStr] ??= { '8-16': false, '16-24': false, '0-8': false }
      afterGrid[s.employee_id][dateStr][slot] = true
    })

    const key = (eid: number, dateStr: string, slot: TimeSlotId) => `${eid}-${dateStr}-${slot}`
    const addedSet = new Set<string>()
    ;(preview.added || []).forEach((s: any) => {
      const st: string = String(s.start_time)
      let slot: TimeSlotId
      if (st.startsWith('08:')) slot = '8-16'
      else if (st.startsWith('16:')) slot = '16-24'
      else slot = '0-8'
      addedSet.add(key(s.employee_id, s.date, slot))
    })
    const removedSet = new Set<string>()
    ;(preview.removed || []).forEach((s: any) => {
      const st: string = String(s.start_time)
      let slot: TimeSlotId
      if (st.startsWith('08:')) slot = '8-16'
      else if (st.startsWith('16:')) slot = '16-24'
      else slot = '0-8'
      removedSet.add(key(s.employee_id, s.date, slot))
    })
    const updatedAfterSet = new Set<string>()
    const updatedBeforeSet = new Set<string>()
    ;(preview.updated || []).forEach((p: any) => {
      const bst: string = String(p.before.start_time)
      const ast: string = String(p.after.start_time)
      let bslot: TimeSlotId, aslot: TimeSlotId
      if (bst.startsWith('08:')) bslot = '8-16'
      else if (bst.startsWith('16:')) bslot = '16-24'
      else bslot = '0-8'
      if (ast.startsWith('08:')) aslot = '8-16'
      else if (ast.startsWith('16:')) aslot = '16-24'
      else aslot = '0-8'
      updatedBeforeSet.add(key(p.before.employee_id, p.before.date, bslot))
      updatedAfterSet.add(key(p.after.employee_id, p.after.date, aslot))
    })

    return { days, afterGrid, addedSet, removedSet, updatedAfterSet, updatedBeforeSet }
  }

  const PreviewGrid = () => {
    const data = buildPreviewGrids()
    if (!data) return null
    const { days, afterGrid, addedSet, removedSet, updatedAfterSet, updatedBeforeSet } = data
    const dateKey = (d: Date) => d.toISOString().split('T')[0]
    const normHH = (v: string) => String(v || '').slice(0, 5)

    // Build suggestion ranking map: key(empId-date-slot) -> rank (1-based)
    const suggestionRank: Record<string, number> = {}
    ;(preview?.suggestions || []).forEach((s: any) => {
      const st = normHH(s.start_time)
      const slot: TimeSlotId = st === '08:00' ? '8-16' : st === '16:00' ? '16-24' : '0-8'
      ;(s.candidates || []).forEach((c: any, idx: number) => {
        const key = `${c.employee_id}-${s.date}-${slot}`
        if (!(key in suggestionRank)) suggestionRank[key] = idx + 1
      })
    })

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
          {days.flatMap((d) => (
            timeSlots.map((ts) => (
              <div key={`ts-${d.toISOString()}-${ts.id}`} className="h-8 border-b text-center text-xs bg-gray-50">{ts.label}</div>
            ))
          ))}

          {employees.map((emp) => (
            <>
              <div key={`emp-${emp.id}`} className="h-14 border-b bg-white px-2 flex items-center text-sm font-medium">
                {emp.name}
              </div>
              {days.flatMap((d) => {
                const dKey = dateKey(d)
                return timeSlots.map((ts) => {
                  const cellKey = `${emp.id}-${dKey}-${ts.id}`
                  const after = !!afterGrid[emp.id]?.[dKey]?.[ts.id]
                  const isAdded = addedSet.has(cellKey)
                  const isUpdatedAfter = updatedAfterSet.has(cellKey)
                  const isRemoved = removedSet.has(cellKey) || (updatedBeforeSet.has(cellKey) && !after)

                  let cls = 'h-14 border-b border-r flex items-center justify-center text-xs relative '
                  if (after) cls += 'bg-gray-100 '
                  if (isAdded) cls += 'bg-green-200 '
                  if (isUpdatedAfter) cls += 'bg-blue-200 '
                  if (isRemoved && !after) cls += 'bg-red-50 '

                  const rank = !after ? suggestionRank[cellKey] : undefined
                  const isSuggestedCell = typeof rank === 'number'
                  return (
                    <div key={cellKey} className={cls}>
                      {isSuggestedCell ? (
                        <>
                          <div className="pointer-events-none absolute inset-0 border border-dashed border-green-500 rounded-[2px]" />
                          <div className="pointer-events-none absolute inset-0 bg-green-50/40" />
                          <div className="pointer-events-none absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-green-600 text-white text-[10px] leading-4 text-center font-semibold">{rank}</div>
                        </>
                      ) : null}
                      {after ? '勤務' : ''}
                      {isRemoved && !after ? <span className="text-red-600">−</span> : null}
                    </div>
                  )
                })
              })}
            </>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              申請一覧
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">LINEからの申請を確認し、修正内容をプレビューして承認・却下できます。</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRequests}><RefreshCcw className="h-3.5 w-3.5 mr-1" />再読み込み</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <div className="inline-flex rounded-lg border bg-white p-0.5">
              <Button variant={activeStatus === 'pending' ? 'default' : 'ghost'} size="sm" className="rounded-md" onClick={() => setActiveStatus('pending')}>未処理</Button>
              <Button variant={activeStatus === 'approved' ? 'default' : 'ghost'} size="sm" className="rounded-md" onClick={() => setActiveStatus('approved')}>承認済み</Button>
              <Button variant={activeStatus === 'rejected' ? 'default' : 'ghost'} size="sm" className="rounded-md" onClick={() => setActiveStatus('rejected')}>却下済み</Button>
            </div>
          </div>
          {!items.length ? (
            <div className="text-sm text-muted-foreground border rounded-md p-6 text-center bg-gray-50">表示する申請がありません。</div>
          ) : (
            <div className="space-y-3">
              {items.map((r) => (
                <div key={r.id} className={`flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow ${intentColor(r.type)} border-l-4`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0"><User className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="text-sm min-w-0">
                      <div className="font-medium truncate">{r.employee_name || `#${r.employee_id}` || '不明'}</div>
                      <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 border"><Clock3 className="h-3 w-3" />{intentLabel(r.type)}</span>
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 border"><Calendar className="h-3 w-3" />{r.date}</span>
                        {r.from_slot && <span className="text-xs text-muted-foreground">from {r.from_slot}</span>}
                        {r.to_slot && <span className="text-xs text-muted-foreground">to {r.to_slot}</span>}
                      </div>
                      {r.reason && <div className="text-xs text-muted-foreground mt-1 truncate">理由：{r.reason}</div>}
                      {Array.isArray(suggestionMap[r.id]) && suggestionMap[r.id].length > 0 && (
                        <div className="text-xs text-emerald-700 mt-1 truncate">追加候補：{suggestionMap[r.id].join('、')}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openPreview(r.id)}><Eye className="h-3.5 w-3.5 mr-1" /> 修正済みのシフト</Button>
                    {activeStatus === 'pending' ? (
                      <>
                        <Button size="sm" onClick={() => approve(r.id)}><Check className="h-3.5 w-3.5 mr-1" /> 承認</Button>
                        <Button size="sm" variant="outline" onClick={() => reject(r.id)}><X className="h-3.5 w-3.5 mr-1" /> 却下</Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <Dialog open={previewOpen} onOpenChange={(open) => { setPreviewOpen(open); if (!open) { setSelectedRequestId(null) } }}>
          <DialogContent className="max-w-full md:max-w-5xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>修正済みシフトのプレビュー</DialogTitle>
            </DialogHeader>
            {!preview ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="mb-2 pr-12 flex items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 bg-green-200 border" /> 追加</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 bg-blue-200 border" /> 時間帯変更</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 bg-red-50 border border-red-300" /> 削除</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 bg-gray-100 border" /> 既存</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 bg-white border border-dashed border-green-500" /> 追加候補</div>
                  </div>
                  {activeStatus === 'pending' && selectedRequestId !== null && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => approve(selectedRequestId)}>承認</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(selectedRequestId)}>却下</Button>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mb-2">対象週: {preview.week_start} - {preview.week_end}</div>
                <div className="flex-1 min-h-0 overflow-auto">
                  {PreviewGrid()}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  )
}


