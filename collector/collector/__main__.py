"""Командная строка: python -m collector <команда>."""

import argparse
import logging
import os

import psycopg

from collector import config, pipeline, skills, superjob, trudvsem, vacancies, weights


def main() -> None:
    parser = argparse.ArgumentParser(prog="collector", description="Сбор и анализ вакансий")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("load-superjob", help="загрузить вакансии SuperJob по профессии")
    p.add_argument("--profession", required=True, choices=sorted(vacancies.SEARCHES))
    p = sub.add_parser("load-trudvsem", help="загрузить вакансии «Работа России» по профессии")
    p.add_argument("--profession", required=True, choices=sorted(vacancies.SEARCHES))

    sub.add_parser("dedup", help="склеить дубли вакансий между источниками")
    sub.add_parser("match-skills", help="найти навыки в вакансиях по справочнику и синонимам")
    sub.add_parser("unknown-terms", help="собрать частые термины, которых нет в справочнике")

    p = sub.add_parser("calc-weights", help="рассчитать и опубликовать веса навыков")
    p.add_argument("--profession", help="slug профессии; по умолчанию — все доступные")

    sub.add_parser("cleanup", help="удалить вакансии старше 12 месяцев")
    sub.add_parser("run-all", help="полный прогон: загрузка, дубли, навыки, термины, веса, чистка")
    p = sub.add_parser("schedule", help="запускать полный прогон по расписанию")
    p.add_argument("--cron", default=os.environ.get("COLLECT_CRON", "0 3 1 * *"),
                   help="расписание в формате cron, по умолчанию 1-го числа в 03:00 МСК")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = config.load()

    if args.command == "run-all":
        pipeline.run_all(cfg)
        return
    if args.command == "schedule":
        pipeline.schedule(cfg, args.cron)
        return

    with psycopg.connect(cfg.database_url) as conn:
        if args.command == "load-superjob":
            superjob.load(conn, cfg.superjob_api_key, args.profession)
        elif args.command == "load-trudvsem":
            trudvsem.load(conn, args.profession)
        elif args.command == "dedup":
            vacancies.mark_duplicates(conn)
        elif args.command == "match-skills":
            skills.match_all(conn)
        elif args.command == "unknown-terms":
            skills.unknown_terms(conn)
        elif args.command == "calc-weights":
            weights.calc(conn, args.profession)
        elif args.command == "cleanup":
            vacancies.cleanup(conn)


if __name__ == "__main__":
    main()
