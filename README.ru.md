# Valorant Store — Tauri Edition

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.77%2B-CE422B?style=flat-square&logo=rust&logoColor=white)](https://rustup.rs)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)](LICENSE)

[![Windows](https://img.shields.io/badge/Windows-✔%20протестировано-0078D4?style=flat-square&logo=windows&logoColor=white)]()
[![macOS](https://img.shields.io/badge/macOS-✔%20протестировано-000000?style=flat-square&logo=apple&logoColor=white)]()
[![Linux X11](https://img.shields.io/badge/Linux_X11-✔%20протестировано%20на%20Nobara-FCC624?style=flat-square&logo=linux&logoColor=black)]()

[English](README.md) · **Русский**

> Десктопный вьювер магазина Valorant на Tauri 2.  
> Смотри ежедневный магазин и Ночной рынок, не запуская игру.  
> Весь бэкенд для Riot API написан на **Rust**.

---

## Возможности

- **Ежедневный магазин** с живыми таймерами обратного отсчёта, которые сохраняются между перезапусками
- Поддержка **Ночного рынка** (отображается автоматически, когда активен)
- Три темы — Dark · White · Catppuccin Mocha
- Четыре языка интерфейса — 🇺🇸 EN · 🇺🇦 UK · 🇷🇺 RU · 🇵🇱 PL
- Автоматический вход через deep link по схеме `valorant-store://auth`
- Сессия сохраняется на диск — не нужно перелогиниваться до следующего сброса магазина
- Токен никогда не покидает устройство — все запросы идут напрямую к API Riot

---

## Отличия от оригинальной веб-версии

| | Оригинал (Next.js + FastAPI) | Этот репо (Tauri 2) |
|---|---|---|
| Бэкенд | Python / FastAPI | Rust (reqwest, tokio) |
| Фронтенд | Next.js | Vite + React 19 |
| Деплой | Vercel + Render | Десктопное приложение, деплоить нечего |
| Хранение сессии | sessionStorage (только вкладка) | `tauri-plugin-store` (сохраняется на диск) |
| Вход через lockfile | ✔ (только localhost) | — (не нужен для десктопа) |
| Хранение региона | sessionStorage | Персистентно, восстанавливается при старте |

---

## Требования

- [Node.js](https://nodejs.org) ≥ 18
- [Rust](https://rustup.rs) stable toolchain
- [Зависимости Tauri](https://tauri.app/start/prerequisites/) для твоей ОС

---

## Быстрый старт

```bash
git clone https://github.com/OutTuna/Valorant-Shop-Tauri
cd Valorant-Shop-Tauri
npm install
```

### Запуск в режиме разработки

```bash
npm run tauri dev
```

#### Linux — Nobara / обходной путь для Wayland

На Nobara, Fedora 40+ и других дистрибутивах с WebKit2GTK под Wayland
рендерер по умолчанию может показывать пустое окно или крашиться.
Принудительно включи режим X11:

```bash
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev
```

Для продакшен-бинаря можно сделать небольшую shell-обёртку:

```bash
#!/usr/bin/env bash
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 exec "$(dirname "$0")/valorant-store" "$@"
```

Или добавить переменные в строку `Exec=` в `.desktop`-файле лаунчера.

### Сборка для продакшена

```bash
npm run tauri build
```

Бинари и инсталляторы появятся в `src-tauri/target/release/bundle/`.

---

## Вход в аккаунт

Используется только **браузерный поток токена** — файл lockfile Riot Client не нужен.

1. Нажми **«Резервный вход: открыть Riot login»** — система откроет браузер со страницей авторизации Riot.
2. Войди в свой аккаунт Riot.
3. Браузер перейдёт на `https://playvalorant.com/opt_in#access_token=...`
4. Скопируй полный URL из адресной строки и вставь его в поле в приложении.

### Автовход через deep link (быстрее)

Чтобы не копировать URL, можно дать приложению перехватить токен автоматически:

1. Нажми **«Резервный вход: открыть Riot login»** и авторизуйся.
2. Когда браузер покажет `playvalorant.com/opt_in`, кликни на адресную строку,
   замени `https://playvalorant.com/opt_in` на `valorant-store://auth`
   и нажми **Enter**.
3. ОС передаст URL приложению, и оно залогинится само — без копирования.

> **Совет:** заново логиниться нужно только когда обновится ежедневный магазин
> (примерно раз в 24 часа). Сессия сохраняется на диск и восстанавливается автоматически.

---

## Структура проекта

```
├── src/                    # React-фронтенд (Vite)
│   ├── context/            # Провайдеры темы и языка
│   ├── lib/
│   │   └── valorant.ts     # Хранение сессии и региона (tauri-plugin-store)
│   └── pages/
│       ├── HomePage.tsx    # Ежедневный магазин + Ночной рынок
│       ├── LoginPage.tsx   # Поток авторизации
│       ├── DeepLinkListener.tsx  # Обработчик deep link (монтируется в корне)
│       └── RedirectPage.tsx      # Обрабатывает URL редиректа OAuth
└── src-tauri/
    ├── src/
    │   ├── valorant.rs     # Вся логика Riot API (reqwest, async)
    │   ├── commands.rs     # Tauri-команды для фронтенда
    │   ├── types.rs        # Общие Serde-типы
    │   └── error.rs        # Единый тип ошибки
    └── capabilities/
        └── default.json    # Области IPC-разрешений
```

---

## Известные ограничения

- **Вход через lockfile** (чтение локального порта/токена Riot Client) не реализован.
  Браузерный поток токена отлично работает для десктопного приложения.
- **Таймер Ночного рынка** недоступен — Riot не публикует расписание.
  Секция просто показывает заглушку, когда Ночного рынка нет.
- Riot API периодически меняет эндпоинты; если магазин перестал загружаться —
  загляни в [Issues](../../issues).

---

## Дисклеймер

Этот проект не связан с Riot Games и не одобрён ими.  
Valorant и все связанные материалы являются собственностью Riot Games, Inc.
