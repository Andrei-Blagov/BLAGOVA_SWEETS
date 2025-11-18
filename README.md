# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

# BLAGOVA_SWEETS

Этот репозиторий содержит текущую версию сайта пекарни BLAGOVA_SWEETS c главной страницей, формой контактов, страницей «Сотрудничество» и серверными обработчиками заказов/обращений.

## Где искать проект внутри Dev Container
- Рабочая папка в контейнере: `/workspace/BLAGOVA_SWEETS`.
- В VS Code подключитесь через **Dev Containers** (зелёная кнопка в левом нижнем углу → *Attach to Running Container…*) и откройте каталог `/workspace/BLAGOVA_SWEETS` в проводнике.
- В Windows-проводнике путь доступен как `\\wsl$\\<имя_дистрибутива>\\workspace\\BLAGOVA_SWEETS` (например `\\wsl$\\Ubuntu\\workspace\\BLAGOVA_SWEETS`).

### Если Dev Container не запускается
Сообщение вида `request returned 500 Internal Server Error ... dockerDesktopLinuxEngine` означает, что локальный Docker Engine не поднялся. Попробуйте последовательно:

1. **Перезапустить Docker Desktop.** Закройте приложение через трей → *Quit Docker Desktop*, затем запустите снова и дождитесь зелёного статуса.
2. **Запустить VS Code в режиме WSL.** В проводнике Windows перейдите в `\\wsl$\\<имя_дистрибутива>\\workspace\\BLAGOVA_SWEETS`, нажмите правой кнопкой → *Open with Code*. Так вы откроете проект напрямую из WSL без контейнера.
3. **Использовать готовый архив.** В корне репозитория лежат файлы `blagova_sweets_static.zip` и `blagova_sweets_static.tar.gz`. Скопируйте их на диск C, распакуйте (например, в `C:\BLAGOVA_SWEETS`) и работайте с кодом как с обычной локальной папкой.
4. **Копирование через Explorer.** Если WSL доступен, просто перетащите папку `BLAGOVA_SWEETS` из `\\wsl$\\...` на диск C и откройте её в VS Code/GitHub Desktop.

Эти варианты позволяют получить полный код даже при сбое Dev Containers.

## Как скопировать проект на диск C:
1. **VS Code** → в разделе Explorer нажмите правой кнопкой на папку `BLAGOVA_SWEETS` → *Download…* и сохраните архив на `C:\`.
2. **Проводник Windows** → перейдите в `\\wsl$\\<имя_дистрибутива>\\workspace`, затем перетащите `BLAGOVA_SWEETS` на нужную папку на диске C.
3. **SCP** (если подключаетесь по SSH):
   ```bash
   scp -r <логин>@<хост>:/workspace/BLAGOVA_SWEETS C:/BLAGOVA_SWEETS
   ```
4. **Архив в контейнере**:
   ```bash
   cd /workspace
   tar czf BLAGOVA_SWEETS.tar.gz BLAGOVA_SWEETS
   ```
   После этого скачайте `BLAGOVA_SWEETS.tar.gz` и распакуйте его на локальной машине.

## Как зафиксировать и выгрузить изменения на GitHub
1. Перейдите в корень проекта и добавьте удалённый репозиторий:
   ```bash
   git remote add origin git@github.com:<аккаунт>/<репозиторий>.git
   ```
2. Отправьте текущую ветку `work`:
   ```bash
   git push -u origin work
   ```
   При необходимости можно отправить напрямую в `main`: `git push -u origin work:main`.
3. После первого `push` новые коммиты публикуются обычной командой `git push`.

## Установка зависимостей

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
