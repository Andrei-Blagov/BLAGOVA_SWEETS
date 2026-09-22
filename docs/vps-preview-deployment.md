# Preview deployment on a VPS

Актуальная процедура первого запуска, автоматического деплоя, просмотра логов и отката находится в [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md).

Не используйте старые команды `git pull && docker compose up --build`: Preview получает только image, собранный GitHub Actions после успешного CI.
