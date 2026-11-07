"""Полный прогон сбора и анализа и запуск по расписанию.

Прогон: загрузка из всех источников по всем профессиям → склейка дублей → поиск навыков →
неизвестные термины → веса навыков → чистка старых вакансий. Ошибка одного источника
(например, нет ключа SuperJob) не останавливает остальные шаги.
"""

import logging

import psycopg
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from collector import skills, superjob, trudvsem, vacancies, weights
from collector.config import Config

log = logging.getLogger(__name__)


def run_all(cfg: Config) -> None:
    with psycopg.connect(cfg.database_url) as conn:
        for slug in vacancies.SEARCHES:
            loaders = [("Работа России", lambda s=slug: trudvsem.load(conn, s))]
            if cfg.superjob_api_key:
                loaders.append(("SuperJob", lambda s=slug: superjob.load(conn, cfg.superjob_api_key, s)))
            else:
                log.warning("SUPERJOB_API_KEY не задан — SuperJob пропущен")
            for name, load in loaders:
                try:
                    load()
                except (Exception, SystemExit) as exc:  # noqa: BLE001 — один источник не должен ронять прогон
                    conn.rollback()
                    log.error("%s, %s: загрузка не удалась: %s", name, slug, exc)
        vacancies.mark_duplicates(conn)
        skills.match_all(conn)
        skills.unknown_terms(conn)
        try:
            weights.calc(conn, None)
        except SystemExit as exc:
            log.warning("веса: %s", exc)
        vacancies.cleanup(conn)
    log.info("прогон завершён")


def schedule(cfg: Config, cron: str) -> None:
    """Запускает прогон по расписанию (cron-строка, по умолчанию — 1-го числа каждого месяца в 03:00 МСК)."""
    scheduler = BlockingScheduler(timezone="Europe/Moscow")
    scheduler.add_job(run_all, CronTrigger.from_crontab(cron, timezone="Europe/Moscow"), args=[cfg],
                      id="collect", max_instances=1, coalesce=True, misfire_grace_time=6 * 3600)
    log.info("расписание сбора: %s (МСК)", cron)
    scheduler.start()
