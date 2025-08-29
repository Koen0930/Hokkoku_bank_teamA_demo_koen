import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Bell, User, Palette, BrainCircuit, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

function LLMSettingsSection() {
  const [apiKey, setApiKey] = useState('')
  const [isApiKeySet, setIsApiKeySet] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const savedApiKey = localStorage.getItem('chatgpt_api_key')
    if (savedApiKey) {
      setApiKey(savedApiKey)
      setIsApiKeySet(true)
    }
  }, [])

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('APIキーを入力してください')
      return
    }
    
    if (!apiKey.startsWith('sk-')) {
      toast.error('有効なChatGPT APIキーを入力してください（sk-で始まる必要があります）')
      return
    }
    
    setIsSaving(true)
    try {
      localStorage.setItem('chatgpt_api_key', apiKey.trim())
      setIsApiKeySet(true)
      toast.success('APIキーが保存されました。LLM機能が有効になりました。')
    } catch (error) {
      toast.error('APIキーの保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearApiKey = () => {
    localStorage.removeItem('chatgpt_api_key')
    setApiKey('')
    setIsApiKeySet(false)
    toast.success('APIキーが削除されました')
  }

  return (
    <div className="space-y-4 p-4 rounded-lg border">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <Label className="font-medium">LLM機能 - ChatGPT APIキー</Label>
        {isApiKeySet && <CheckCircle className="w-4 h-4 text-green-600" />}
      </div>
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
        className="font-mono"
      />
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">LLM機能について</p>
          <ul className="space-y-1 text-xs">
            <li>• APIキーを設定すると、シフト作成時にLLMによる分析機能が利用できます</li>
            <li>• シフト生成の難しかった点を自動分析してコメント表示します</li>
            <li>• APIキーはブラウザのローカルストレージに保存されます</li>
            <li>• OpenAI ChatGPT APIキーが必要です（sk-で始まる形式）</li>
          </ul>
        </div>
      </div>
      <div className="flex gap-2">
        <Button 
          onClick={handleSaveApiKey}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          {isSaving ? '保存中...' : '設定'}
        </Button>
        {isApiKeySet && (
          <Button 
            variant="outline" 
            onClick={handleClearApiKey}
          >
            削除
          </Button>
        )}
      </div>
      {isApiKeySet && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800 font-medium">LLM機能が有効です</span>
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold">設定</h1>
        <p className="text-muted-foreground">アプリケーションの各種設定を管理します。</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-md">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>アカウント設定</CardTitle>
              <CardDescription>ユーザープロファイルと表示設定を編集します。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="username">ユーザー名</Label>
              <Input id="username" defaultValue="管理者" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" defaultValue="admin@hokkoku-bank.co.jp" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">言語設定</Label>
            <Select defaultValue="ja">
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="言語を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="en">English (unavailable)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="theme">テーマカラー</Label>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-muted-foreground" />
                <Select defaultValue="system">
                  <SelectTrigger className="w-[260px]">
                    <SelectValue placeholder="テーマを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">ライト</SelectItem>
                    <SelectItem value="dark">ダーク (未実装)</SelectItem>
                    <SelectItem value="system">システム設定に合わせる</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-md">
              <Bell className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>通知設定</CardTitle>
              <CardDescription>通知の受け取り方法を設定します。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border">
            <div className="flex flex-col">
              <Label htmlFor="email-notifications" className="font-medium">メール通知</Label>
              <p className="text-sm text-muted-foreground">シフトが確定・変更された際にメールで通知します。</p>
            </div>
            <Switch id="email-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border">
            <div className="flex flex-col">
              <Label htmlFor="push-notifications" className="font-medium">プッシュ通知</Label>
              <p className="text-sm text-muted-foreground">重要な警告や更新をブラウザに通知します。(未実装)</p>
            </div>
            <Switch id="push-notifications" disabled />
          </div>
        </CardContent>
      </Card>

      {/* Shift Generation Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-md">
              <BrainCircuit className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>AIシフト生成設定</CardTitle>
              <CardDescription>AIによる自動生成のパラメータを調整します。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>デフォルトのシフトテンプレート</Label>
            <Select defaultValue="default-template">
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="テンプレートを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default-template">標準テンプレート</SelectItem>
                <SelectItem value="busy-season-template">繁忙期テンプレート (未実装)</SelectItem>
                <SelectItem value="quiet-season-template">閑散期テンプレート (未実装)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between space-x-4 p-4 rounded-lg border">
            <div className="flex flex-col">
              <Label htmlFor="auto-adjust" className="font-medium">スキルレベルの自動考慮</Label>
              <p className="text-sm text-muted-foreground">各従業員のスキルレベルを基に、最適な人員配置を自動で行います。</p>
            </div>
            <Switch id="auto-adjust" defaultChecked />
          </div>
          <LLMSettingsSection />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg">設定を保存</Button>
      </div>
    </div>
  )
}
