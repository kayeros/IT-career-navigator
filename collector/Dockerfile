FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml ./
COPY collector ./collector
# dev-зависимости (pytest) ставим и в образ: на MVP тесты запускаются в том же контейнере.
RUN pip install --no-cache-dir ".[dev]" && useradd -u 10001 app
COPY tests ./tests
USER app
ENTRYPOINT ["python", "-m", "collector"]
CMD ["--help"]
