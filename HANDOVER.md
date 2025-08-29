# 引継ぎ資料（LLMインターフェース実装・検証環境）

最終更新: 2025-08-15

## ① セッションの概要

- 対象リポジトリ: PolarisAI-Projects/Hokkoku_bank_teamA_demo（ブランチ: devin/1755154712-llm-impl、PR #26）
- 目的:
  - LLMをインターフェースとして自然言語から最適化条件を変更できる機能の実装
  - モックではなく実OpenAI APIを用いた「Real」モードでの動作検証
  - ブラウザで動作確認できる検証環境の用意（ローカル起動＋公開トンネル）
  - /api/config で LLMモード（real/mock）を明示
  - DEPLOYING.md にトンネル手順を追記
- 実施内容（要点）:
  - OpenAIクライアント実装（Real/Mock切替、JSON抽出の堅牢化、意図判定/QA/適用案生成）
    - ファイル: hokkoku_backend/app/services/openai_client.py
  - APIルーター実装（LLMセッション、メッセージ、検証、適用、差分）
    - ルーター: hokkoku_backend/app/routers/llm.py、constraints.py
  - UI最小版をFastAPIから配信（/ に index.html、/static に asset）
    - ファイル: hokkoku_backend/app/static/index.html, app/static/app.js
  - /api/config の実装・ルーティング修正（StaticFilesのマウント順でAPIを先に通す）
    - ファイル: hokkoku_backend/app/main.py
  - Realモード検証（MOCK_OPENAI=false）をVM上で起動し、Cloudflare Tunnel で公開
    - 公開URL例: https://co-meanwhile-ghost-permits.trycloudflare.com
  - DEPLOYING.md に「トンネルによるRealモード検証」の手順を追記
    - ファイル: DEPLOYING.md

- 検証結果（実URLでの確認済みフロー）:
  - /api/config → {"mode":"real"}
  - QA（異なる質問で異なる応答）:
    - 「このツールは何をしますか？」→ コールセンターのシフト最適化に関する説明
    - 「最適化の対象は何ですか？」→ スケジュール/配置/応答時間/CSなどの説明
  - 適用案（apply）:
    - 入力: 「週末の最小人員を+1に」
    - 出力: assistant_text + JSON Patch（例: [{"op":"replace","path":"/min_staff_weekend","value":2}]）
    - /api/constraints/validate → OK
    - /api/constraints/apply（X-Role: admin）→ 適用成功

- 成果物（主な変更ファイル）:
  - hokkoku_backend/app/services/openai_client.py（実LLM統合）
  - hokkoku_backend/app/routers/llm.py, constraints.py（API）
  - hokkoku_backend/app/main.py（CORS・/api/config・UI/Static配信）
  - hokkoku_backend/app/static/index.html, app/static/app.js（検証用UI）
  - DEPLOYING.md（Realモード×トンネル手順）

- 参考起動コマンド（VM内でのRealモード）:
  - 環境: OPENAI_API_KEY が設定済み
  - 起動:
    - export MOCK_OPENAI=false
    - export OPENAI_MODEL=gpt-4o-mini
    - uvicorn app.main:app --host 0.0.0.0 --port 8002
  - 公開トンネル:
    - cloudflared tunnel --url http://localhost:8002
  - 以降、https://<ランダム>.trycloudflare.com でブラウザ確認

## ② 採用したもの / 却下したもの と理由

### 採用

- Real LLM モード（OpenAI API 直接呼び出し）
  - 理由: 実運用を想定した応答の多様性・品質確認が必要。ユーザー要望がRealのみ優先。
- Cloudflare Tunnel による一時公開
  - 理由: 迅速にブラウザ検証可能で、鍵はVM環境変数にのみ保持。アカウント不要・即時性が高い。
- /api/config によるモード可視化（"mock"/"real"）
  - 理由: 検証や問い合わせ時に現在モードを即確認できるため。UIにも表示。
- 適用（apply）とQ&A（qa）のデュアルモード
  - 理由: ユーザーが「説明/回答」と「適用案」を明確に使い分けられる。将来の自動判定にも対応。
- JSON出力の堅牢化（Patch優先＋Fullのフォールバック、ゆるいJSON抽出）
  - 理由: LLM出力のばらつきに耐性を持たせるため。
- 差分と検証（validate）→ 承認→適用（apply）の安全フロー
  - 理由: いきなり適用せず、プレビュー→検証→承認の手順で安全性を確保。
- 最小ブラウザUI（/ 配信、/static 配下にアセット）
  - 理由: APIのみだと確認しづらい。UIで一連の流れをテスト可能。

### 却下/保留

- Mock 環境の別URL公開
  - 理由: ユーザー要望でRealのみ。混乱回避のためMock公開は不要。
- Fly.io への本番相当デプロイ
  - 理由: 認証・権限の事情でブロック。短期検証はトンネルで十分。将来はRender/Railway等に移行可能。
- 公開UI上でのキー入力フォーム
  - 理由: セキュリティ上不要・不適切。APIキーはサーバ環境変数でのみ保持。
- 複雑なフロント統合（Next.js/React大規模UI）
  - 理由: 本タスクの主眼はLLM機能の実装と検証。最小UIで要件達成済み。

## 補足（今後の推奨）

- 安定URLが必要であれば Render/Railway 等のマネージド環境へ移行
  - OPENAI_API_KEY をSecretsで管理し、Realモードを常時提供可能
- 自動intent判定の高度化（function calling / tool use、confidenceしきい値）
- スキーマの強化（JSON Schema + 失敗時の再プロンプト方針）
- 監査ログの永続化（会話、差分、承認者、適用結果、コスト）
- UIの拡張（差分プレビューの視覚化、履歴比較、ロール管理）
