# Фронтенд «Карьерного навигатора IT»

SPA на React 18 + TypeScript (strict) + Vite. Требования: `docs/frontend-requirements.docx`, контракт API: `api/openapi.yaml`.

## Что сделано

Вёрстка и экраны повторяют прототип команды (`prototype/sajt`): стили прототипа перенесены как есть (`src/styles/prototype.css`), разметка — на тех же классах.

| Экран | Маршрут | API |
|---|---|---|
| Главная: первый экран, «Кем хотите стать?», «Как это работает», форма обратной связи | `/` | `GET /professions`; форма — заглушка (`src/mocks/slice1.ts`), в API её пока нет |
| Шапка (тема, каталог, «Мой план», «Личный кабинет», «Админка» для admin, мобильное меню), подвал, cookie, 404 | все | `GET /me`, `POST /auth/logout` |
| Плашка «Подтвердите почту» с повторной отправкой | все, если почта не подтверждена | `POST /auth/verify-email/resend` |
| Регистрация и вход; после регистрации — онбординг, после входа — возврат по `?next=` | `/register`, `/login` | `POST /auth/register`, `POST /auth/login` |
| Ссылки из писем: подтверждение почты, новый пароль | `/verify-email?token=`, `/reset-password?token=` | `POST /auth/verify-email`, `POST /auth/password-reset/confirm` |
| Восстановление пароля | `/reset` | `POST /auth/password-reset` |
| Онбординг: 4 шага (статус и курс, профессия или «Не знаю», часы 2–40 и срок, два вопроса для гипотез), каждый шаг сохраняется | `/onboarding` | `GET/PUT /me/profile` |
| Каталог: фильтр со счётчиками, поиск, «Сообщить о запуске» | `/professions` | `GET /professions`, `POST /waitlist` |
| Карта профессии: блоки и темы, «Изучено», прогресс, % соответствия | `/professions/:slug` | `GET /professions/{slug}`, `PUT/DELETE /topics/{id}/progress`, `GET …/match` |
| Оценка навыков: по одному навыку, «не знаю / базово / уверенно», проверочный вопрос для «уверенно», продолжение с места остановки, «раньше 7 дней — нельзя» | `/professions/:slug/assess` | `POST …/assessments`, `PUT /assessments/{id}/answers/{skill_id}`, `POST …/complete` |
| Краткий отчёт: %, есть / частично / не хватает, три главных пробела с темами | `/professions/:slug/report` | `GET …/report` |
| План: форма (часы из профиля, срок), темы по неделям, текущий шаг, предупреждение о сроке, «Изучено», «Обновить план» (новая версия) | `/professions/:slug/plan`, `/plan` | `GET/POST …/plan` |
| Личный кабинет: прогресс и текущий шаг плана, мои профессии с %, оценкой и планом | `/dashboard` | `/me/profile`, `/professions`, по каждой доступной — карточка, план, отчёт |
| Профиль: ответы онбординга, почта, смена пароля по ссылке, выход | `/profile` | `GET/PUT /me/profile` |
| Админка (только `role = admin`): профессии; блоки и темы профессии (порядок стрелками, «не обязательна», тема из библиотеки); навыки профессии и «ключевой»; библиотека тем с навыками и материалами; справочник навыков со статусами и синонимами; материалы (одобрить / отклонить / заменить); неизвестные термины из вакансий (навык / синоним / не навык); заявки на запуск | `/admin/...` | `/admin/...` |
| Профориентация | `/quiz` | «скоро», этап 2 |
| Подписка (тарифы, оплаты пока нет), пользовательское соглашение, политика конфиденциальности, о проекте | `/pricing`, `/terms`, `/privacy`, `/about` | — |

- У каждого экрана есть загрузка (скелетон), ошибка с «Повторить», пустое состояние и вид для гостя / вошедшего.
- На телефоне панель темы открывается шторкой снизу с затемнением; после закрытия фокус возвращается на тему. Всплывающие уведомления — после входа, регистрации, выхода, «Изучено» и смены темпа.
- Скорость (сборка, телефон, сеть 1,6 Мбит/с + задержка 150 мс, процессор ×4): главная — LCP ≈1,9 с, каталог ≈1,2 с, карта ≈1,0 с.
- «Изучено» ставится сразу (оптимистично) во всех блоках, где есть тема; при ошибке откатывается.
- Светлая и тёмная тема (по системе или кнопкой в шапке, выбор хранится в localStorage). Шрифты Golos Text, Unbounded и JetBrains Mono лежат в `public/fonts` (OFL), со сторонних серверов ничего не грузится.
- В localStorage — только настройки интерфейса: тема, закрытая плашка cookie, последняя открытая профессия.

## Выбор библиотек

- Типы — `openapi-typescript` (`npm run gen:api`), клиент — `openapi-fetch`, все вызовы через `src/api/client.ts`.
- Загрузка данных — `@tanstack/react-query`.
- Стили — CSS прототипа (`prototype.css`) + небольшие дополнения в `global.css`, без UI-кита.
- Тесты — Vitest + Testing Library.

## Команды

```bash
npm ci
npm run dev       # http://localhost:5173, /api проксируется на http://localhost:8080
npm run build     # tsc -b && vite build
npm run lint
npm test
npm run gen:api   # перегенерировать src/api/schema.d.ts из ../api/openapi.yaml
```

Перед `npm run dev` подними backend из корня репозитория: `docker compose up --build -d`, затем `docker compose exec api /app/api seed`.

Без backend можно работать на мок-сервере: `node mock/server.mjs` (порт 8080, данные в памяти). Демо-аккаунт `demo@example.ru` / `demo1234` — с ролью admin.

В спецификации у `AdminProfession` поле `required` стоит внутри `allOf`, и генератор типов его теряет — тип уточнён в `features/admin/useAdmin.ts`. Когда Юрий поправит спецификацию, уточнение можно убрать.

## Docker

`Dockerfile` собирает SPA и отдаёт `dist/` через nginx; `nginx.conf` проксирует `/api/` на `api:8080` и отдаёт `index.html` для прямых ссылок. Сервис для `docker-compose.yml` (добавляет Юрий):

```yaml
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - api
```

## Структура

```
src/
  api/          schema.d.ts (генерируется), client.ts, types.ts
  components/   Header, Footer, Layout, CookieBar, Logo, Button, Field, Banner, ErrorState, Skeleton, ErrorBoundary
  features/     auth/, catalog/, home/, profession/, roadmap/, match/, assessment/, report/, plan/, profile/, admin/
  hooks/        useTheme
  lib/          errors.ts, format.ts, queryClient.ts, professionIcons.tsx, lastProfession.ts
  mocks/        slice1.ts — заглушки до API среза 1
  pages/        по одному файлу на экран, admin/ — разделы админки
  styles/       prototype.css (из прототипа), global.css, fonts.css
  test/         настройка тестов и хелперы
```
