import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users, Calendar, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import { cn } from "@/lib/utils"

const kpiData = [
  {
    title: "本日の出勤者数",
    value: "32 / 45人",
    icon: Users,
    change: "+5%",
    changeType: "increase",
  },
  {
    title: "未確定シフト",
    value: "8件",
    icon: Calendar,
    change: "-2件",
    changeType: "decrease",
  },
  {
    title: "アラート件数",
    value: "3件",
    icon: AlertTriangle,
    change: "+1件",
    changeType: "increase",
  },
  {
    title: "平均充足率",
    value: "92%",
    icon: CheckCircle,
    change: "+1.2%",
    changeType: "increase",
  },
]

const recentActivities = [
  { name: "田中 雄一", action: "が「早番」を「遅番」に変更しました。", time: "5分前", avatar: "YU" },
  { name: "佐藤 美咲", action: "の休日申請が承認されました。", time: "30分前", avatar: "MS" },
  { name: "鈴木 一郎", action: "が新しいシフトを公開しました。", time: "1時間前", avatar: "IS" },
  { name: "高橋 さくら", action: "のスキルレベルが更新されました。", time: "3時間前", avatar: "ST" },
]

const skillDistribution = [
  { level: "レベル 5 (上級)", count: 8, color: "bg-violet-500" },
  { level: "レベル 4", count: 15, color: "bg-blue-500" },
  { level: "レベル 3 (中級)", count: 12, color: "bg-cyan-500" },
  { level: "レベル 2", count: 7, color: "bg-green-500" },
  { level: "レベル 1 (初級)", count: 3, color: "bg-lime-500" },
]

const employeeShiftData = [
  { name: "高橋 さくら", shifts: 520, maxShifts: 720, avatar: "ST", color: "bg-amber-500" },
  { name: "佐藤 美咲", shifts: 505, maxShifts: 720, avatar: "MS", color: "bg-pink-500" },
  { name: "田中 雄一", shifts: 480, maxShifts: 720, avatar: "YU", color: "bg-sky-500" },
  { name: "鈴木 一郎", shifts: 455, maxShifts: 720, avatar: "IS", color: "bg-indigo-500" },
  { name: "伊藤 健太", shifts: 420, maxShifts: 720, avatar: "KI", color: "bg-teal-500" },
];

interface DashboardPageProps {
  onNavigate: (tabId: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ダッシュボード</h1>
          <p className="text-muted-foreground">ようこそ、管理者さん。現在のシフト状況の概要です。</p>
        </div>
        <Button onClick={() => onNavigate('schedule')}>
          <Calendar className="mr-2 h-4 w-4" />
          シフトを新規作成
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpi.value}</div>
              <p className={cn(
                "text-xs text-muted-foreground",
                kpi.changeType === 'increase' ? 'text-emerald-500' : 'text-red-500'
              )}>
                昨日比 {kpi.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shift Fill Rate Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>週間シフト充足率</CardTitle>
            <CardDescription>各曜日の人員配置の充足状況を示します。</CardDescription>
          </CardHeader>
          <CardContent className="pl-2 pr-6">
            <div className="h-[300px] w-full flex items-stretch gap-4">
              <div className="flex flex-col justify-between text-xs text-muted-foreground py-1.5">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>
              <div className="flex-1 grid grid-cols-7 gap-4 border-l border-dashed pl-4 relative">
                <div className="absolute top-0 left-0 w-full h-full grid grid-rows-4 -z-10">
                  <div className="border-b border-dashed"></div>
                  <div className="border-b border-dashed"></div>
                  <div className="border-b border-dashed"></div>
                  <div></div>
                </div>
                {[85, 92, 88, 95, 100, 75, 80].map((value, index) => {
                  const getFillRateColor = (v: number) => {
                    if (v < 80) return "from-primary/40 to-primary/20 group-hover:from-primary/50 group-hover:to-primary/30";
                    if (v < 95) return "from-primary/70 to-primary/40 group-hover:from-primary/80 group-hover:to-primary/50";
                    return "from-primary to-primary/60 group-hover:from-primary/100 group-hover:to-primary/70";
                  }

                  return (
                    <div key={index} className="group relative flex flex-col justify-end items-center gap-2">
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                          <span className="bg-card text-card-foreground text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                              {value}%
                          </span>
                      </div>
                      <div 
                        className={cn(
                          "w-full rounded-t-lg bg-gradient-to-b transition-all duration-300 ease-in-out",
                          getFillRateColor(value)
                        )}
                        style={{ height: `${value}%` }}
                      />
                      <span className="text-xs font-medium text-muted-foreground">{["月", "火", "水", "木", "金", "土", "日"][index]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>最近のアクティビティ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-4">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">{activity.avatar}</AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <p className="text-foreground">
                    <span className="font-semibold">{activity.name}</span>
                    {activity.action}
                  </p>
                  <p className="text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
             <Button variant="outline" size="sm" className="w-full">
              すべて表示 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Skill Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>スキルレベル分布</CardTitle>
            <CardDescription>全従業員のスキルレベルの構成比率です。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {skillDistribution.map((skill) => {
                const total = skillDistribution.reduce((sum, s) => sum + s.count, 0);
                const percentage = (skill.count / total) * 100;
                return (
                  <div key={skill.level} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-muted-foreground shrink-0">{skill.level}</div>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", skill.color)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-16 text-right font-medium">{skill.count}人</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Employee Shift Status */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>従業員別シフト状況</CardTitle>
            <CardDescription>各従業員の当月割り当て時間数です。</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-6">
              {employeeShiftData.map((employee) => {
                const percentage = (employee.shifts / employee.maxShifts) * 100;
                return (
                  <div key={employee.name} className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={cn(employee.color, "text-white font-semibold")}>{employee.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium text-foreground">{employee.name}</p>
                        <p className="text-sm font-medium text-muted-foreground">{employee.shifts} / {employee.maxShifts}時間</p>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div 
                          className={cn("h-2.5 rounded-full transition-all duration-500", employee.color)}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="w-full">
              すべての従業員を表示 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
