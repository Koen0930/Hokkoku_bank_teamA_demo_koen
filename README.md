# 北國銀行コールセンター向け AIシフト作成ツール

北國銀行のコールセンター向けAIシフト作成ツール（Optamo風）のMVPデモプロジェクトです。

## プロジェクト概要

### 🎯 目的
コールセンターのシフト作成業務を自動化し、管理者の負担軽減と最適なシフト配置を実現するAIツールの開発

### 📊 対象規模
- **従業員数**: 10名（管理職4名、スタッフ6名）
- **対象期間**: 1週間（7日間）
- **営業時間**: 24時間運用（1時間単位のスロット）

### ⚡ 主要機能
- **CSV取込**: 従業員マスタ・勤務制約のアップロード
- **AI自動生成**: OR-Tools CP-SATによる最適シフト生成
- **リアルタイム警告**: 制約違反の即座検知・表示
- **ドラッグ&ドロップ編集**: 直感的なシフト調整
- **エクスポート**: CSV/PDF形式での出力

### 🛠️ 技術スタック
- フロントエンド: React 18 + Vite + TypeScript
- バックエンド: FastAPI + Python 3.12
- 最適化エンジン: OR-Tools CP-SAT
### 🚀 Deployment
- See DEPLOYMENT.md for deploying Backend, Linebot, and Frontend to public URLs.

- データベース: SQLite（将来的に PostgreSQL 拡張可）
- デプロイ: 静的ホスティング(Frontend) + Render/Railway (Backend)
## 🏁 クイックスタート（Docker 推奨）

1. リポジトリ取得・最新化
   - git fetch origin && git checkout main && git pull
2. 環境変数ファイルの作成
   - cp .env.example .env
   - 必要に応じて各キーを設定（OPENAI_API_KEY または MOCK_OPENAI=true、GEMINI_API_KEY、LINE_CHANNEL_SECRET/LINE_CHANNEL_ACCESS_TOKEN、VITE_API_URL など）
3. ビルドと起動
   - docker compose build
   - docker compose up -d
4. 動作確認
   - フロントエンド: http://localhost:3000
   - バックエンド: http://localhost:8000/docs
   - LINE Bot: http://localhost:8082/docs
5. ログ/停止
   - docker compose logs -f
   - docker compose down



### 📈 期待効果
- シフト作成時間を **50%以上削減**
- 制約違反を **80%削減**
- 運用コストの最適化とROI **97%**達成

## 📋 ドキュメント構成

詳細な要件定義は [`requirements/`](./requirements/) ディレクトリに整理されています：

- [📖 要件定義書メイン](./requirements/README.md) - 全体概要とドキュメント構成
- [⚙️ 機能要件](./requirements/01_functional_requirements.md) - F-01〜F-08の機能仕様
- [🚀 非機能要件](./requirements/02_non_functional_requirements.md) - 性能・品質・セキュリティ要件
- [🏗️ 技術アーキテクチャ](./requirements/03_technical_architecture.md) - システム設計・技術選定
- [🎨 UI/UX仕様](./requirements/04_ui_ux_specifications.md) - Optamo風デザイン仕様
- [📅 プロジェクト管理](./requirements/05_project_management.md) - 4週間開発計画・リスク管理
- [💼 ビジネス要件](./requirements/06_business_requirements.md) - 事業目標・ROI・KPI
- [👥 開発チーム役割分担](./requirements/07_development_team_roles.md) - UI/バックエンド開発体制

## 🚀 開発スケジュール

| フェーズ | 期間 | 主要タスク |
|----------|------|------------|
| **Week 1** | 基盤構築 | プロジェクト初期化・DB設計・基本API |
| **Week 2** | コア機能 | OR-Tools統合・シフト生成ロジック |
| **Week 3** | UI実装 | React コンポーネント・ドラッグ&ドロップ |
| **Week 4** | 統合・テスト | 結合テスト・デプロイ・最終調整 |

**総開発工数**: 18人日（約4週間）

## 🎯 MVP成功基準

- [ ] 10名分の1週間シフトを10秒以内で生成
- [ ] 制約違反のリアルタイム検知・警告表示
- [ ] 直感的なドラッグ&ドロップ編集機能
- [ ] CSV形式での入出力対応
- [ ] 99%以上の稼働率達成

## 従業員データの投入（サンプルCSV）
- サンプルCSV:
  - docs/samples/employees_sample.csv（列: id, name, email, role, skill_level）
  - 既存の sample_employees.csv も参考として利用可能
- 画面からの投入:
  - 「従業員取り込み」画面でCSVを選択してアップロード
- APIでの投入:
  - POST /api/employees/import（multipart/form-data, key: file）
- 注意事項:
  - 文字コード: UTF-8
  - ヘッダ行は必須（id, name, email, role, skill_level）
  - role は自由入力（例: manager, senior_staff, staff など）

## English Description

This is an AI-powered shift scheduling tool demonstration project for Hokkoku Bank's call center operations. The system uses OR-Tools CP-SAT optimization engine to automatically generate optimal shift schedules while considering various constraints and employee preferences.

**Key Features**: CSV import, AI-powered shift generation, real-time constraint violation warnings, drag-and-drop editing, and multi-format export capabilities.

**Tech Stack**: React 18 + Vite frontend, FastAPI backend, OR-Tools optimization, deployed on static hosting + Render/Railway.
