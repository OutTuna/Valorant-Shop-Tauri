# Valorant Store — Tauri Edition

Портированная версия [Valorant-Shop-Checker](https://github.com/OutTuna/Valorant-Shop-Checker)
на **Vite + React + Tauri 2**. Python/FastAPI бэкенд полностью убран — вся
логика похода в Riot API (token-login, storefront, wallet, night market)
переписана на Rust и живёт прямо внутри приложения как Tauri-команды.

Никакого `uvicorn`, никакого второго процесса, никакого порта `:8000`.
Один бинарник = один процесс.

Также подключена кастомная URL-схема `valorant-store://` через
`tauri-plugin-deep-link` — подробности и честные ограничения см. в разделе
["Как теперь работает вход"](#как-теперь-работает-вход) ниже.

## Что изменилось относительно оригинала

- **Next.js → Vite + React Router.** Next был не нужен: SSR/API routes тут
  не используются, а App Router плохо дружит со статическим Tauri-рендерингом.
  `HashRouter` вместо `BrowserRouter`, потому что фронтенд раздаётся из
  `tauri://localhost`, а не с настоящего сервера с history-fallback.
- **FastAPI (`backend/main.py`) → Rust (`src-tauri/src/valorant.rs`).**
  Перенесена ровно та часть логики, которая нужна: `token-login` (вход по
  access token / session id, который ты вставляешь руками или через
  редирект из браузера) → storefront v3/v2 fallback → wallet → offer prices
  → skin catalog → сборка `ShopSession`.
- **`local-login` (чтение lockfile Riot Client) убран целиком** — по твоей
  просьбе, раз ты используешь вход по session id/token, а не через
  локальный клиент. Если он понадобится в будущем, его придётся добавить
  отдельно как Tauri-команду, читающую lockfile через `std::fs` (это уже не
  будет ограничено `127.0.0.1`, как было в Python-версии — Tauri и так
  работает локально).
- **`/api/login` (логин по username/password) тоже убран** — текущий поток
  входа через сам Riot (браузер → редирект → access_token) безопаснее и
  не требует пересылки пароля куда-либо вообще.

## Структура проекта

```
.
├── index.html              # точка входа Vite
├── src/
│   ├── main.tsx             # React root, провайдеры, роутинг
│   ├── index.css            # перенесённый globals.css (темы, токены)
│   ├── context/              # ThemeContext, LanguageContext — без изменений
│   └── pages/
│       ├── HomePage.tsx        # магазин (бывший app/page.tsx)
│       ├── LoginPage.tsx       # вход (token/session id + deep-link подсказка)
│       ├── RedirectPage.tsx    # опциональный авто-редирект флоу (см. ниже)
│       └── DeepLinkListener.tsx # ловит valorant-store:// на старте и в рантайме
│   └── lib/
│       ├── valorant.ts         # типы ShopSession/ShopItem + sessionStorage
│       └── deepLink.ts         # парсинг access_token из deep-link URL
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/
        ├── main.rs           # точка входа
        ├── lib.rs             # сборка Tauri Builder, регистрация плагинов/команд
        ├── commands.rs        # #[tauri::command] token_login
        ├── valorant.rs        # вся Riot API логика (порт _build_shop_payload)
        ├── types.rs           # ShopSession/ShopItem/Player (serde, camelCase)
        └── error.rs           # RiotError → String для границы Tauri
```

## Установка и запуск

### Требования

- Node.js 20+
- Rust **1.77.2+** (Tauri 2 требует свежий тулчейн — ставь через
  [rustup](https://rustup.rs), не через `apt`, в Ubuntu/Debian репах Rust
  обычно устаревший)
- Системные зависимости Tauri для твоей ОС — см.
  [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)
  (на Linux это `webkit2gtk`, `libayatana-appindicator3-dev` и т.д.)
- На Linux для регистрации схемы `valorant-store://` нужен `xdg-utils`
  (обычно уже стоит); схема прописывается автоматически при первом
  запуске собранного бинарника/AppImage.

### Шаги

```bash
npm install
npm run tauri icon path/to/your-1024x1024-icon.png   # сгенерирует src-tauri/icons/*
npm run tauri dev      # окно приложения + hot reload
npm run tauri build    # production-бинарник/инсталлятор
```

`npm run tauri icon` нужно выполнить один раз — в репозитории нет
сгенерированных иконок, `tauri.conf.json` лишь ссылается на ожидаемые пути.

## Как теперь работает вход

1. Жмёшь кнопку "войти через Riot" → открывается официальная страница
   Riot в системном браузере (`auth.riotgames.com`).
2. После входа Riot редиректит на `https://playvalorant.com/opt_in#access_token=...`.
3. Дальше два варианта:
   - **Вручную:** копируешь этот URL (или просто `access_token` из него) и
     вставляешь в поле на странице логина.
   - **Через deep link:** в адресной строке браузера заменяешь
     `https://playvalorant.com/opt_in` на `valorant-store://auth` и жмёшь
     Enter. ОС передаёт ссылку приложению — оно само вызывает
     `token_login` и логинит тебя, без копипасты в textarea.
4. Дальше в обоих случаях фронтенд зовёт `invoke("token_login", { accessToken, region })` —
   всё происходит в Rust, без сети до твоей машины и без
   собственного сервера где-либо.
5. Результат (`ShopSession`) кладётся в `sessionStorage`, как и раньше —
   просто теперь источник данных не `http://127.0.0.1:8000`, а сам бинарник.

### ⚠️ Честно про deep-link и его реальный предел

Важно понимать, что именно делает deep link, а чего не делает.

Riot Games у себя зарегистрировал OAuth-клиента `play-valorant-web-prod`
(тот, через который логинится и эта аппа, и оригинальный
`Valorant-Shop-Checker`, и почти все сторонние шоп-чекеры) с
**фиксированным** `redirect_uri = https://playvalorant.com/opt_in`. Это
домен Riot, не наш — у нас нет возможности заставить Riot редиректить
сразу на `valorant-store://...`, потому что для этого нужен собственный
OAuth-клиент, зарегистрированный в Riot Developer Portal с собственным
redirect URI, а Riot такие клиенты сторонним разработчикам не выдаёт.

Поэтому **полностью бесшовного "нажал — залогинился" пока не бывает ни у
кого** — это ограничение API, а не реализации. То, что добавляет
deep-link здесь — это возможность одним движением (поменять домен в адресной
строке на свою схему и нажать Enter) подставить токен в приложение, вместо
копирования в textarea. Сама механика OAuth-редиректа остаётся ручной.

Что реально работает технически:

- `tauri-plugin-deep-link` регистрирует схему `valorant-store://` в ОС
  (`tauri.conf.json > plugins > deep-link > desktop > schemes`).
- `tauri-plugin-single-instance` (фича `deep-link`) гарантирует, что если
  приложение уже открыто, повторный запуск через схему не плодит второе
  окно, а форвардит URL в уже работающее.
- `src/pages/DeepLinkListener.tsx` слушает событие что на старте
  (`getCurrent()`), что в рантайме (`onOpenUrl()`) — оба пути ведут в один
  и тот же `token_login`.

## Известные ограничения / TODO

- `RedirectPage` (`/redirect`) — тот же самый кейс "свой redirect URI",
  только реализованный через HTTP-роут внутри SPA, а не через ОС-схему.
  Полезен, только если когда-нибудь появится собственный OAuth-клиент с
  http(s)-redirect URI, который физически открывает приложение (например,
  через `tauri-plugin-deep-link`'s App Links/Universal Links для
  верифицированного домена). Сейчас не задействован ни одной кнопкой в UI.
- На macOS схема прописывается в Info.plist на этапе сборки (это делает
  `tauri-plugin-deep-link` сам по конфигу из `tauri.conf.json`), но
  динамическая регистрация схемы в рантайме там не работает — тестировать
  deep link на macOS можно только в собранном `.app`, установленном в
  `/Applications`, не в `tauri dev`. На Windows/Linux работает и в `dev`.
- Rust-код не компилировался в среде с актуальным тулчейном (тут был
  доступен только `rustc 1.75` из `apt`, слишком старый для современных
  крейтов вроде `idna_adapter`/`indexmap`, не говоря о самих плагинах
  Tauri). 
- Обязательно прогони `cargo check` локально перед первым запуском.
