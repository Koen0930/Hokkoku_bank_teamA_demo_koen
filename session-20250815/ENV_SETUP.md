# 仮想環境セットアップ（起動/環境変数/依存関係/ヘルスチェック）

最終更新: 2025-08-15

## 依存関係のインストール（VM/ローカル）
```
cd hokkoku_backend
python -m pip install -U pip
python -m pip install -e .
```

## 必要な環境変数（値は env.example を参照）
- OPENAI_API_KEY
- MOCK_OPENAI=false（Realモード検証）
- OPENAI_MODEL=gpt-4o-mini（推奨）
- CORS_ALLOW_ORIGINS=*

例（bash）
```
export OPENAI_API_KEY=...   # 値は設定済みの環境でのみ
export MOCK_OPENAI=false
export OPENAI_MODEL=gpt-4o-mini
export CORS_ALLOW_ORIGINS="*"
```

## 起動コマンド（Uvicorn）
```
cd hokkoku_backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
```

## 公開トンネル（Cloudflare quick tunnel）
```
sudo apt-get update
sudo apt-get install -y cloudflared
cloudflared tunnel --url http://localhost:8002
```
- 出力に表示される `https://<random>.trycloudflare.com` をブラウザで利用

## ヘルスチェック/確認用エンドポイント
- liveness: GET /healthz
- config: GET /api/config  → {"mode":"real"|"mock"}
- OpenAPI: /docs
- 簡易ブラウザUI: GET /（/static 配下にアセット）

## 確認手順（最小）
1) /api/config が {"mode":"real"} を返すこと
2) UIからセッション作成
3) QAで異なる質問に対し異なる応答となること
4) Applyで例「週末の最小人員を+1に」→ assistant_text + JSON Patch が返ること
5) /api/constraints/validate → OK
6) /api/constraints/apply（X-Role: admin）→ 成功
