# LLMインターフェース要件定義 (LLM-driven Constraint Interface)

## 概要
本ドキュメントは、自然言語（チャット）で最適化条件を動的に変更し、システムプロンプトを通じて厳密な条件JSONを生成・検証・適用する新機能の要件を定義する。既存のシフト最適化機能（OR-Tools CP-SAT）に対して、LLMを「条件編集用UI/制約エンジンの翻訳層」として安全かつ監査可能に追加する。
本機能は2つのチャットモードを提供する：
- 適用モード（Apply Mode）: LLMは適用用のstrict JSON（検証対象）に加え、人間向けの意図要約/影響説明テキスト（assistant_text）も返す。UIは差分プレビューと要約を並列表示する。
- Q&amp;Aモード（QA Mode）: 純粋な自然言語回答のみ（適用なし）。ユーザーの質問に臨機応変に回答し、必要時のみ適用モードに誘導する。
本機能は2つのチャットモードを提供する：
- 適用モード（Apply Mode）: LLMは適用用のstrict JSON（検証対象）に加え、人間向けの意図要約/影響説明テキスト（assistant_text）も返す。UIは差分プレビューと要約を並列表示する。
- Q&amp;Aモード（QA Mode）: 純粋な自然言語回答のみ（適用なし）。ユーザーの質問に臨機応変に回答し、必要時のみ適用モードに誘導する。

## 目的
- 自然言語で制約条件や目的関数を表現できるようにし、運用担当者の負担を軽減
- 生成された条件を厳格なスキーマで検証し、既存最適化エンジンに安全に適用
- 会話履歴と条件バージョンの追跡により、監査性と再現性を担保

## スコープ
- チャットUI、LLMバックエンド連携、プロンプト設計
- 条件JSONスキーマ定義、サーバ側検証・差分計算・バージョニング
- 条件適用モード（ドラフト/即時）、最適化実行トリガ、結果の要約説明生成
- ログ・監査・権限管理の拡張
- 非スコープ: 認証/基盤設計の大幅変更、外部人事システム連携

## 用語
- 条件JSON: OR-Toolsに渡す前段の抽象化された最適化条件の厳格スキーマ
- システムプロンプト: LLMに対してJSONのみ（no prose）で出力を求め、ポリシー/制約を明示した定常プロンプト
- ドラフト: 適用前の候補条件。承認後に実行へ反映
- セッション: チャットの単位。会話履歴・条件の版を束ねる

## ユースケース
- UC-01: 管理者が「週末は最小人員を+1に」など自然言語で指示 → LLMが条件JSON差分を提案 → 承認して適用
- UC-02: 違反警告が多い場合に「違反コストを高めて」→ 目的関数の重み調整JSONを生成 → 再最適化
- UC-03: 「連勤上限を4日に」「この2人は同時に配置しない」など複合指示 → スキーマに沿ったマージ案を提示
- UC-04: 過去版へのロールバック/比較 → 差分プレビュー/コメント付き要約
- UC-05: 生成エラー（スキーマ不一致） → 自動再プロンプト/ユーザーへの修正提案

## 機能要件

### F-L1: チャット入力/履歴表示
- 送信: テキスト（日本語優先、英語も将来対応）
- 表示: ユーザー発話、LLM応答（assistant_text: 人向け要約/説明）、システム通知
- 履歴: セッション単位で保持、検索・フィルタ
- 手動切替: ユーザーはApply/QAを手動で切替可能（既定は自動判定）。

### F-L2: 条件JSON生成（LLM）
- 入力: 現在の条件JSON、制約辞書、許容操作一覧、ユーザー発話、推定モード（apply|qa|auto）
- 出力（apply時）: assistant_text（意図/影響の要約）＋ strict JSON（json_patch: 標準、full_json: 大規模変更時fallback、追加テキスト禁止）
- 出力（qa時）: assistant_text のみ（適用は行わない）
- 形式: 差分パッチ（JSON Patch互換）を標準。大規模変更はfull_jsonに自動切替提案
- 妥当性: サーバ側でJSON Schema検証、禁止キー/範囲外を拒否。JSON逸脱時は自動再プロンプト（最大2回）。

### F-L3: 条件スキーマ/辞書
- JSON Schema（$id/versioning付与）で定義し、LLMにはスキーマ抜粋と例を供給
- 種別:
  - ハード制約: 最小人員、連勤上限、休憩、勤務時間帯、役職/スキル要求など
  - ソフト制約: 勤怠希望、均等化、コスト最小化、満足度最大化重み
  - 需要カーブ/営業時間/週次設定
- 変更操作:
  - 追加/更新/削除（操作は allow-list 化）
  - 重みは 0〜10 等の限定レンジ

### F-L4: 差分プレビュー/適用モード
- 差分表示（before/after、ハイライト、影響説明）。影響説明は assistant_text を利用
- モード:
  - Draft: 既定。承認必要、ロール/権限で承認可否
  - Immediate: 管理者のみ即時適用（監査ログ必須）
- 競合: 同時編集検知、マージ戦略（LLM提案/最終は人手確認）

### F-L5: 最適化実行トリガ
- 条件確定後に OR-Tools 実行
- 実行モード: 全体再計算/部分最適化（影響範囲のみ）
- 進捗/結果: 実行時間、違反数、目的関数値、改善サマリ（LLMに要約依頼可）

### F-L6: 安全策・監査
- プロンプト注入対策（システム指示優先、ツール呼び出し境界）
- 出力制限（JSON以外は拒否・再プロンプト）
- PII除去方針（従業員名は内部IDへマッピングしてLLM送信可否を設定）
- 監査ログ: 発話/プロンプト/出力/適用差分/承認者/実行結果
- レート制限/コスト上限

### F-L7: UI拡張
- 左/右ペインにチャットパネル
- チャットバブルに assistant_text を表示。apply応答時はバブル下に「差分を見る」「適用」ボタン
- 条件差分プレビュー、影響推定（違反見込み/変動コスト）
- ロールバック/版比較、履歴検索
- ストリーミング応答表示（可能なら）

## 非機能要件（LLM拡張分）
## モード/意図ルーティング
- 自動判定: LLMに intent: "apply"|"qa" と confidence ∈ [0,1] の推定を出力させる。
- 閾値: confidence &lt; 0.7 は qa として扱い、人向け回答のみ表示しつつ「適用案を生成」ボタンを提示。
- 安全側運用: apply判定でも必ず差分プレビュー→承認を経て適用。直適用は管理者のImmediateのみ。
- 手動切替: ユーザーはUIトグルでapply/qaを明示選択できる。自動判定は上書き可能。
- 応答時間: チャット生成 ≤ 5s（p95 ≤ 10s）
- コスト: 1セッション上限/月次上限を設定可能
- 可用性: LLM障害時フェールセーフ（最後の確定条件で運用）
- セキュリティ: APIキー秘匿、RBACで適用権限を限定
- 監査: すべての適用は監査ログ+署名ID

## API設計（追加/変更）

### REST
- POST /api/llm/sessions
  - body: { title?, seed_constraints_id? }
  - returns: { session_id }
- POST /api/llm/sessions/{session_id}/messages
  - body: { content: string, mode?: "apply"|"qa"|"auto", apply_mode?: "draft"|"immediate" }
  - returns（mode=applyまたはautoでapply判定時）: {
      message_id,
      intent: "apply",
      confidence: number,
      assistant_text: string,
      json_patch?: array,
      full_json?: object,
      validation: { ok: boolean, errors: array },
      diff_summary?: object,
      draft_constraints?: object
    }
  - returns（mode=qaまたはautoでqa判定時）: {
      message_id,
      intent: "qa",
      confidence: number,
      assistant_text: string
    }
- GET /api/llm/sessions/{session_id}/history
- POST /api/constraints/validate
  - body: { constraints_json }
  - returns: { ok, errors[], normalized_json }
- POST /api/constraints/apply
  - body: { session_id, constraints_json, apply_mode: "draft"|"immediate", comment? }
  - returns: { version_id, applied_at }

### WebSocket
- /ws/llm/{session_id}: apply応答のストリーム（assistant_text→JSON検証→diff生成→適用可否）と進捗通知
- /ws/optimization: 再最適化進捗/結果通知

## 条件JSONスキーマ（草案）
```json
{
  "$id": "https://hokkoku.example.com/schemas/constraints.v1.json",
  "type": "object",
  "required": ["time_horizon", "staffing", "hard_constraints", "soft_constraints"],
  "properties": {
    "time_horizon": {
      "type": "object",
      "required": ["start_date", "days", "slot_minutes"],
      "properties": {
        "start_date": { "type": "string", "format": "date" },
        "days": { "type": "integer", "minimum": 1, "maximum": 14 },
        "slot_minutes": { "type": "integer", "enum": [30, 60] }
      }
    },
    "staffing": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["day", "slot", "min", "max", "skills?"],
        "properties": {
          "day": { "type": "integer", "minimum": 1, "maximum": 7 },
          "slot": { "type": "string", "pattern": "^[0-2][0-9]:[0-5][0-9]$" },
          "min": { "type": "integer", "minimum": 0, "maximum": 20 },
          "max": { "type": "integer", "minimum": 0, "maximum": 30 },
          "skills": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "hard_constraints": {
      "type": "object",
      "properties": {
        "max_consecutive_days": { "type": "integer", "minimum": 1, "maximum": 7 },
        "min_rest_hours": { "type": "integer", "minimum": 0, "maximum": 24 },
        "max_daily_hours": { "type": "integer", "minimum": 1, "maximum": 12 },
        "shifts_blacklist_pairs": {
          "type": "array",
          "items": { "type": "array", "items": { "type": "string" }, "minItems": 2, "maxItems": 2 }
        },
        "role_skill_requirements": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["day", "slot", "skill", "min"],
            "properties": {
              "day": { "type": "integer", "minimum": 1, "maximum": 7 },
              "slot": { "type": "string" },
              "skill": { "type": "string" },
              "min": { "type": "integer", "minimum": 0, "maximum": 10 }
            }
          }
        }
      }
    },
    "soft_constraints": {
      "type": "object",
      "properties": {
        "fairness_weight": { "type": "integer", "minimum": 0, "maximum": 10, "default": 5 },
        "preference_weight": { "type": "integer", "minimum": 0, "maximum": 10, "default": 5 },
        "cost_weight": { "type": "integer", "minimum": 0, "maximum": 10, "default": 5 }
      }
## LLMプロバイダ/モデル
- 初期対応: OpenAI API
  - 推奨: JSON出力制約に強い function calling / responses API を利用
  - 設定: 温度/最大トークンは環境設定。コスト/トークン上限はセッション/組織単位で適用
- 将来対応: プロバイダ抽象化層により Azure OpenAI/社内LLMへ切替可能
    },
    "employees_overrides": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["employee_id"],
        "properties": {
          "employee_id": { "type": "string" },
          "days_off": { "type": "array", "items": { "type": "string", "format": "date" } },
          "unavailable_slots": {
            "type": "array",
            "items": { "type": "object", "required": ["day", "slot"], "properties": {
              "day": { "type": "integer", "minimum": 1, "maximum": 7 },
              "slot": { "type": "string" }
            } }
          }
        }
      }
    }
  },
  "additionalProperties": false
}
```

## プロンプト設計（要点）
- システムプロンプト（apply）
  - 出力は2部構成：assistant_text（人向け要約/影響説明）と JSON（json_patch または full_json）。JSON以外の注釈禁止。
  - 許可されたキー/範囲のみ使用。未知キー・日本語キーは英語の規定キーに正規化。
  - 差分モード時は RFC 6902 互換の JSON Patch 配列を返す。大規模変更時は full_json を提案。
  - 例とスキーマ、現在条件、許容操作一覧、ユーザー意図（extractした構造化要約）を提示。
- システムプロンプト（qa）
  - 自然言語回答のみ。適用が必要と判断時は「適用案の生成が可能」と提案し、ユーザーの指示でapplyに切替。
- ガードレール
  - applyでJSON以外の文字・コメント・マークダウンを検知したら即座に再プロンプト（最大2回）
  - サイズ上限超過時は分割提案
  - 逸脱時は role=system を強化して再試行（max 2 回）

## データ/永続化
- テーブル案
## 実装詳細

### A. アーキテクチャ概要
- フロントエンド（Next.js/React/TS）
  - コンポーネント: ChatPanel, DiffPreview, HistoryList, ApplyControls
  - 状態: session, messages[], draftConstraints, currentConstraints, intent/confidence, applyMode, validation/diff state
  - 通信: REST（sessions/messages/validate/apply）, WS（llm/optimization）
- バックエンド（FastAPI/Python）
  - サービス: LLMService(OpenAI), IntentRouter, SchemaValidator, DiffEngine(JSON Patch), ConstraintStore, AuditLogger, CostLimiter
  - API: /api/llm/sessions, /api/llm/sessions/{id}/messages, /api/constraints/validate, /api/constraints/apply
  - WS: /ws/llm/{session_id}, /ws/optimization
- データ層（SQLite）
  - テーブル: llm_sessions, llm_messages, constraint_versions, audit_logs, cost_usages

### B. API 詳細
- POST /api/llm/sessions
  - 入: { title?, seed_constraints_id? }
  - 出: { session_id }
- POST /api/llm/sessions/{session_id}/messages
  - 入: { content: string, mode?: "auto"|"apply"|"qa", apply_mode?: "draft"|"immediate" }
  - 動作:
    1) IntentRouter: mode=auto の場合、LLMに intent/confidence を推定させる（promptでJSONのみ）
    2) qa 判定 or confidence&lt;0.7 → assistant_text のみ返却
    3) apply 判定 → LLMへ apply prompt（assistant_text + json_patch|full_json）
    4) SchemaValidator で検証 → ok なら diff 生成、ng なら再プロンプト（最大2回）
  - 出: 
    - apply時: { message_id, intent:"apply", confidence, assistant_text, json_patch?, full_json?, validation:{ok,errors[]}, diff_summary?, draft_constraints? }
    - qa時: { message_id, intent:"qa", confidence, assistant_text }
- POST /api/constraints/validate
  - 入: { constraints_json }
  - 出: { ok, errors[], normalized_json }
- POST /api/constraints/apply
  - 入: { session_id, constraints_json, apply_mode:"draft"|"immediate", comment? }
  - 出: { version_id, applied_at }
- GET /api/llm/sessions/{session_id}/history
  - 出: messages[], 各要素に {role, content, mode, intent, confidence, assistant_text?, json_patch?, full_json?, validation?}

### C. OpenAI 統合
- SDK: openai（Responses API または Chat Completions + function calling）
- タイムアウト: 10s（apply）, 5s（qa）
- リトライ: ネットワーク/RateLimit時に指数バックオフ（最大2回）
- レート/コスト制御: CostLimiter が token 使用量をセッション/ユーザー/組織単位で集計し、上限到達時はエラー返却
- PII: 従業員名は employee_id に変換。サーバで ID→表示名のマッピングを保持し、LLMにはIDのみ送信（設定でスキルなどは許可）

### D. プロンプト設計（例）
- Intent 推定（auto）
  - 指示: 出力はJSONのみ。{ "intent": "apply"|"qa", "confidence": number } のみ返す。
  - コンテキスト: 直近数メッセージ、ユーザー発話、ルール（「設定変更/調整/増減/上限/重み」=apply傾向、「説明/理由/比較/どうすれば」=qa傾向）
- Apply 生成
  - 指示: 出力は { "assistant_text": string, "json": { "type": "patch"|"full", "patch"?: [...], "full"?: {...} } } のみ
  - 制約: 許可キー/レンジ、JSON Patch標準、未知キー禁止、コメント禁止
  - 入力: 現在constraints, JSON Schema抜粋, 許容操作リスト, ユーザー意図の構造化要約
- QA 回答
  - 指示: 人向け説明のみを返す。必要なら「適用案を生成できます」と最後に提案

### E. スキーマ/検証/差分
- JSON Schema: versioned（$idに v1）
- 検証: jsonschema/fastjsonschema を使用（Python）。unknown keys を禁止、数値レンジ/enum/formatチェック
- JSON Patch: RFC6902互換の op: add|remove|replace 等のみ許可。危険操作（ハード制約削除）には二重確認フラグ
- DiffEngine: before/after を生成し、UIに {changed_paths[], highlights, estimated_impact} を返す

### F. UI 実装詳細
- ChatPanel
  - テキスト入力、モードトグル（auto/apply/qa）、送信
  - 応答表示: assistant_text をバブル表示。apply応答には「差分を見る」「適用」「破棄」ボタン
- DiffPreview
  - before/after 表、変更パスのハイライト
  - assistant_text の影響説明をヘッダ表示
- ApplyControls
  - Draft/Immediate 選択（RBACでImmediate制御）
  - 承認→/apply→WSで進捗→完了
- HistoryList
  - messages 時系列、intent/confidence バッジ、検索/フィルタ
- WebSocket
  - /ws/llm: assistant_text→検証→diff までを段階的に表示
  - /ws/optimization: 再最適化の進捗/結果

### G. 監査/ログ/メトリクス
- audit_logs: { id, actor, action, meta_json, created_at }
  - action 例: "llm_intent", "llm_apply_draft", "constraints_validated", "constraints_applied", "optimization_run"
  - meta_json: tokens, cost, model, confidence, errors, version_id など
- 監査要件: 改竄防止のためハッシュ（prev_hash）を鎖状に保存
- メトリクス: 応答時間、成功率、再プロンプト率、JSON検証失敗率

### H. エラー/リカバリ
- 意図不明/低信頼: QAとして扱い、人向け確認と「適用案を生成」導線
- JSON不正: 再プロンプト（max2）、失敗時はユーザーに修正提案を表示（例: ここを数値に/キー名修正）
- LLM障害: QA停止、Applyは最後の確定条件で運用継続（既存UIで手動編集可能）

### I. テスト戦略
- 単体:
  - IntentRouter: 多様な発話のintent/confidence判定（モックLLM）
  - SchemaValidator: 正常/異常/境界値
  - DiffEngine: patch/ full の前後一致
  - LLMService: リトライ/タイムアウト/RateLimit
- 結合:
  - /messages apply→validate→diff→/apply のE2E
  - RBAC: Immediate制御の検証
- ユーザーテスト:
  - 代表シナリオ3件（週末min+1、連勤上限、重み調整）
  - エラーシナリオ（未知キー/範囲外/不正JSON）

### J. マイルストーン
- M1: Schema v1 + /validate + DiffPreview 雛形
- M2: Intent auto/手動 + QA応答
- M3: Apply生成 + 検証 + Draft適用フロー
- M4: OR-Tools起動連携 + 結果要約
- M5: 監査/コスト制御 + メトリクス

  - llm_sessions(id, title, created_by, created_at)
  - llm_messages(id, session_id, role, content, llm_model, tokens, cost, created_at)
  - constraint_versions(id, session_id, json, version, created_by, approved_by, applied_at, comment)
  - audit_logs(id, actor, action, meta_json, created_at)
- 保持期間: 1年（要相談）。PIIはemployee_id参照で匿名化可能

## 権限
- 管理者: 即時適用可、ロールバック可
- 一般: ドラフト作成のみ、承認は管理者

## 受入基準
- 自然言語による条件変更がチャット経由で行え、スキーマ検証を通過したJSONのみ適用されること
- 差分プレビューで変更点が可視化され、承認フローが機能すること
- 不正JSON・未知キー・範囲外値は適用拒否し、LLMに自動再プロンプトされること
- すべての適用操作が監査可能であること
- 代表シナリオ（週末人員+1、連勤上限変更、重み調整）がE2Eで成功すること

## 非機能/品質
- p95 応答 ≤ 10s、最適化起動までの追加遅延 ≤ 1s
- 1セッションあたり LLM コスト上限（例: ¥100）を設定可能
- 危険な操作（ハード制約削除）は二重確認とRBACで保護

## リスク/課題
- LLM出力ブレ: 温度/プロンプトチューニングと検証・再試行で吸収
- スキーマ拡張: 互換性確保のため versioned schema を採用
- プライバシー: PIIの外部送信ポリシーの確定が必要
- ベンダーロックイン: LLM抽象化層でプロバイダ切替対応

## オープン事項（要確認）
- 使用LLMプロバイダ/モデル（OpenAI/Azure/OpenRouter/社内LLM）、トークン上限/コストの目安
- PII方針（社員実名の送信可否、ID化/匿名化の範囲）
- 適用モードの既定値（ドラフト/即時）と承認者ロール定義
- JSON Patch 運用 or フルJSON 置換のどちらを標準にするか
- 保持期間・監査要件の規約
