# TODO（次ステップ、Issue化推奨・小粒度）

- LLM出力JSONの厳格化
  - JSON Schema（Patch/Full）を導入し、失敗時の再プロンプト方針を実装
- Intent自動判定の強化
  - function calling / tool use による intent + confidence 安定化
- 監査ログの永続化
  - 会話・差分・承認者・適用結果・コストをSQLite/外部DBに保存
- UI: 差分プレビューの視覚化
  - Before/Afterの視覚的比較、変更ハイライト、ロールバック案内
- 環境の常設化
  - Render/Railway 等へ移行し安定URL提供、Secretsはプラットフォームで管理
- メトリクス/アラート
  - 応答時間、失敗率、OpenAI使用量、費用の可視化と閾値アラート
- RBACの強化
  - 即時適用の権限制御、APIキー/トークン認可、監査用ヘッダ整理
- エラーハンドリング/UX
  - 代表的な失敗ケースに対するユーザ向けガイダンス文言・再試行UI
