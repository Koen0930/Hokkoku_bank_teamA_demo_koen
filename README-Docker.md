# Docker環境セットアップガイド

## 概要
このプロジェクトはDockerを使用してローカル開発環境を簡単にセットアップできます。

## 必要な環境
- Docker
- Docker Compose

## 開発環境の起動

### 1. Docker Composeを使用した一括起動
```bash
# プロジェクトルートディレクトリで実行
docker-compose up --build
```

### 2. 個別サービスの起動

#### バックエンドのみ起動
```bash
cd hokkoku_backend
docker build -t hokkoku-backend .
docker run -p 8000:8000 hokkoku-backend
```

#### フロントエンドのみ起動
```bash
cd hokkoku_frontend
docker build -t hokkoku-frontend .
docker run -p 3000:80 hokkoku-frontend
```

## アクセス方法
- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8000
- **API仕様書**: http://localhost:8000/docs

## 開発時の注意事項
- バックエンドのコードを変更した場合は、コンテナを再ビルドしてください
- フロントエンドの環境変数（.env）でAPIのURLを設定できます

## デプロイ済み環境
- **本番フロントエンド**: https://branch-deploy-app-ibuav6fr.devinapps.com
- **本番バックエンド**: https://app-vhnyeorm.fly.dev

## トラブルシューティング
- ポートが使用中の場合は、docker-compose.ymlのポート設定を変更してください
- コンテナが起動しない場合は、`docker-compose logs` でログを確認してください
