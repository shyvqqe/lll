# suzy на Render и Supabase

Сайт работает на **Render Free**, аккаунты и сессии хранятся в **Supabase Postgres**. Регистрация и вход используют никнейм и пароль. Для настройки нужен Node.js 24.

## 1. Настрой Supabase

1. Создай проект в [Supabase](https://supabase.com/dashboard). В проекте открой **Connect → Session pooler → URI** и скопируй строку с `[YOUR-PASSWORD]`. У неё порт `5432`. [Справка по Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres#shared-pooler-session-mode)
2. Распакуй архив, открой терминал в папке сайта и выполни команды.

   ```sh
   npm ci
   npm run setup:guided
   ```

3. Когда программа попросит строку, вставь скопированный URI целиком и нажми Enter. При следующем запросе введи пароль базы в обычном виде. Символы пароля скрыты.

Команда однократно создаёт таблицы и отдельную роль `suzy_app` с ограниченными правами. Сохрани выведенное значение `DATABASE_URL` для Render в менеджере паролей.

## 2. Разверни сайт на Render

1. Загрузи содержимое папки в GitHub-репозиторий. `render.yaml` и `package.json` должны быть в корне. Исключи `.env.setup` и `node_modules` из загрузки.
2. В [Render Dashboard](https://dashboard.render.com/) выбери **New → Blueprint**, подключи репозиторий и вставь в поле `DATABASE_URL` значение, выведенное командой настройки. Конфигурация запуска уже в `render.yaml`. [Инструкция Render](https://render.com/docs/infrastructure-as-code)
3. После развёртывания открой адрес `onrender.com` и проверь регистрацию и вход.

Для Session pooler уже включён официальный корневой сертификат Supabase из `certs/prod-ca-2021.crt`. Скрипт и сайт проверяют сертификат и имя сервера. Если Supabase выпустит новый сертификат, скачай его из **Database Settings → SSL Configuration**. На Render можно задать его PEM-текст в `DATABASE_SSL_ROOT_CERT`, а локально — путь к файлу в `DATABASE_SSL_ROOT_CERT_FILE` в `.env.setup`. [Настройка TLS](https://supabase.com/docs/guides/platform/ssl-enforcement#a-note-about-postgres-ssl-modes) · [Источник сертификата](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)

База начинается пустой. Аккаунты из версии на SQLite или из опубликованной версии Sites нужно переносить отдельно. На бесплатных тарифах Render усыпляет бездействующий веб-сервис, а Supabase может приостановить проект после недели бездействия. [Render Free](https://render.com/docs/free) · [Supabase Free](https://supabase.com/pricing)
