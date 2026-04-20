"""
convert_csv_to_json.py
======================
Convierte cleaned_long_format.csv en un JSON estructurado con métricas
agregadas listas para ser consumidas por el chatbot de Gemini.

Uso:
    python convert_csv_to_json.py

Salida:
    data/store_data.json
"""

import csv
import json
import os
from datetime import datetime
from collections import defaultdict

CSV_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "dashboard",
    "public",
    "cleaned_long_format.csv",
)
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "data", "store_data.json")


def load_csv(path):
    rows = []
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                value = float(row["value"])
                timestamp = row["timestamp"].strip()
                source = row["source_file"].strip()
                rows.append({"timestamp": timestamp, "value": value, "source": source})
            except (ValueError, KeyError):
                continue
    return rows


def compute_summary(rows):
    if not rows:
        return {}

    values = [r["value"] for r in rows]
    max_stores = max(values)
    min_stores = min(values)
    avg_stores = sum(values) / len(values)

    # Capacity index (% of max achieved on average)
    capacity_index = (avg_stores / max_stores * 100) if max_stores > 0 else 0

    # Count micro-drops (consecutive decrease > 2%)
    micro_drops = 0
    for i in range(1, len(values)):
        prev = values[i - 1]
        curr = values[i]
        if prev > 0 and (prev - curr) / prev > 0.02:
            micro_drops += 1

    # Source breakdown
    sources = defaultdict(list)
    for r in rows:
        sources[r["source"]].append(r["value"])

    source_stats = {}
    for src, vals in sources.items():
        src_max = max(vals)
        src_avg = sum(vals) / len(vals)
        source_stats[src] = {
            "total_readings": len(vals),
            "max_stores": round(src_max),
            "avg_stores": round(src_avg, 1),
            "capacity_index_pct": round((src_avg / src_max * 100) if src_max > 0 else 0, 2),
            "min_stores": round(min(vals)),
        }

    # Hourly distribution
    hourly = defaultdict(list)
    for r in rows:
        try:
            dt = datetime.strptime(r["timestamp"], "%Y-%m-%d %H:%M:%S")
            hourly[dt.hour].append(r["value"])
        except ValueError:
            continue

    hourly_avg = {
        str(h): round(sum(v) / len(v)) for h, v in sorted(hourly.items())
    }

    # Best / worst hours
    if hourly_avg:
        best_hour = max(hourly_avg, key=lambda h: hourly_avg[h])
        worst_hour = min(hourly_avg, key=lambda h: hourly_avg[h])
    else:
        best_hour = worst_hour = "N/A"

    # Date range
    timestamps = [r["timestamp"] for r in rows if r["timestamp"]]
    date_range = {
        "from": min(timestamps) if timestamps else "N/A",
        "to": max(timestamps) if timestamps else "N/A",
    }

    # Offline threshold: readings where value < 80% of max
    offline_threshold = max_stores * 0.80
    offline_count = sum(1 for v in values if v < offline_threshold)
    online_count = len(values) - offline_count
    offline_pct = round((offline_count / len(values)) * 100, 2) if values else 0
    online_pct = round(100 - offline_pct, 2)

    return {
        "generated_at": datetime.now().isoformat(),
        "date_range": date_range,
        "total_readings": len(rows),
        "total_sources": len(sources),
        "global_metrics": {
            "max_stores_ever": round(max_stores),
            "min_stores_ever": round(min_stores),
            "avg_stores": round(avg_stores, 1),
            "capacity_index_pct": round(capacity_index, 2),
            "online_readings_pct": online_pct,
            "offline_readings_pct": offline_pct,
            "micro_drops_detected": micro_drops,
        },
        "hourly_distribution": {
            "avg_stores_by_hour": hourly_avg,
            "best_hour": f"{best_hour}:00",
            "worst_hour": f"{worst_hour}:00",
        },
        "source_breakdown": source_stats,
    }


def main():
    print(f"[1/3] Leyendo CSV desde: {CSV_PATH}")
    rows = load_csv(CSV_PATH)
    print(f"      {len(rows):,} registros cargados.")

    print("[2/3] Calculando métricas...")
    summary = compute_summary(rows)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    print(f"[3/3] Guardando JSON en: {OUTPUT_PATH}")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("\n Conversión completa.")
    print(f"   Total registros : {summary['total_readings']:,}")
    print(f"   Fuentes         : {summary['total_sources']}")
    print(f"   Índice capacidad: {summary['global_metrics']['capacity_index_pct']}%")
    print(f"   Micro-caídas    : {summary['global_metrics']['micro_drops_detected']}")


if __name__ == "__main__":
    main()
