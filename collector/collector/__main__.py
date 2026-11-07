"""Командная строка: python -m collector <команда>."""

import argparse
import logging

import psycopg

from collector import config, skills, superjob, weights


def main() -> None:
    parser = argparse.ArgumentParser(prog="collector", description="Сбор и анализ вакансий")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("load-superjob", help="загрузить вакансии SuperJob по профессии")
    p.add_argument("--profession", required=True, choices=sorted(superjob.SEARCHES))

    sub.add_parser("match-skills", help="найти навыки в вакансиях по справочнику и синонимам")

    p = sub.add_parser("calc-weights", help="рассчитать и опубликовать веса навыков")
    p.add_argument("--profession", help="slug профессии; по умолчанию — все доступные")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = config.load()

    with psycopg.connect(cfg.database_url) as conn:
        if args.command == "load-superjob":
            superjob.load(conn, cfg.superjob_api_key, args.profession)
        elif args.command == "match-skills":
            skills.match_all(conn)
        elif args.command == "calc-weights":
            weights.calc(conn, args.profession)


if __name__ == "__main__":
    main()
