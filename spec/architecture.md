# アーキテクチャ

`src` 配下を **frontend** と **server** の2つに分割する。両者は互いに直接importせず、HTTP(API)経由でのみ通信する。

## 全体構成

```
src/
├── frontend/   # クライアント (React)
└── server/     # サーバー (クリーンアーキテクチャ)
```

---

## frontend

```
src/frontend/
├── assets/         # 画像、フォント、グローバルCSSなどの静的アセット
├── components/     # アプリ全体で使い回す共通UIコンポーネント（ボタン、モーダル等）
│   ├── elements/   # 基本的なUI要素
│   └── layouts/    # ヘッダー、フッター、サイドバーなどのレイアウト
├── features/       # ドメイン（機能）ごとのまとまり（認証、記事、ダッシュボード等）
│   └── exampleFeature/
│       ├── api/        # この機能専用のAPI通信ロジック
│       ├── components/ # この機能専用のUIコンポーネント
│       ├── hooks/      # この機能専用のカスタムフック
│       └── types/      # この機能専用の型定義
├── hooks/          # アプリ全体で共有するカスタムフック（useWindowSize等）
├── lib/            # サードパーティライブラリの設定（Axios設定、Firebase初期化等）
├── pages/          # ルーティングの各ページのエントリーポイント
├── routes/         # ルーティング定義（react-routerのパス設定）
├── store/          # グローバルな状態管理（ZustandやReduxの設定）
├── types/          # アプリ全体で共有するTypeScriptの型定義
└── utils/          # 純粋なヘルパー関数（日付フォーマット、計算ロジック等）
```

### frontendのルール

- `features/` 同士は直接importしない。共通化が必要なものは `components/` `hooks/` `utils/` へ移す。
- `pages/` は `features/` を組み合わせるだけにし、ロジックは持たない。
- サーバーとの通信は各 `features/*/api/` に閉じ込める。

---

## server

クリーンアーキテクチャに基づく4層構成。

```
src/server/
├── handler/      # 【外側】HTTPの入出力
├── service/      # 【内側】ビジネスロジック（ユースケース）
├── repository/   # 【外側】永続化（DB）へのアクセス
├── adapter/      # 【外側】外部サービスとの連携
├── domain/       # 【最内】エンティティ・ビジネスルール・インターフェース定義
├── config/       # 環境変数・設定
└── main.ts       # エントリーポイント（依存の組み立て = DI）
```

### 各層の責務

| 層 | 責務 | やること | やらないこと |
|---|---|---|---|
| `handler/` | HTTPリクエスト/レスポンスの境界 | ルーティング、リクエストのパース・バリデーション、serviceの呼び出し、レスポンス整形、エラーのHTTPステータス変換 | ビジネスロジック、DB操作、外部API呼び出し |
| `service/` | アプリケーションのビジネスロジック | ユースケースの実行、ドメインルールの適用、トランザクション制御、repository/adapterの呼び出し | HTTPの知識（req/res、ステータスコード）、SQLや外部APIの具体的な実装 |
| `repository/` | 永続化データへのアクセス | DBのCRUD、クエリ構築、DBレコード ⇔ ドメインエンティティの変換 | ビジネスロジック、外部API呼び出し |
| `adapter/` | 外部サービスとの連携 | 外部API・メール・決済・ストレージ等の呼び出し、外部のデータ形式 ⇔ ドメインの型の変換 | ビジネスロジック、DB操作 |
| `domain/` | 中核となる業務概念 | エンティティ、値オブジェクト、repository/adapterのインターフェース、ドメインエラー | 他の層・フレームワーク・ライブラリへの依存 |

> `domain/` は4層の外側の補助ディレクトリ。クリーンアーキテクチャの「依存性逆転」を成立させるため、インターフェースとエンティティの置き場として設ける。

### 依存の方向

依存は **外側 → 内側** の一方向のみ。内側は外側を知らない。

```
handler ──▶ service ──▶ domain ◀── repository
                          ▲
                          └─────── adapter
```

- `handler` は `service` に依存する。
- `service` は `domain` に定義されたインターフェース（`XxxRepository`, `XxxGateway` 等）にのみ依存し、`repository` / `adapter` の実装には依存しない。
- `repository` / `adapter` は `domain` のインターフェースを**実装**する。
- 具体的な実装の注入は `main.ts` で行う（DI）。

### 禁止する依存

- `service` → `handler` / `repository` / `adapter`（実装）
- `repository` ⇄ `adapter`（相互に参照しない。連携が必要なら `service` で組み合わせる）
- `domain` → 他のすべての層
- `handler` → `repository` / `adapter`（必ず `service` を経由する）

### ディレクトリ詳細

```
src/server/
├── handler/
│   ├── user.handler.ts
│   ├── article.handler.ts
│   ├── middleware/         # 認証、ログ、エラーハンドリング等
│   └── dto/                # リクエスト/レスポンスの型・バリデーションスキーマ
├── service/
│   ├── user.service.ts
│   └── article.service.ts
├── repository/
│   ├── user.repository.ts      # domainのUserRepositoryの実装
│   ├── article.repository.ts
│   └── models/                 # ORMのモデル・DBスキーマ
├── adapter/
│   ├── mail.adapter.ts         # domainのMailGatewayの実装
│   └── storage.adapter.ts
├── domain/
│   ├── entities/               # User, Article など
│   ├── repositories/           # Repositoryのインターフェース
│   ├── gateways/               # Adapterのインターフェース
│   └── errors/                 # NotFoundError, ValidationError など
├── config/
└── main.ts
```

### リクエストの流れ（例: ユーザー登録）

1. `handler/user.handler.ts` がリクエストを受け取りバリデーションする。
2. `service/user.service.ts` を呼び出す。
3. `service` が `UserRepository`（interface）で重複チェック・保存を行う。
4. `service` が `MailGateway`（interface）で確認メールを送る。
5. 実体は `repository/user.repository.ts` と `adapter/mail.adapter.ts` が担う。
6. `service` が結果を返し、`handler` がレスポンスに整形する。

### serverのルール

- エラーは `domain/errors` のドメインエラーとして投げ、HTTPステータスへの変換は `handler`（のエラーハンドラ）のみで行う。
- DBのレコードや外部APIのレスポンスをそのまま `service` に渡さず、`repository` / `adapter` 内で `domain` の型に変換する。
- テストは `service` をモック（repository/adapterのインターフェース）で単体テストし、`repository` / `adapter` は結合テストで確認する。

---

## 命名規則

- ファイル名: `<対象>.<層>.ts`（例: `user.service.ts`）
- インターフェース名: repositoryは `XxxRepository`、adapter側は `XxxGateway`
- 実装クラス名: インターフェースの実装であることが分かる名前にする（例: `PrismaUserRepository`, `SesMailAdapter`）
