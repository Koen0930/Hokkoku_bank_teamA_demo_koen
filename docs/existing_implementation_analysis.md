# 既存実装の詳細分析と活用方針

## 1. 既存LLM統合機能の分析

### 1.1 現在のLLM機能構成

#### 1.1.1 OpenAI統合基盤 (`openai_client.py`)
**実装済み機能:**
- **意図判定**: `detect_intent()` - 質問/適用の自動判定
- **制約変更生成**: `generate_apply()` - 制約条件のJSON生成
- **質問回答**: `generate_qa()` - 自然言語での回答生成
- **JSON抽出**: `_extract_json()` - LLM応答からのJSON解析
- **エラーハンドリング**: フォールバック機能、再試行機能

**活用可能な部分:**
- ✅ 意図判定の基盤（質問 vs 調整の判定に拡張可能）
- ✅ JSON生成・解析の基盤
- ✅ エラーハンドリング・フォールバック機能
- ✅ プロンプト設計のパターン

#### 1.1.2 LLM API統合 (`llm.py`)
**実装済み機能:**
- **セッション管理**: `/api/llm/sessions`
- **メッセージ処理**: `/api/llm/sessions/{id}/messages`
- **意図ルーティング**: `intent_service.route()`
- **制約検証**: `validate_constraints()`
- **差分計算**: `summarize_diff()`

**活用可能な部分:**
- ✅ セッション管理基盤
- ✅ メッセージ処理フロー
- ✅ 意図ルーティング機能
- ✅ 検証・差分計算機能

### 1.2 既存チャット微調整機能の分析

#### 1.2.1 チャット解析 (`chat.py`)
**実装済み機能:**
- **名前抽出**: `_extract_names()` - 日本語名の抽出（完全一致、敬語付き、姓のみ）
- **ルール正規化**: `NormalizedRule` - pair_not_togetherルールの生成
- **曖昧解消**: 類似名の提案機能

**活用可能な部分:**
- ✅ 名前抽出アルゴリズム（拡張可能）
- ✅ ルール正規化の基盤
- ✅ 曖昧解消機能

#### 1.2.2 調整機能 (`adjustments.py`)
**実装済み機能:**
- **プレビュー生成**: 調整案の生成
- **適用・ロールバック**: 変更の適用と取り消し
- **WebSocket通信**: リアルタイム更新

**活用可能な部分:**
- ✅ 調整アルゴリズムの基盤
- ✅ 適用・ロールバック機能
- ✅ WebSocket通信基盤

## 2. 既存実装を活用した拡張方針

### 2.1 段階的拡張アプローチ

#### フェーズ1: LLM統合の拡張（最小変更）
**変更箇所:**
1. **`openai_client.py`の拡張**
   ```python
   # 既存のdetect_intent()を拡張
   def detect_shift_adjustment_intent(content: str, context: Dict[str, Any]) -> Dict[str, Any]:
       # 既存のdetect_intent()をベースに調整判定を追加
   
   # 新しい調整ルール生成機能
   def generate_shift_adjustment_rule(content: str, context: Dict[str, Any]) -> Dict[str, Any]:
       # 既存のgenerate_apply()をベースに調整ルール生成
   ```

2. **`chat.py`の拡張**
   ```python
   # 既存のparse()を拡張
   @router.post("/shift-adjust", response_model=ShiftAdjustResponse)
   def parse_shift_adjustment(req: ShiftAdjustRequest):
       # 既存のparse()をベースにLLM統合を追加
   ```

#### フェーズ2: 調整アルゴリズムの拡張
**変更箇所:**
1. **`adjustments.py`の拡張**
   ```python
   # 既存の調整アルゴリズムを拡張
   def adjust_increase_staff_day(rule, current_shifts):
       # 既存のpair_not_together()をベースに実装
   
   def adjust_redistribute_shifts(rule, current_shifts):
       # 既存の調整ロジックをベースに実装
   ```

#### フェーズ3: UI統合
**変更箇所:**
1. **`MicroAdjustments.tsx`の拡張**
   ```typescript
   // 既存のチャットUIを拡張
   const handleShiftAdjustment = async () => {
       // 既存のhandleSend()をベースにLLM統合を追加
   }
   ```

### 2.2 既存コードの再利用戦略

#### 2.2.1 高再利用性のコンポーネント
**完全活用可能:**
- ✅ **セッション管理**: `store.py`のセッション機能
- ✅ **WebSocket通信**: `adjustments_ws.py`のリアルタイム機能
- ✅ **名前抽出**: `_extract_names()`の日本語名処理
- ✅ **ルール検証**: `validate_constraints()`の検証機能
- ✅ **差分計算**: `summarize_diff()`の差分表示機能

#### 2.2.2 部分活用可能なコンポーネント
**拡張が必要:**
- 🔄 **意図判定**: 既存のqa/applyに調整判定を追加
- 🔄 **ルール生成**: 既存の制約変更に調整ルールを追加
- 🔄 **調整アルゴリズム**: 既存のpair_not_togetherに新ルールを追加

#### 2.2.3 新規実装が必要なコンポーネント
**完全新規:**
- ❌ **調整ルールタイプ**: increase_staff_day, redistribute_shifts等
- ❌ **調整アルゴリズム**: 人員増加、シフト再配分等
- ❌ **LLMプロンプト**: 調整専用のプロンプト設計

## 3. 実装優先度と影響度

### 3.1 高優先度・低影響度
**既存機能を最大限活用:**
1. **セッション管理**: 既存の`store.py`をそのまま使用
2. **WebSocket通信**: 既存の`adjustments_ws.py`を拡張
3. **名前抽出**: 既存の`_extract_names()`を拡張
4. **UI基盤**: 既存の`MicroAdjustments.tsx`を拡張

### 3.2 中優先度・中影響度
**既存機能を拡張:**
1. **LLM統合**: 既存の`openai_client.py`に新機能を追加
2. **意図判定**: 既存の`detect_intent()`に調整判定を追加
3. **ルール検証**: 既存の検証機能を調整ルールに対応

### 3.3 低優先度・高影響度
**新規実装が必要:**
1. **調整アルゴリズム**: 新しい調整ロジックの実装
2. **LLMプロンプト**: 調整専用のプロンプト設計
3. **UI拡張**: 新しい調整タイプのUI対応

## 4. 具体的な実装計画

### 4.1 最小限の変更での実装

#### Step 1: LLM統合の拡張（1日）
```python
# openai_client.pyに追加
def detect_shift_adjustment_intent(content: str, context: Dict[str, Any]) -> Dict[str, Any]:
    # 既存のdetect_intent()をベースに実装
    # 調整判定を追加（"adjust"を返す）

def generate_shift_adjustment_rule(content: str, context: Dict[str, Any]) -> Dict[str, Any]:
    # 既存のgenerate_apply()をベースに実装
    # 調整ルール生成を追加
```

#### Step 2: チャットAPIの拡張（1日）
```python
# chat.pyに追加
@router.post("/shift-adjust", response_model=ShiftAdjustResponse)
def parse_shift_adjustment(req: ShiftAdjustRequest):
    # 既存のparse()をベースに実装
    # LLM統合を追加
```

#### Step 3: 調整アルゴリズムの実装（2日）
```python
# adjustments.pyに追加
def adjust_increase_staff_day(rule, current_shifts):
    # 既存の調整ロジックをベースに実装

def adjust_redistribute_shifts(rule, current_shifts):
    # 既存の調整ロジックをベースに実装
```

### 4.2 既存機能との統合

#### 統合ポイント1: セッション管理
```python
# 既存のstore.pyを活用
session_id = store.create_session("shift_adjustment", None)
```

#### 統合ポイント2: WebSocket通信
```python
# 既存のadjustments_ws.pyを活用
await manager.broadcast_to_session(session_id, {
    "type": "shift_adjustment_ready",
    "payload": adjustment_result
})
```

#### 統合ポイント3: UI統合
```typescript
// 既存のMicroAdjustments.tsxを拡張
const handleShiftAdjustment = async () => {
    // 既存のhandleSend()をベースに実装
    // LLM統合を追加
}
```

## 5. リスクと対策

### 5.1 技術リスク
**既存機能への影響:**
- **リスク**: 既存のチャット機能が動作しなくなる
- **対策**: 新エンドポイントを追加し、既存機能はそのまま維持

**LLM統合の複雑性:**
- **リスク**: 既存のLLM機能と競合する
- **対策**: 既存機能を拡張する形で実装、独立したプロンプト設計

### 5.2 スケジュールリスク
**実装時間の見積もり:**
- **リスク**: 既存コードの理解に時間がかかる
- **対策**: 段階的実装、既存機能のテストを維持

**品質リスク:**
- **リスク**: 既存機能の品質が低下する
- **対策**: 既存テストの継続実行、新機能の独立テスト

## 6. 成功指標

### 6.1 技術指標
- **既存機能の維持**: 100%の既存機能が正常動作
- **新機能の品質**: 80%以上のテストカバレッジ
- **パフォーマンス**: 既存機能と同等の応答時間

### 6.2 開発効率指標
- **再利用率**: 70%以上の既存コードを活用
- **新規コード**: 30%以下の新規実装
- **開発時間**: 既存実装の50%以下の開発時間

## 7. 結論

既存のLLM統合機能とチャット微調整機能を最大限活用することで、シフト微調整LLM統合機能を効率的に実装できます。

**主要な活用ポイント:**
1. **既存LLM基盤**: 意図判定、JSON生成、エラーハンドリング
2. **既存チャット機能**: 名前抽出、ルール正規化、曖昧解消
3. **既存調整機能**: プレビュー生成、適用・ロールバック、WebSocket通信

**実装方針:**
- 既存機能を拡張する形で実装
- 新エンドポイントを追加して既存機能を保護
- 段階的実装でリスクを最小化
- 既存テストを維持して品質を保証

この方針により、開発効率を最大化しつつ、既存機能の安定性を維持できます。
