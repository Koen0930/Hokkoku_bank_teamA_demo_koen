# セッション概要（LLMインターフェース実装・検証環境）

最終更新: 2025-08-15

## 目的
- LLMをインターフェースとして自然言語から最適化条件を変更可能にする機能の実装
- 実OpenAI API（Realモード）でのエンドツーエンド検証
- ブラウザからの即時確認ができる検証環境（ローカル起動＋公開トンネル）
- /api/config で LLMモード（real/mock）の可視化
- DEPLOYING.md にトンネル手順を追記

## 実装範囲と成果
- OpenAI連携（Real/Mock切替、JSON抽出の堅牢化、QA/適用案/意図判定）
  - <ref_file file="/home/ubuntu/repos/Hokkoku_bank_teamA_demo/hokkoku_backend/app/services/openai_client.py" />
- API一式（セッション、メッセージ、検証、適用、差分）
  - <ref_file file="/home/ubuntu/repos/Hokkoku_bank_teamA_demo/hokkoku_backend/app/routers/llm.py" />
  - <ref_file file="/home/ubuntu/repos/Hokkoku_bank_teamA_demo/hokkoku_backend/app/routers/constraints.py" />
- UI最小版配信（/ に index.html、/static に asset）
  - <ref_file file="/home/ubuntu/repos/Hokkoku_bank_teamA_demo/hokkoku_backend/app/static/index.html" />
  - <ref_file file="/home/ubuntu/repos/Hokkoku_bank_teamA_demo/hokkoku_backend/app/static/app.js" />
- ルーティング調整と /api/config 実装
  - <ref_file file="/home/ubuntu/repos/Hokkoku_bank_teamA_demo/hokkoku_backend/app/main.py" />
- トンネル手順のドキュメント化
  - <ref_file file="/home/ubuntu/repos/Hokkoku_bank_teamA_demo/DEPLOYING.md" />

## 検証環境（リアルのみ）
- 公開URL（例）: https://co-meanwhile-ghost-permits.trycloudflare.com
- /api/config: {"mode":"real"} を返却
- 検証フロー（ブラウザUI）:
  1) 「新規作成」でセッション生成
  2) Q&Aモードで質問 → 文脈に応じた可変応答（固定文言ではない）
  3) 適用案モードで例「週末の最小人員を+1に」
     - assistant_text + JSON Patch（例: [{"op":"replace","path":"/min_staff_weekend","value":2}]）
  4) 「検証」→ OK
  5) 「適用(管理者)」→ 成功（X-Role: admin）

## 現状のリスク/留意点
- LLM出力のばらつき: JSON抽出は汎用正規表現で回復を試みるが、エッジケースでは再プロンプトが必要になりうる
- トンネルURLは一時的: 恒久URLが必要な場合はRender/Railway等のマネージド環境へ移行推奨
- UIは検証用の最小構成: 視覚的な差分表示・履歴比較などは今後の拡張で対応

## 次の推奨ステップ
- マネージド環境への常設デプロイ（安定URL・Secrets管理）
- JSON Schemaの強化・再プロンプト方針の明文化
- 監査ログの永続化（会話、差分、承認者、適用結果、コスト）
- UI拡張（差分プレビューの視覚化、履歴比較、ロール管理）
