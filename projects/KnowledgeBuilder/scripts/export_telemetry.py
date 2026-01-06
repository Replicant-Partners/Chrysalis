import argparse
import json
import os
import sqlite3
import csv


def fetch(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT timestamp, tool, cost, latency_ms, success, new_facts, error, meta FROM telemetry ORDER BY timestamp ASC"
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def export_csv(rows, out_path: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "tool", "cost", "latency_ms", "success", "new_facts", "error", "meta"])
        for r in rows:
            writer.writerow(r)


def export_jsonl(rows, out_path: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for r in rows:
            obj = {
                "timestamp": r[0],
                "tool": r[1],
                "cost": r[2],
                "latency_ms": r[3],
                "success": r[4],
                "new_facts": r[5],
                "error": r[6],
                "meta": json.loads(r[7]) if r[7] else None,
            }
            f.write(json.dumps(obj) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Export telemetry to CSV/JSONL")
    parser.add_argument("--db", default="./data/telemetry.db")
    parser.add_argument("--csv", default="./data/telemetry.csv")
    parser.add_argument("--jsonl", default="./data/telemetry.jsonl")
    args = parser.parse_args()

    rows = fetch(args.db)
    export_csv(rows, args.csv)
    export_jsonl(rows, args.jsonl)
    print(f"Exported {len(rows)} rows to {args.csv} and {args.jsonl}")


if __name__ == "__main__":
    main()
