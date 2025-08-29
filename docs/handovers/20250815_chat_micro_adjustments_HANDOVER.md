# 引継ぎ資料: チャットによる相性ルール微調整（再最適化なし）

作成日: 2025-08-15
作成者: Devin AI
依頼者: yohei.sakamoto / GitHub: @sakamoto0308
Link to Devin run: https://app.devin.ai/sessions/4da160c59967429dacbab8e2eb4d7793

## 1. 目的・背景
- 目的: 最適化済みのシフト結果に対して、チャット入力で「従業員AさんとBさんは同時に入れない」等の相性ルールを適用し、再最適化を回さずに微調整（最小変更）を行い、UIへ即時反映する機能の要件定義を作成。
- 背景: 相性/同席禁止は現場で頻出。リアルタイム性重視のため、完全再最適化ではなく、局所的な修正で対応。

## 2. 現状サマリ（成果）
- 新規ドキュメントを追加済み（developにマージ済み）
  - 仕様ファイル: requirements/features/chat_micro_adjustments/functional_requirements.md
  - PR: #29 docs(feature): チャット微調整（相性）機能要件を追加（左=チャット/右=シフト、再最適化なし） [Merged]
  - CI: 通過
  - PR説明: 日本語サマリ、Devin runリンク、依頼者情報を記載済み
- 要件の要点
  - レイアウト: 左=LINE風チャット、右=週次グリッド（差分ハイライト/承認バー/元に戻す）
  - スコープ: pair_not_together（同時不可）をMVP対象。再最適化は行わない
  - 微調整アルゴリズム: 代替者置換 → 近接スワップ → 近接スライド。ハード制約遵守、最小変更をスコアリング
  - API/WS: /api/chat/parse, /api/adjustments/preview, /api/adjustments/apply, /api/adjustments/rollback, /ws/adjustments
  - データモデル: Rule, Proposal, ChangeDelta, ChangeSet, Schedule, Slot, Employee, AuditLog, Session
  - 受入基準（抜粋）: 2秒以内提案表示、適用後500ms以内反映、ロールバック可、監査保存

## 3. 未対応事項・課題
- 実装は未着手（要件定義のみ）
- バックエンド
  - 仕様に沿ったルール正規化・提案生成の実装（validation/候補探索/スコアリング）
  - WebSocket チャネル設計/通知の具体化
  - 監査ログスキーマ/保存箇所拡張
- フロントエンド
  - チャットUI（メッセージタイムライン/曖昧解消のQ&A/クイックリプライ）
  - グリッドの差分ハイライト/承認バー/元に戻す
  - WebSocket受信でのリアルタイム反映、バージョン競合処理
- RBAC/権限境界の反映（viewer/editor/admin）

## 4. 推奨・次の一歩（具体タスク）
1) ダミーAPIでUXモック
   - /api/chat/parse, /api/adjustments/preview をモック化し、UIからのエンドツーエンドフローを確認
2) FE: 左右2ペインのワイヤーと状態機械
   - 状態: idle → parsing → generating_proposals → previewing → applied
   - 差分ハイライト/承認バー/元に戻す
3) BE: ルール正規化 + 提案生成（MVP）
   - pair_not_togetherのみ対応、代替者置換を最初に実装
4) WS: schedule.updated push
   - 適用時にUIへ即時反映
5) 監査ログ/メトリクス
   - 入力自然文・正規化ルール・提案決定・差分・所要時間を記録
6) 受入テスト
   - 仕様のACに沿ってE2E確認

## 5. 意思決定/方針
- 再最適化は行わない（局所的微調整に限定）
- MVPルールは pair_not_together のみ（将来拡張余地あり）
- ハード制約は常に遵守（違反する提案は提示しない）

## 6. 参考情報・リンク
- 仕様ドキュメント: requirements/features/chat_micro_adjustments/functional_requirements.md
- 既存リポジトリ README/要件群: requirements/*.md
- 参考PR: #29（マージ済み）
- 公開URL（現UI確認用・参考）: 既存のデプロイ先（Vercel/Render/Railway）に準拠

## 7. リスクと対応
- 候補不足で解消不能: 理由提示と代替アクションの提示（手動割当指示）
- 名前の曖昧性: 名寄せ辞書/曖昧一致の確認質問
- バージョン競合: scheduleVersionで検出し、再プレビュー誘導

## 8. チェックリスト（次担当向け）
- [ ] UIワイヤー（2ペイン+承認バー+差分ハイライト）
- [ ] /api/chat/parse 実装（名寄せ・曖昧解消）
- [ ] /api/adjustments/preview 実装（代替者置換→スワップ→スライドの順）
- [ ] /api/adjustments/apply, /api/adjustments/rollback 実装
- [ ] /ws/adjustments 実装（proposals_ready, schedule.updated）
- [ ] 監査ログ/メトリクス/エラーハンドリング

以上、次セッションでの実装作業に必要な要点を集約しています。
