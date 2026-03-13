# PetroScope

世界各国の年間 oil consumption と原油調達構成を可視化する、GitHub Pages 向けの静的サイトです。React + TypeScript + Vite + D3 で構成しています。

## サイト概要

- 世界地図上に年間 oil consumption を面積比例の円で表示
- 国クリックで調達構成カードを表示
- 複数国同時選択と矢印比較に対応
- `public/data` の JSON を差し替えるだけで表示内容を更新

## データ定義

- 円サイズ: `oil-consumption-YYYY.json`
- 調達構成: `oil-origin-mix-YYYY.json`
- 国台帳: `countries.master.json`
- 出典台帳: `sources.json`
- 表示補正: `display-overrides.json`
- 品質区分: `complete` / `partial` / `missing`

## データ更新方法

1. `public/data` 配下の JSON を更新します。
2. `npm run validate:data` を実行して整合性を検証します。
3. 地図データを更新する場合は `npm run prepare:map` を実行します。
4. `npm run build` で静的成果物を生成します。

## 公開方法

1. GitHub リポジトリの Pages を `GitHub Actions` で有効化します。
2. `main` ブランチへ push すると `.github/workflows/deploy.yml` が実行されます。
3. `dist` が GitHub Pages に配信されます。

## 開発

```bash
npm install
npm run prepare:map
npm run validate:data
npm run dev
```

## 出典一覧

- Energy Institute
- UN Comtrade
- 各国政府・統計機関
- Natural Earth 由来 TopoJSON (`sane-topojson` 経由)

## 境界ポリシー

- Natural Earth 準拠
- アプリ独自の政治判定は行わない

## 既知の制約

- サンプル JSON は主要国中心の例示データです
- 値の真実性はアプリではなくデータファイルが保証します
- 年次自動更新 ETL、外部 API のブラウザ直呼び、時系列アニメーションは対象外です
