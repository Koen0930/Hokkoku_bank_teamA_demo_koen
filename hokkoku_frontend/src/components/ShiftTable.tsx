import React, { useMemo, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { CalendarClock, ChevronsLeft, ChevronsRight } from "lucide-react"

type TimeSlotId = '8-16' | '16-24' | '0-8'
type ShiftTypeId = 'in_shift' | 'off'

interface Employee {
  id: number
  name: string
  role: string
  skill_level: number
}

interface ShiftTableProps {
  schedule: Record<number, Record<number, Record<string, ShiftTypeId>>>
  employees: Employee[]
  currentWeekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onGoToThisWeek: () => void
  onShiftChange?: (employeeId: number, date: Date, timeSlot: TimeSlotId, shiftId: ShiftTypeId) => void
  warnings?: Array<{ employee_id: number; date: string; message: string }>
  readonly?: boolean
}

const timeSlots = [
  { id: '8-16' as TimeSlotId, label: '8-16' },
  { id: '16-24' as TimeSlotId, label: '16-24' },
  { id: '0-8' as TimeSlotId, label: '0-8' }
]

const DAYS_PER_WEEK = 7


const getWeekRange = (weekStart: Date) => {
  const start = new Date(weekStart)
  const end = new Date(weekStart)
  end.setDate(start.getDate() + 6)
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
}

const ShiftCell: React.FC<{
  employeeId: number
  date: Date
  timeSlot: TimeSlotId
  shiftId?: ShiftTypeId
  isToday: boolean
  hasWarning: boolean
  warningMessage: string
  onShiftChange?: (employeeId: number, date: Date, timeSlot: TimeSlotId, shiftId: ShiftTypeId) => void
  readonly?: boolean
}> = ({ employeeId, date, timeSlot, shiftId, isToday, hasWarning, warningMessage, onShiftChange, readonly }) => {
  const cellContent = shiftId === 'in_shift' ? '勤務' : shiftId === 'off' ? '休み' : ''
  
  let cellClass = 'h-16 border-r border-b flex items-center justify-center text-xs hover:bg-gray-50 '
  if (shiftId === 'in_shift') cellClass += 'bg-blue-50 text-blue-900 font-medium '
  if (isToday) cellClass += 'ring-2 ring-blue-400 '
  if (hasWarning) cellClass += 'bg-red-50 '
  if (!readonly) cellClass += 'cursor-pointer '

  const handleClick = () => {
    if (readonly || !onShiftChange) return
    const newShiftId: ShiftTypeId = shiftId === 'in_shift' ? 'off' : 'in_shift'
    onShiftChange(employeeId, date, timeSlot, newShiftId)
  }

  const cell = (
    <div className={cellClass} onClick={handleClick}>
      {cellContent}
    </div>
  )

  if (hasWarning) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{cell}</TooltipTrigger>
        <TooltipContent>
          <p>{warningMessage}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return cell
}

export const ShiftTable: React.FC<ShiftTableProps> = ({
  schedule,
  employees,
  currentWeekStart,
  onPrevWeek,
  onNextWeek,
  onGoToThisWeek,
  onShiftChange,
  warnings = [],
  readonly = false
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  const renderedDays = useMemo(() => {
    const arr: Date[] = []
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [currentWeekStart])

  useEffect(() => {
    if (!scrollRef.current) return
    const container = scrollRef.current;
    container.scrollTo({ left: 0, behavior: 'auto' });
  }, [renderedDays.length])

  const calculateSummaryStats = useMemo(() => (date: Date, timeSlot: TimeSlotId) => {
    let totalAssigned = 0
    let totalSkill = 0
    let managerCount = 0
    
    const day = date.getDate()
    employees.forEach(emp => {
      const shiftId = schedule[emp.id]?.[day]?.[timeSlot]
      if (shiftId === 'in_shift') {
        totalAssigned++
        totalSkill += emp.skill_level
        if (emp.role === 'manager') managerCount++
      }
    })
    
    return { totalAssigned, totalSkill, managerCount }
  }, [schedule, employees])

  const getCellWarning = (employeeId: number, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const hasDateMatch = warnings.some(w => 
      w.employee_id === employeeId && w.date === dateStr
    )
    
    if (hasDateMatch) {
      const warning = warnings.find(w => 
        w.employee_id === employeeId && w.date === dateStr
      )
      return {
        hasWarning: true,
        message: warning?.message || ''
      }
    }
    
    return { hasWarning: false, message: '' }
  }

  const headerDates = renderedDays.map((d, idx) => (
    <div key={`date-${idx}`} className="h-10 border-b text-center bg-white font-medium" style={{ gridColumn: 'span 3' }}>
      {d.getMonth() + 1}/{d.getDate()}
      <div className="text-xs text-gray-500">
        {['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}
      </div>
    </div>
  ))

  const headerTimeSlots = renderedDays.flatMap(d =>
    timeSlots.map(ts => (
      <div key={`ts-${d.toISOString()}-${ts.id}`} className="h-10 border-b text-center text-xs bg-gray-50">{ts.label}</div>
    ))
  )

  const summaryRow = useMemo(() => {
    return renderedDays.flatMap(d => {
      return timeSlots.map(ts => {
        const stats = calculateSummaryStats(d, ts.id)
        return (
          <div key={`summary-${d.toISOString()}-${ts.id}`} className="h-16 border-r border-b bg-gray-50 flex flex-col items-center justify-center text-xs">
            <div className="font-semibold">{stats.totalAssigned}人</div>
            <div className="text-gray-600">スキル{stats.totalSkill}</div>
            <div className="text-gray-600">管理{stats.managerCount}</div>
          </div>
        )
      })
    })
  }, [timeSlots, calculateSummaryStats, renderedDays])

  return (
    <TooltipProvider>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{getWeekRange(currentWeekStart)}</CardTitle>
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onGoToThisWeek} aria-label="今週に戻る">
                    <CalendarClock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>今週に戻る</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onPrevWeek} aria-label="前の週">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>前の週へ</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onNextWeek} aria-label="次の週">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>次の週へ</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>

        <div className="relative border-t" ref={scrollRef}>
          <div className="grid" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <div className="sticky left-0 z-30 w-[150px] bg-white border-r shadow-sm">
              <div className="h-10 text-center border-b border-r flex flex-col justify-center items-center relative bg-white" />
              <div className="h-10 text-center border-b border-r flex flex-col justify-center items-center bg-white" />
              <div className="h-16 border-r border-b bg-gray-50 flex flex-col items-center justify-center text-sm font-semibold">
                従業員
              </div>
              {employees.map((emp) => (
                <div key={emp.id} className="h-16 bg-white border-r border-b flex flex-col items-center justify-center p-2">
                  <span className="truncate font-medium text-sm">{emp.name}</span>
                  <span className="text-xs text-gray-500 mt-1">
                    {emp.role === 'manager' ? '管理職' : 
                     emp.role === 'senior_staff' ? '主任' : 
                     emp.role === 'staff' ? '一般' : emp.role}
                  </span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${DAYS_PER_WEEK * 3}, 1fr)`,
                  minWidth: '100%',
                }}>
                {headerDates}
                {headerTimeSlots}
                {summaryRow}

                {employees.flatMap((emp) =>
                  renderedDays.flatMap((d) => {
                    return timeSlots.map(ts => {
                      const day = d.getDate()
                      const shiftId = schedule[emp.id]?.[day]?.[ts.id]
                      const isToday = d.toDateString() === new Date().toDateString()
                      const cellWarning = getCellWarning(emp.id, d)

                      return (
                        <ShiftCell
                          key={`${emp.id}-${d.toISOString()}-${ts.id}`}
                          employeeId={emp.id}
                          date={d}
                          timeSlot={ts.id}
                          shiftId={shiftId}
                          isToday={isToday}
                          hasWarning={cellWarning.hasWarning}
                          warningMessage={cellWarning.message}
                          onShiftChange={onShiftChange}
                          readonly={readonly}
                        />
                      )
                    })
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {!employees.length && (
          <CardContent>
            <div className="text-center py-16">
              <p className="text-muted-foreground">表示する従業員がいません。</p>
              <p className="text-sm text-muted-foreground mt-1">
                まずは「データ連携」タブから従業員データをインポートしてください。
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </TooltipProvider>
  )
}
