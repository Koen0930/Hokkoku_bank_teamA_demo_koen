# 技術アーキテクチャ (Technical Architecture)

## 概要
本ドキュメントでは、AIシフト作成ツールの技術アーキテクチャを定義します。

## システム構成図

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Optimization  │
│   (Vercel)      │    │   (Render/      │    │   Engine        │
│                 │    │    Railway)     │    │                 │
│ React 19        │◄──►│ FastAPI         │◄──►│ OR-Tools        │
│ Next.js 15      │    │ Python 3.11+    │    │ CP-SAT          │
│ TypeScript      │    │ PostgreSQL      │    │                 │
│ Tailwind CSS    │    │ Redis           │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## フロントエンド技術スタック

### 基盤技術
| 技術 | バージョン | 用途 |
|------|------------|------|
| React | 19.x | UIライブラリ |
| Next.js | 15.x | フルスタックフレームワーク |
| TypeScript | 5.x | 型安全性 |
| Tailwind CSS | 3.x | スタイリング |

### 状態管理・データフェッチ
| 技術 | 用途 |
|------|------|
| Zustand | グローバル状態管理 |
| TanStack Query | サーバー状態管理 |
| React Hook Form | フォーム管理 |

### UI コンポーネント
| 技術 | 用途 |
|------|------|
| Radix UI | プリミティブコンポーネント |
| React DnD | ドラッグ&ドロップ |
| React Table | テーブル表示 |
| Recharts | グラフ・チャート |

### 開発・ビルドツール
| 技術 | 用途 |
|------|------|
| Vite | 開発サーバー・ビルド |
| ESLint | 静的解析 |
| Prettier | コードフォーマット |
| Vitest | テストフレームワーク |

## バックエンド技術スタック

### 基盤技術
| 技術 | バージョン | 用途 |
|------|------------|------|
| Python | 3.11+ | プログラミング言語 |
| FastAPI | 0.104+ | WebAPIフレームワーク |
| Pydantic | 2.x | データバリデーション |
| SQLAlchemy | 2.x | ORM |

### データベース・キャッシュ
| 技術 | 用途 |
|------|------|
| PostgreSQL | メインデータベース |
| Redis | キャッシュ・セッション管理 |
| Alembic | データベースマイグレーション |

### 最適化エンジン
| 技術 | 用途 |
|------|------|
| OR-Tools | 制約プログラミング |
| CP-SAT | 制約満足問題ソルバー |
| NumPy | 数値計算 |
| Pandas | データ処理 |

### 開発・テストツール
| 技術 | 用途 |
|------|------|
| Poetry | 依存関係管理 |
| Black | コードフォーマット |
| Ruff | 高速リンター |
| Pytest | テストフレームワーク |

## クラウドアーキテクチャ

### デプロイメント構成

#### フロントエンド (Vercel)
```yaml
Platform: Vercel
Features:
  - 自動デプロイ (Git連携)
  - CDN配信
  - プレビューデプロイ
  - 環境変数管理
  - カスタムドメイン
```

#### バックエンド (Render/Railway)
```yaml
Platform: Render または Railway
Features:
  - 自動デプロイ
  - 環境変数管理
  - ヘルスチェック
  - 自動スケーリング
  - ログ管理
```

### データベース構成
```yaml
Primary Database:
  - PostgreSQL (Render/Railway Managed)
  - 自動バックアップ
  - 接続プーリング

Cache Layer:
  - Redis (Render/Railway Managed)
  - セッション管理
  - 計算結果キャッシュ
```

## API設計

### RESTful API エンドポイント

#### 認証・ユーザー管理
```
POST   /api/auth/login          # ログイン
POST   /api/auth/logout         # ログアウト
GET    /api/auth/me             # ユーザー情報取得
```

#### 従業員管理
```
GET    /api/employees           # 従業員一覧取得
POST   /api/employees           # 従業員登録
PUT    /api/employees/{id}      # 従業員更新
DELETE /api/employees/{id}      # 従業員削除
POST   /api/employees/import    # CSV一括取込
```

#### シフト管理
```
GET    /api/shifts              # シフト一覧取得
POST   /api/shifts/generate     # シフト自動生成
PUT    /api/shifts/{id}         # シフト更新
DELETE /api/shifts/{id}         # シフト削除
POST   /api/shifts/export       # シフトエクスポート
```

#### 制約管理
```
GET    /api/constraints         # 制約一覧取得
POST   /api/constraints         # 制約登録
PUT    /api/constraints/{id}    # 制約更新
DELETE /api/constraints/{id}    # 制約削除
```

### WebSocket API
```
/ws/shifts                      # リアルタイム更新通知
/ws/optimization               # 最適化進捗通知
```

## データベース設計

### 主要テーブル構成

#### employees (従業員)
```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50),
    skill_level INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### shifts (シフト)
```sql
CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### constraints (制約)
```sql
CREATE TABLE constraints (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    constraint_type VARCHAR(50) NOT NULL,
    constraint_value JSONB,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## セキュリティアーキテクチャ

### 認証・認可
```yaml
Authentication:
  - JWT Token (Access Token: 15分, Refresh Token: 7日)
  - OAuth 2.0 / OpenID Connect
  - Multi-Factor Authentication (将来対応)

Authorization:
  - Role-Based Access Control (RBAC)
  - Resource-Based Permissions
  - API Rate Limiting
```

### データ保護
```yaml
Encryption:
  - At Rest: AES-256 (Database)
  - In Transit: TLS 1.3 (HTTPS)
  - Application: bcrypt (Password Hashing)

Privacy:
  - Personal Data Anonymization
  - GDPR Compliance
  - Data Retention Policies
```

## 監視・ログ

### アプリケーション監視
```yaml
Metrics:
  - Response Time
  - Error Rate
  - Throughput
  - Resource Usage

Logging:
  - Structured Logging (JSON)
  - Log Levels (DEBUG, INFO, WARN, ERROR)
  - Request/Response Logging
  - Audit Logging
```

### インフラ監視
```yaml
Infrastructure:
  - Server Health
  - Database Performance
  - Network Latency
  - Storage Usage

Alerting:
  - Email Notifications
  - Slack Integration
  - PagerDuty (将来対応)
```

## 開発・デプロイメント

### CI/CD パイプライン
```yaml
Development Workflow:
  1. Feature Branch作成
  2. 開発・テスト
  3. Pull Request作成
  4. Code Review
  5. 自動テスト実行
  6. マージ・デプロイ

Deployment Stages:
  - Development (自動デプロイ)
  - Staging (自動デプロイ)
  - Production (手動承認後デプロイ)
```

### 品質管理
```yaml
Code Quality:
  - Unit Tests (80%+ Coverage)
  - Integration Tests
  - E2E Tests
  - Static Code Analysis
  - Security Scanning
```

## パフォーマンス最適化

### フロントエンド最適化
```yaml
Optimization:
  - Code Splitting
  - Lazy Loading
  - Image Optimization
  - Bundle Size Optimization
  - Caching Strategy
```

### バックエンド最適化
```yaml
Optimization:
  - Database Indexing
  - Query Optimization
  - Connection Pooling
  - Caching (Redis)
  - Async Processing
```

## 災害復旧・事業継続

### バックアップ戦略
```yaml
Backup:
  - Database: Daily Automated Backup
  - Files: Cloud Storage Replication
  - Configuration: Version Control
  - Recovery Time Objective: 2 hours
  - Recovery Point Objective: 24 hours
```

### 冗長化
```yaml
Redundancy:
  - Multi-Region Deployment (将来対応)
  - Database Replication
  - Load Balancing
  - Failover Mechanism
```
