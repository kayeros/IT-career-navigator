"""Собирает миграцию goose из docs/db/schema.sql: таблицы берутся без изменений,
внешние ключи и индексы — только между таблицами, которые уже есть в миграциях.

    python scripts/gen_migration.py 00005_admin "Журнал изменений админки" audit_log
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "backend" / "migrations"


def main() -> None:
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    name, title, tables = sys.argv[1], sys.argv[2], sys.argv[3:]
    sql = (ROOT / "docs/db/schema.sql").read_text(encoding="utf-8")
    defs = {m.group(1): m.group(0) for m in re.finditer(r"^CREATE TABLE (\w+) \(.*?^\);", sql, re.S | re.M)}

    existing = set()
    for f in MIGRATIONS.glob("*.sql"):
        existing |= set(re.findall(r"^CREATE TABLE (\w+) \(", f.read_text(encoding="utf-8"), re.M))
    known = existing | set(tables)

    lines = sql.splitlines()
    fks = [l for l in lines if (m := re.match(r"ALTER TABLE (\w+) ADD FOREIGN KEY \(\w+\) REFERENCES (\w+)\(", l))
           and m.group(1) in tables and m.group(2) in known]
    idx = [l for l in lines if (m := re.match(r"CREATE INDEX ON (\w+) ", l)) and m.group(1) in tables]
    com = [l for l in lines if (m := re.match(r"COMMENT ON (?:COLUMN (\w+)\.|TABLE (\w+) )", l)) and (m.group(1) or m.group(2)) in tables]

    out = [f"-- {title}. Имена и поля — строго как в docs/db/schema.sql.", "", "-- +goose Up"]
    for t in tables:
        out += [defs[t], ""]
    out += fks + [""] + (idx + [""] if idx else []) + (com + [""] if com else [])
    out += ["-- +goose Down"] + [f"DROP TABLE IF EXISTS {t} CASCADE;" for t in reversed(tables)]
    (MIGRATIONS / f"{name}.sql").write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    print(f"{name}: таблиц {len(tables)}, внешних ключей {len(fks)}, индексов {len(idx)}")


if __name__ == "__main__":
    main()
