# 機能要件: チャットによる相性ルールの微調整とUI即時反映（再最適化なし）

## 概要
- 左ペイン: LINE風チャット
- 右ペイン: 週次シフト結果グリッド
- 方針: 「AさんとBさんは一緒に入れない」等の相性ルールをチャットで受け取り、最適化を再計算せず既存結果へ局所的な微修正を適用し、UIへ即時反映する

## ユースケース
- 相性ルール追加: 「AさんとBさんは今週同席不可」→ 微修正案提示 → 承認 → 反映
- 日付/曜日/時間帯限定の適用: 「金土の夜勤は同席NG」
- 解消不能時の説明: 候補不足や法令・連勤等の制約により解消できない理由を提示
- ロールバック: 直前の変更セットを元に戻す

## 画面レイアウト
- 2ペイン横並び
  - 左: チャット（幅32%、min 320px、max 520px、リサイズ可）
  - 右: 既存の週次グリッド（差分ハイライト・承認バー追加）
- レスポンシブ: 幅<1024pxで上下2段（上=チャット、下=グリッド）

## チャットUX
- タイムライン: ユーザー右/システム左の吹き出し、アバター/時刻
- 入力欄: テキスト、送信、Enter送信、候補チップ（今週/来週/午後/この週だけ）
- クイックリプライ: はい/いいえ/変更する
- 例文:
  - 「AさんとBさんは今週一緒に入れないで」
  - 「田中と佐藤は金土の夜勤は同席NG」
  - 「中村さんと木村さん、8/15 8-16は別シフトで」
- 曖昧解消:
  - 名寄せ質問（同名/別名）
  - 期間語の確定（今週=右ペイン表示週、来週=+7日）
  - 時間語の確定（午後=13:00-18:00、夜勤=22:00-翌6:00）

## 意図正規化（Rule）
- Rule:
  - id: string
  - type: "pair_not_together"
  - employees: [employeeIdA, employeeIdB]
  - scope: { dates?: [YYYY-MM-DD], weekdays?: [Mon..Sun], timeRanges?: [{start:"HH:mm", end:"HH:mm"}], weekOf?: "shown_week"|"next_week" }
  - priority: "hard"
  - enabled: true
  - expiresAt?: ISO8601
- 名寄せ:
  - エイリアス辞書とあいまい一致（閾値0.8以上で自動、未満は候補提示）

## 微修正アルゴリズム（再最適化なし）
- 入力: 現在のSchedule、Rule
- 違反検出: scope内の各SlotでA,B同席セルを列挙
- 修正候補の探索と優先順:
  1) 代替者Cへの置換
     - 稼働可（休暇/上限/連勤/休憩等に抵触しない）
     - スキル/役職要件を満たす
     - 新たなpair_not_together違反を誘発しない
  2) 同日近接スロットでの1手/2手スワップ（A↔C, B↔D）
  3) 近接時間帯へのスライド（AまたはBの移動、充足維持可能時のみ）
- スコアリング（小さいほど良い）:
  - 変更セル数、時間移動距離、スキルダウングレード、代替不足ペナルティ
- 出力（最大3案）:
  - proposal = { proposalId, deltas: ChangeDelta[], metrics: { changes, resolved, residual, warnings[] } }
  - ChangeDelta = { slotId, from:{employeeId?}, to:{employeeId?}, reason:"pair_not_together" }
- ポリシー:
  - ハード制約（稼働可否/連勤/休憩/人員/役職/法令）は常に遵守
  - 解消不能時は案を出さず、理由を提示

## 右ペイン（グリッド拡張）
- 差分プレビュー: Before/After同一グリッド表示、変更セルハイライト、Tooltip（Before→After/理由/ルール）
- 承認バー: [適用] [取消] [他の案]、直前変更の[元に戻す]
- フィルタ/フォーカス: 対象従業員/日/時間帯で絞り込み、「影響箇所へジャンプ」

## 状態機械
- idle → parsing → need_clarification? → generating_proposals → previewing(proposalId) → applied | aborted

## API/WS
- REST
  - POST /api/chat/parse
    - in: { text, context:{ shownWeekStart, tz }, sessionId }
    - out: { rules: Rule[], confirmations?: Question[] }
  - POST /api/rules/transient
    - in: { rule: Rule, sessionId }
    - out: { ruleId }
  - POST /api/adjustments/preview
    - in: { ruleId?: string, rule?: Rule, currentScheduleId: string, options?: { maxCandidates?: number } }
    - out: { proposals: Proposal[], validation: { ok: boolean, violations: Violation[] } }
  - POST /api/adjustments/apply
    - in: { proposalId, approver }
    - out: { changeSetId, appliedAt, scheduleVersion }
  - POST /api/adjustments/rollback
    - in: { changeSetId }
    - out: { rolledBack: true, scheduleVersion }
- WebSocket /ws/adjustments
  - chat.rule_parsed { sessionId, rules }
  - adjustments.proposals_ready { sessionId, proposals }
  - adjustments.preview_selected { sessionId, proposalId }
  - schedule.updated { sessionId, changeSetId, deltas, scheduleVersion }
  - error { code, message, details? }
- エラーコード例:
  - E_ALIAS_AMBIGUOUS, E_EMPLOYEE_NOT_FOUND, E_SCOPE_EMPTY, E_NO_CANDIDATE, E_HARD_CONSTRAINT_BLOCKED, E_VERSION_CONFLICT

## データモデル
- Employee { id, name, aliases[], role, skills[], availability[] }
- Slot { id, date, start, end, required:{ staff:number, manager?:number }, assigned:[employeeId], meta }
- Schedule { id, weekStart, slots[], version:number }
- Rule { id, type:"pair_not_together", employees:[id,id], scope{}, priority:"hard", enabled:boolean, expiresAt? }
- Proposal { id, deltas:ChangeDelta[], metrics{ changes,resolved,residual,warnings[] } }
- ChangeDelta { slotId, from{employeeId?}, to{employeeId?}, reason }
- ChangeSet { id, proposalId, deltas[], appliedBy, appliedAt, revertedAt? }
- AuditLog { id, actor, action, targetType, targetId, payload, ts }
- Session { id, userId, tz, locale, shownWeekStart }

## バリデーション/曖昧解消
- 名寄せ: 別名辞書＋あいまい一致（>=0.8）
- 期間: 今週=右ペイン表示週（週起点は設定）
- 時間帯: 自然語→辞書（午後/夜勤等）
- ハード制約: 常時チェック。違反案は除外
- 解消不能: 不足スキル/全員休暇/上限超過など理由提示

## 権限/監査
- viewer: プレビューのみ
- editor: ルール作成/プレビュー/適用
- admin: 上記+ロールバック/監査閲覧
- 監査: 自然文、正規化ルール、提案、適用差分、適用者、所要時間、IP/UA、結果

## 非機能・性能
- parse ≤ 300ms、preview ≤ 2s（10名×1週×1h）、apply→UI反映 ≤ 500ms（WS）
- 可観測性: 提案生成時間/候補数/解消率/失敗率
- 冪等性: RESTは冪等、applyは一回性（ChangeSet重複防止トークン）
- i18n: ja-JP（英語拡張可）、A11y: キーボード操作/ARIA/高コントラスト

## 受入基準
- 「AさんとBさんは今週一緒に入れないで」で2秒以内に提案表示、右ペイン差分ハイライト
- 適用後500ms以内にA/B同席が解消される
- 提案不可時は理由が明示される
- [元に戻す]で直前ChangeSetが復元される
- 監査ログが保存される

## サンプルI/O
- POST /api/chat/parse (in)
  { "text":"AさんとBさんは今週一緒に入れないで", "context":{"shownWeekStart":"2025-08-11","tz":"Asia/Tokyo"}, "sessionId":"sess_001" }
- /api/chat/parse (out)
  { "rules":[{ "id":"tmp_1","type":"pair_not_together","employees":["emp_A","emp_B"],"scope":{"weekOf":"shown_week"},"priority":"hard","enabled":true }] }
- /api/adjustments/preview (out 抜粋)
  {
    "proposals":[
      { "proposalId":"p1",
        "deltas":[{"slotId":"2025-08-15T08:00/16:00","from":{"employeeId":"emp_A"},"to":{"employeeId":"emp_C"},"reason":"pair_not_together"}],
        "metrics":{"changes":1,"resolved":2,"residual":0,"warnings":[]}
      }
    ],
    "validation":{"ok":true,"violations":[]}
  }
