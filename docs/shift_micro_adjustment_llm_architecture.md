# シフト微調整LLM統合機能 アーキテクチャ設計書

## 1. システム概要

### 1.1 アーキテクチャ図

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   フロントエンド   │    │    バックエンド    │    │     LLM API     │
│   (React/Vite)   │    │   (FastAPI)     │    │   (OpenAI)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. チャット入力        │                       │
         │ "水曜の人数を増やして"  │                       │
         ├───────────────────────┤                       │
         │                       │                       │
         │ 2. POST /api/chat/shift-adjust│               │
         ├───────────────────────┤                       │
         │                       │ 3. 意図判定            │
         │                       │ (質問 vs 調整)         │
         ├───────────────────────┤                       │
         │                       │ 4. LLM呼び出し        │
         │                       │ - 意図判定             │
         │                       │ - 調整ルール生成       │
         ├───────────────────────┤                       │
         │ 5. 応答表示            │                       │
         │ (質問回答 or 調整案)   │                       │
         ├───────────────────────┤                       │
         │                       │ 6. 調整案生成          │
         │                       │ - シフト分析           │
         │                       │ - 調整アルゴリズム     │
         ├───────────────────────┤                       │
         │ 7. プレビュー表示      │                       │
         │ (差分ハイライト)       │                       │
         ├───────────────────────┤                       │
         │                       │ 8. 調整適用            │
         │ 9. POST /api/shifts/adjust│                   │
         ├───────────────────────┤                       │
         │ 10. リアルタイム更新   │                       │
         │ (WebSocket)           │                       │
         └───────────────────────┘                       │
```

### 1.2 コンポーネント構成

#### フロントエンド（既存機能を活用）
- **MicroAdjustments.tsx**: 既存のチャットUIを拡張
- **ChatComponent**: 既存のチャットUI、メッセージ表示
- **ShiftPreviewComponent**: 既存のシフト表示、差分ハイライト
- **AdjustmentControls**: 既存の調整適用/キャンセル操作

#### バックエンド（既存機能を拡張）
- **chat.py**: 既存のチャットAPIを拡張
- **openai_client.py**: 既存のLLM統合機能を拡張
- **adjustments.py**: 既存の調整アルゴリズムを拡張
- **validation.py**: 既存の検証機能を拡張
- **store.py**: 既存のセッション管理をそのまま使用

#### データ層（既存機能を活用）
- **SessionStore**: 既存のチャットセッション管理
- **ShiftStore**: 既存のシフトデータ管理
- **AdjustmentStore**: 既存の調整履歴管理

## 2. 詳細設計

### 2.1 API設計

#### 2.1.1 チャットAPI（既存APIを拡張）
```python
# 既存のチャットAPIを拡張
POST /api/chat/parse  # 既存エンドポイント
{
  "text": "string"
}

# 新規エンドポイント（既存機能を活用）
POST /api/chat/shift-adjust
{
  "session_id": "string",
  "content": "string",
  "mode": "auto|qa|adjust"
}

Response:
{
  "message_id": "string",
  "intent": "qa|adjust",
  "confidence": 0.95,
  "assistant_text": "string",
  "adjustment_rule": {...},
  "preview": {...}
}
```

#### 2.1.2 シフト調整API（既存APIを活用）
```python
# 既存の調整APIを活用
POST /api/adjustments/preview  # 既存エンドポイント
POST /api/adjustments/apply    # 既存エンドポイント
POST /api/adjustments/rollback # 既存エンドポイント

# 新規エンドポイント（既存機能を拡張）
POST /api/shifts/adjust
{
  "session_id": "string",
  "adjustment_rule": {...},
  "apply_mode": "draft|immediate"
}

Response:
{
  "success": true,
  "adjustment_id": "string",
  "applied_at": "2025-08-18T10:00:00Z",
  "changes": [...]
}
```

### 2.2 LLM統合設計

#### 2.2.1 意図判定プロンプト（既存プロンプトを拡張）
```
# 既存の意図判定プロンプトを拡張
システム: あなたはシフト調整アシスタントです。ユーザーの入力が質問か調整指示かを判定してください。

出力形式: JSONのみ
{
  "intent": "qa|apply|adjust",  # 既存のqa/applyにadjustを追加
  "confidence": 0.0-1.0,
  "reason": "判定理由"
}

判定基準:
- 質問: 「なぜ」「どうして」「説明して」「何人」等
- 制約変更: 「制約を変更して」「条件を変更して」等（既存）
- 調整: 「〜して」「〜を変更して」「〜を増やして」等（新規）
```

#### 2.2.2 調整ルール生成プロンプト（既存プロンプトを拡張）
```
# 既存の制約変更プロンプトを拡張
システム: あなたはシフト調整ルール生成エキスパートです。自然言語から調整ルールを生成してください。

出力形式: JSONのみ
{
  "type": "pair_not_together|increase_staff_day|redistribute_shifts|time_slot_adjustment",
  "parameters": {
    "employee_ids": [1, 2],
    "day": "monday|tuesday|...",
    "time_slot": "morning|afternoon|night",
    "target_count": 3
  },
  "priority": "high|medium|low",
  "description": "ルールの説明"
}

ルールタイプ:
- pair_not_together: 2人の同時配置禁止（既存機能を活用）
- increase_staff_day: 特定日の人員増加（新規追加）
- redistribute_shifts: シフト再配分（新規追加）
- time_slot_adjustment: 時間帯調整（新規追加）
```

### 2.3 調整アルゴリズム設計

#### 2.3.1 pair_not_together（既存機能を活用）
```python
# 既存のadjustments.pyのpair_not_together機能をそのまま使用
def adjust_pair_not_together(rule, current_shifts):
    """
    2人の同時配置を避ける調整（既存機能を活用）
    """
    employee_a, employee_b = rule.parameters.employee_ids
    conflicts = find_conflicting_shifts(employee_a, employee_b)
    
    for conflict in conflicts:
        replacement = find_replacement_employee(conflict, exclude=[employee_a, employee_b])
        if replacement:
            swap_shifts(conflict, replacement)
    
    return adjusted_shifts
```

#### 2.3.2 increase_staff_day（既存機能を拡張）
```python
# 既存のadjustments.pyの調整ロジックをベースに実装
def adjust_increase_staff_day(rule, current_shifts):
    """
    特定日の人員増加調整（既存機能を拡張）
    """
    target_day = rule.parameters.day
    target_count = rule.parameters.target_count
    current_count = count_staff_on_day(target_day)
    
    if current_count < target_count:
        needed = target_count - current_count
        available_employees = find_available_employees(target_day)
        
        for _ in range(needed):
            if available_employees:
                employee = select_best_employee(available_employees)
                add_shift(employee, target_day)
                available_employees.remove(employee)
    
    return adjusted_shifts
```

#### 2.3.3 redistribute_shifts（既存機能を拡張）
```python
# 既存のadjustments.pyの調整ロジックをベースに実装
def adjust_redistribute_shifts(rule, current_shifts):
    """
    シフト再配分調整（既存機能を拡張）
    """
    employee_shifts = analyze_shift_distribution(current_shifts)
    overworked = find_overworked_employees(employee_shifts)
    underworked = find_underworked_employees(employee_shifts)
    
    for over_emp in overworked:
        for under_emp in underworked:
            if can_swap_shifts(over_emp, under_emp):
                swap_shifts(over_emp, under_emp)
                break
    
    return adjusted_shifts
```

### 2.4 データフロー

#### 2.4.1 調整処理フロー
1. **入力受付**: ユーザーの自然言語入力
2. **意図判定**: LLMによる質問/調整の判定
3. **ルール生成**: 調整指示の場合、LLMによるルール生成
4. **ルール検証**: 生成されたルールの妥当性確認
5. **調整実行**: 調整アルゴリズムによるシフト変更
6. **結果検証**: 調整結果の制約チェック
7. **プレビュー生成**: 変更前後の差分計算
8. **適用**: ユーザー承認後の適用

#### 2.4.2 エラーハンドリング
- **LLM応答エラー**: フォールバック応答、再試行
- **ルール検証エラー**: エラー詳細表示、修正提案
- **調整実行エラー**: 部分適用、ロールバック
- **制約違反**: 警告表示、代替案提案

## 3. 技術仕様

### 3.1 使用技術
- **フロントエンド**: React 19, TypeScript, Tailwind CSS
- **バックエンド**: FastAPI, Python 3.12
- **LLM**: OpenAI GPT-4o-mini
- **データベース**: SQLite (開発), PostgreSQL (本番)
- **リアルタイム通信**: WebSocket

### 3.2 パフォーマンス要件
- **意図判定**: ≤ 2秒
- **調整案生成**: ≤ 5秒
- **調整適用**: ≤ 3秒
- **同時接続**: 10ユーザー以上

### 3.3 セキュリティ要件
- **認証**: JWT認証
- **認可**: ロールベースアクセス制御
- **監査**: 全操作のログ記録
- **データ保護**: 個人情報の暗号化

## 4. 実装計画

### 4.1 フェーズ1: 既存機能拡張 (1週間)
- [ ] 既存LLM統合機能の拡張（openai_client.py）
- [ ] 既存チャット機能の拡張（chat.py）
- [ ] 既存調整機能の拡張（adjustments.py）

### 4.2 フェーズ2: 新機能実装 (2週間)
- [ ] 新規調整アルゴリズム実装（increase_staff_day, redistribute_shifts）
- [ ] 新規LLMプロンプト実装
- [ ] 新規APIエンドポイント実装

### 4.3 フェーズ3: UI統合 (1週間)
- [ ] 既存UI基盤の拡張（MicroAdjustments.tsx）
- [ ] 新機能のUI統合
- [ ] 既存機能との統合テスト

### 4.4 フェーズ4: 統合・テスト (1週間)
- [ ] 既存機能の動作確認
- [ ] 新機能のエンドツーエンドテスト
- [ ] パフォーマンステスト
- [ ] セキュリティテスト

## 5. リスク・対策

### 5.1 技術リスク
- **LLM応答品質**: プロンプトチューニング、フォールバック機能
- **調整アルゴリズム**: 段階的実装、テスト駆動開発
- **パフォーマンス**: キャッシュ機能、非同期処理

### 5.2 運用リスク
- **コスト**: LLM使用量監視、コスト制限機能
- **可用性**: 冗長化、障害復旧手順
- **セキュリティ**: 定期的なセキュリティ監査

## 6. 成功指標

### 6.1 機能指標
- 意図判定精度: 80%以上
- 調整成功率: 90%以上
- ユーザー満足度: 4.0/5.0以上

### 6.2 性能指標
- 平均応答時間: 3秒以下
- システム稼働率: 99%以上
- エラー率: 5%以下

### 6.3 運用指標
- 日次調整処理数: 100回以上
- LLMコスト: 月額1万円以下
- サポート問い合わせ: 週1件以下
