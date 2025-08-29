# シフト微調整LLM統合機能 実装計画書

## 1. プロジェクト概要

### 1.1 プロジェクト名
シフト微調整LLM統合機能開発プロジェクト

### 1.2 期間
**総期間**: 5週間 (2025年8月18日 - 2025年9月21日)

### 1.3 チーム構成
- **プロジェクトマネージャー**: 1名
- **バックエンド開発者**: 2名
- **フロントエンド開発者**: 1名
- **QAエンジニア**: 1名

## 2. 実装フェーズ

### フェーズ1: 既存機能拡張 (1週間)
**期間**: 2025年8月18日 - 2025年8月24日

#### 2.1.1 既存LLM統合機能の拡張
**担当**: バックエンド開発者A
**期間**: 3日

**タスク**:
- [ ] 既存の`openai_client.py`の拡張
  - `detect_intent()`に調整判定を追加
  - `generate_apply()`に調整ルール生成を追加
  - 既存プロンプトの拡張
- [ ] 既存の`intent.py`の拡張
  - 調整判定のルーティング追加
- [ ] 既存機能のテスト維持
- [ ] 新機能の単体テスト作成

**成果物**:
- 拡張されたLLM統合コード
- 既存機能のテスト結果
- 新機能の単体テストコード

#### 2.1.2 既存チャット機能の拡張
**担当**: バックエンド開発者B
**期間**: 2日

**タスク**:
- [ ] 既存の`chat.py`の拡張
  - 既存の`parse()`機能を維持
  - 新規の`shift_adjust()`機能を追加
  - 既存の名前抽出機能を活用
- [ ] 既存の`store.py`の活用
  - セッション管理機能をそのまま使用
  - 従業員マスタ機能をそのまま使用
- [ ] 既存機能のテスト維持
- [ ] 新機能の単体テスト作成

**成果物**:
- 拡張されたチャット機能
- 既存機能のテスト結果
- 新機能の単体テストコード

#### 2.1.3 既存調整機能の拡張
**担当**: バックエンド開発者A
**期間**: 2日

**タスク**:
- [ ] 既存の`adjustments.py`の拡張
  - 既存の`pair_not_together`機能をそのまま活用
  - 新規の`increase_staff_day`機能を追加
  - 新規の`redistribute_shifts`機能を追加
- [ ] 既存の`validation.py`の活用
  - 既存の検証機能をそのまま使用
  - 新規ルールタイプの検証を追加
- [ ] 既存の`adjustments_ws.py`の活用
  - WebSocket通信機能をそのまま使用
  - 新機能のリアルタイム更新を追加
- [ ] 既存機能のテスト維持
- [ ] 新機能の単体テスト作成

**成果物**:
- 拡張された調整機能
- 既存機能のテスト結果
- 新機能の単体テストコード

### フェーズ2: 新機能実装 (2週間)
**期間**: 2025年8月25日 - 2025年9月7日

#### 2.2.1 新規調整アルゴリズム実装
**担当**: バックエンド開発者A
**期間**: 1週間

**タスク**:
- [ ] `increase_staff_day`アルゴリズム実装
  - 既存の調整ロジックをベースに実装
  - 人員増加の最適化機能
  - 制約チェック機能
- [ ] `redistribute_shifts`アルゴリズム実装
  - 既存の調整ロジックをベースに実装
  - シフト再配分の最適化機能
  - 公平性評価機能
- [ ] 既存機能との統合テスト
- [ ] パフォーマンステスト

**成果物**:
- 新規調整アルゴリズム実装
- 既存機能との統合テスト結果
- パフォーマンステスト結果

#### 2.2.2 新規APIエンドポイント実装
**担当**: バックエンド開発者B
**期間**: 1週間

**タスク**:
- [ ] 新規APIエンドポイントの実装
  - `POST /api/chat/shift-adjust`（既存chat.pyを拡張）
  - `POST /api/shifts/adjust`（既存adjustments.pyを拡張）
- [ ] 既存APIとの統合
  - 既存の`/api/chat/parse`との共存
  - 既存の`/api/adjustments/*`との共存
- [ ] API仕様書の更新
- [ ] 統合テストの実装

**成果物**:
- 新規APIエンドポイント実装
- 既存APIとの統合テスト結果
- 更新されたAPI仕様書

#### 2.2.3 新規LLMプロンプト実装
**担当**: バックエンド開発者A
**期間**: 1週間

**タスク**:
- [ ] 新規LLMプロンプトの実装
  - 調整ルール生成プロンプト
  - 調整意図判定プロンプト
- [ ] 既存プロンプトとの統合
  - 既存の意図判定プロンプトとの共存
  - 既存の制約変更プロンプトとの共存
- [ ] プロンプトテストの実装
- [ ] プロンプト最適化

**成果物**:
- 新規LLMプロンプト実装
- 既存プロンプトとの統合テスト結果
- プロンプト最適化結果

#### 2.2.4 既存機能との統合テスト
**担当**: バックエンド開発者B
**期間**: 0.5週間

**タスク**:
- [ ] 既存機能の動作確認
  - 既存のLLM統合機能のテスト
  - 既存のチャット微調整機能のテスト
  - 既存の調整機能のテスト
- [ ] 新機能との統合テスト
  - 新機能が既存機能に影響しないことの確認
  - 既存機能が新機能と共存できることの確認
- [ ] 統合テスト結果の文書化

**成果物**:
- 既存機能の動作確認結果
- 新機能との統合テスト結果
- 統合テスト結果レポート

### フェーズ3: UI統合 (1週間)
**期間**: 2025年9月8日 - 2025年9月14日

#### 2.3.1 既存UI基盤の拡張
**担当**: フロントエンド開発者
**期間**: 1週間

**タスク**:
- [ ] 既存の`MicroAdjustments.tsx`の拡張
  - 既存のチャットUIをそのまま活用
  - 新機能のUI統合
  - 既存のプレビューUIをそのまま活用
- [ ] 既存機能との統合
  - 既存のチャット機能との共存
  - 既存の調整機能との共存
  - 既存のWebSocket通信との共存
- [ ] 既存機能のテスト維持
- [ ] 新機能のUIテスト作成

**成果物**:
- 拡張されたUI基盤
- 既存機能との統合テスト結果
- 新機能のUIテスト結果

#### 2.3.2 新機能のUI統合
**担当**: フロントエンド開発者
**期間**: 1週間

**タスク**:
- [ ] 新機能のUI統合
  - 新規調整ルールタイプのUI対応
  - 新規LLM機能のUI対応
  - 新規APIエンドポイントのUI対応
- [ ] 既存UIとの統合
  - 既存のシフト表示との統合
  - 既存の調整操作UIとの統合
  - 既存の調整履歴表示との統合
- [ ] レスポンシブデザインの維持
- [ ] アクセシビリティの維持

**成果物**:
- 新機能のUI統合結果
- 既存UIとの統合テスト結果
- アクセシビリティテスト結果

### フェーズ4: 統合・テスト (1週間)
**期間**: 2025年9月15日 - 2025年9月21日

#### 2.4.1 既存機能の動作確認
**担当**: 全開発者
**期間**: 0.5週間

**タスク**:
- [ ] 既存機能の動作確認
  - 既存のLLM統合機能の動作確認
  - 既存のチャット微調整機能の動作確認
  - 既存の調整機能の動作確認
- [ ] 既存機能のテスト実行
  - 既存の単体テストの実行
  - 既存の統合テストの実行
  - 既存のエンドツーエンドテストの実行

**成果物**:
- 既存機能の動作確認結果
- 既存機能のテスト実行結果

#### 2.4.2 新機能のエンドツーエンドテスト
**担当**: QAエンジニア
**期間**: 0.5週間

**タスク**:
- [ ] 新機能の機能テスト
  - 新規調整ルールタイプのテスト
  - 新規LLM機能のテスト
  - 新規APIエンドポイントのテスト
- [ ] 既存機能との統合テスト
  - 新機能が既存機能に影響しないことの確認
  - 既存機能が新機能と共存できることの確認
- [ ] パフォーマンステスト
  - 既存機能のパフォーマンス維持確認
  - 新機能のパフォーマンス確認
- [ ] セキュリティテスト
- [ ] ユーザビリティテスト

**成果物**:
- 新機能のテスト結果レポート
- 既存機能との統合テスト結果
- バグ修正リスト
- パフォーマンス改善提案

## 3. 技術実装詳細

### 3.1 バックエンド実装

#### 3.1.1 新しいAPIエンドポイント
```python
# hokkoku_backend/app/routers/chat_shift_adjust.py
from fastapi import APIRouter, HTTPException
from typing import Optional
from ..schemas import ShiftAdjustRequest, ShiftAdjustResponse
from ..services.shift_adjustment import ShiftAdjustmentService

router = APIRouter(prefix="/api/chat", tags=["chat-shift-adjust"])

@router.post("/shift-adjust", response_model=ShiftAdjustResponse)
async def process_shift_adjustment(request: ShiftAdjustRequest):
    """シフト調整チャット処理"""
    service = ShiftAdjustmentService()
    return await service.process_adjustment(request)
```

#### 3.1.2 調整サービス
```python
# hokkoku_backend/app/services/shift_adjustment.py
from typing import Dict, Any, Optional
from ..services.llm import LLMService
from ..services.validation import ValidationService
from ..store import store

class ShiftAdjustmentService:
    def __init__(self):
        self.llm_service = LLMService()
        self.validation_service = ValidationService()
    
    async def process_adjustment(self, request: ShiftAdjustRequest) -> ShiftAdjustResponse:
        # 1. 意図判定
        intent = await self.llm_service.detect_intent(request.content)
        
        if intent.type == "qa":
            # 質問回答
            answer = await self.llm_service.generate_qa(request.content)
            return ShiftAdjustResponse(
                intent="qa",
                assistant_text=answer,
                adjustment_rule=None
            )
        else:
            # 調整処理
            rule = await self.llm_service.generate_adjustment_rule(request.content)
            validation = self.validation_service.validate_rule(rule)
            
            if validation.is_valid:
                preview = await self.generate_preview(rule)
                return ShiftAdjustResponse(
                    intent="adjust",
                    assistant_text="調整案を生成しました",
                    adjustment_rule=rule,
                    preview=preview
                )
            else:
                return ShiftAdjustResponse(
                    intent="adjust",
                    assistant_text=f"調整ルールに問題があります: {validation.errors}",
                    adjustment_rule=None
                )
```

### 3.2 フロントエンド実装

#### 3.2.1 チャットコンポーネント
```typescript
// hokkoku_frontend/src/components/ShiftAdjustmentChat.tsx
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ShiftAdjustmentChatProps {
  onAdjustmentPreview: (preview: any) => void;
}

export const ShiftAdjustmentChat: React.FC<ShiftAdjustmentChatProps> = ({
  onAdjustmentPreview
}) => {
  const [messages, setMessages] = useState<Array<any>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    setIsLoading(true);
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch('/api/chat/shift-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input })
      });
      
      const data = await response.json();
      const assistantMessage = { 
        role: 'assistant', 
        content: data.assistant_text,
        adjustment_rule: data.adjustment_rule,
        preview: data.preview
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.preview) {
        onAdjustmentPreview(data.preview);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-800'
            }`}>
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
              処理中...
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="シフト調整の指示を入力してください..."
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading}>
            送信
          </Button>
        </div>
      </div>
    </div>
  );
};
```

## 4. 品質保証計画

### 4.1 テスト戦略

#### 4.1.1 単体テスト
- **バックエンド**: pytest による API テスト
- **フロントエンド**: Jest + React Testing Library
- **カバレッジ目標**: 80%以上

#### 4.1.2 統合テスト
- API 間連携テスト
- データベース統合テスト
- WebSocket通信テスト

#### 4.1.3 エンドツーエンドテスト
- Playwright によるブラウザテスト
- ユーザーシナリオテスト
- パフォーマンステスト

### 4.2 コードレビュー
- **レビュー対象**: 全実装コード
- **レビュー担当**: チーム内相互レビュー
- **レビュー基準**: コーディング規約、セキュリティ、パフォーマンス

### 4.3 セキュリティチェック
- **静的解析**: SonarQube による脆弱性チェック
- **依存関係チェック**: 既知の脆弱性チェック
- **ペネトレーションテスト**: 認証・認可テスト

## 5. リスク管理

### 5.1 技術リスク

#### 5.1.1 LLM応答品質
**リスク**: LLMの応答品質が期待値を下回る
**対策**: 
- プロンプトの段階的改善
- フォールバック機能の実装
- 人間による品質チェック機能

#### 5.1.2 パフォーマンス
**リスク**: 調整処理が遅い
**対策**:
- 非同期処理の実装
- キャッシュ機能の追加
- 処理の最適化

### 5.2 スケジュールリスク

#### 5.2.1 実装遅延
**リスク**: 複雑な調整アルゴリズムで遅延
**対策**:
- 段階的実装
- 優先度の明確化
- バッファ時間の確保

#### 5.2.2 品質問題
**リスク**: テストで多くの問題が発見される
**対策**:
- 早期テスト実施
- 継続的インテグレーション
- 品質ゲートの設定

## 6. 成功指標

### 6.1 機能指標
- [ ] 意図判定精度: 80%以上
- [ ] 調整成功率: 90%以上
- [ ] ユーザー満足度: 4.0/5.0以上

### 6.2 性能指標
- [ ] 平均応答時間: 3秒以下
- [ ] システム稼働率: 99%以上
- [ ] エラー率: 5%以下

### 6.3 プロジェクト指標
- [ ] スケジュール遵守: 100%
- [ ] 予算遵守: 100%
- [ ] 品質目標達成: 100%

## 7. 運用・保守計画

### 7.1 監視・アラート
- **アプリケーション監視**: 応答時間、エラー率
- **LLM使用量監視**: トークン使用量、コスト
- **システム監視**: CPU、メモリ、ディスク使用量

### 7.2 バックアップ・復旧
- **データバックアップ**: 日次バックアップ
- **設定バックアップ**: 週次バックアップ
- **障害復旧手順**: 5分以内復旧

### 7.3 アップデート計画
- **機能追加**: 月次リリース
- **セキュリティ更新**: 即座に適用
- **パフォーマンス改善**: 継続的改善

## 8. 成果物一覧

### 8.1 開発成果物
- [ ] 要件定義書
- [ ] アーキテクチャ設計書
- [ ] 実装計画書
- [ ] ソースコード
- [ ] API仕様書
- [ ] テストコード

### 8.2 ドキュメント
- [ ] ユーザーマニュアル
- [ ] 運用マニュアル
- [ ] トラブルシューティングガイド
- [ ] 開発者ガイド

### 8.3 テスト成果物
- [ ] テスト計画書
- [ ] テスト結果レポート
- [ ] バグ修正リスト
- [ ] パフォーマンステスト結果
