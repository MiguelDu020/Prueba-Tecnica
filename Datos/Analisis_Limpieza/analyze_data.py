import os
import glob
import re
import hashlib
import pandas as pd

DATASET_DIR = r"Datasets"
OUTPUT_DIR = r"Outputs"

BASE_COLUMNS = ["Plot name", "metric (sf_metric)", "Value Prefix", "Value Suffix"]


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def file_hash(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def classify_columns(columns):
    base_cols = [c for c in columns if c in BASE_COLUMNS]
    ts_cols = [c for c in columns if c not in BASE_COLUMNS]
    return base_cols, ts_cols


def _parse_timestamp_col_name(ts_text: str):
    """
    Convierte columnas tipo:
    'Sun Feb 01 2026 06:59:40 GMT-0500 (hora estándar de Colombia)'
    a datetime parseable.
    """
    if not isinstance(ts_text, str):
        return pd.NaT

    # quitar el texto entre paréntesis y GMT offset para evitar warnings/NaT
    cleaned = re.sub(r"\s*\(.*\)$", "", ts_text).strip()
    cleaned = re.sub(r"\sGMT[+-]\d{4}", "", cleaned).strip()

    # ejemplo final: 'Sun Feb 01 2026 06:59:40'
    return pd.to_datetime(cleaned, format="%a %b %d %Y %H:%M:%S", errors="coerce")


def to_long_format(df: pd.DataFrame, source_file: str) -> pd.DataFrame:
    base_cols, ts_cols = classify_columns(df.columns.tolist())

    long_df = df.melt(
        id_vars=base_cols,
        value_vars=ts_cols,
        var_name="timestamp_raw",
        value_name="value_raw",
    )

    long_df["source_file"] = source_file
    long_df["timestamp"] = long_df["timestamp_raw"].apply(_parse_timestamp_col_name)
    long_df["value"] = pd.to_numeric(long_df["value_raw"], errors="coerce")

    if "metric (sf_metric)" in long_df.columns:
        long_df["metric"] = long_df["metric (sf_metric)"]
    else:
        long_df["metric"] = None

    return long_df


def analyze_file(path: str):
    info = {
        "file": os.path.basename(path),
        "rows": 0,
        "cols": 0,
        "base_cols_count": 0,
        "timestamp_cols_count": 0,
        "null_cells": 0,
        "duplicate_rows": 0,
        "metrics_count": 0,
        "min_value": None,
        "max_value": None,
        "min_timestamp": None,
        "max_timestamp": None,
        "parse_timestamp_nulls": 0,
        "parse_value_nulls": 0,
    }

    df = pd.read_csv(path)
    info["rows"], info["cols"] = df.shape

    base_cols, ts_cols = classify_columns(df.columns.tolist())
    info["base_cols_count"] = len(base_cols)
    info["timestamp_cols_count"] = len(ts_cols)

    info["null_cells"] = int(df.isna().sum().sum())
    info["duplicate_rows"] = int(df.duplicated().sum())

    if "metric (sf_metric)" in df.columns:
        info["metrics_count"] = int(df["metric (sf_metric)"].nunique())

    long_df = to_long_format(df, os.path.basename(path))

    info["parse_timestamp_nulls"] = int(long_df["timestamp"].isna().sum())
    info["parse_value_nulls"] = int(long_df["value"].isna().sum())

    valid_values = long_df["value"].dropna()
    if len(valid_values) > 0:
        info["min_value"] = float(valid_values.min())
        info["max_value"] = float(valid_values.max())

    valid_ts = long_df["timestamp"].dropna()
    if len(valid_ts) > 0:
        info["min_timestamp"] = valid_ts.min()
        info["max_timestamp"] = valid_ts.max()

    return info, long_df


def main():
    ensure_output_dir()

    csv_files = sorted(glob.glob(os.path.join(DATASET_DIR, "*.csv")))
    if not csv_files:
        print("No se encontraron CSV en Datos/Datasets")
        return

    summaries = []
    quality_issues = []
    long_parts = []
    hashes = {}

    for path in csv_files:
        file_name = os.path.basename(path)

        # Duplicado por contenido de archivo
        h = file_hash(path)
        if h in hashes:
            quality_issues.append(
                {
                    "type": "duplicate_file_content",
                    "file": file_name,
                    "detail": f"Contenido duplicado de {hashes[h]}",
                }
            )
        else:
            hashes[h] = file_name

        try:
            info, long_df = analyze_file(path)
            summaries.append(info)
            long_parts.append(long_df)

            if info["duplicate_rows"] > 0:
                quality_issues.append(
                    {
                        "type": "duplicate_rows",
                        "file": file_name,
                        "detail": f"{info['duplicate_rows']} filas duplicadas",
                    }
                )

            if info["parse_timestamp_nulls"] > 0:
                quality_issues.append(
                    {
                        "type": "timestamp_parse_errors",
                        "file": file_name,
                        "detail": f"{info['parse_timestamp_nulls']} timestamps no parseables",
                    }
                )

            if info["parse_value_nulls"] > 0:
                quality_issues.append(
                    {
                        "type": "value_parse_errors_or_nulls",
                        "file": file_name,
                        "detail": f"{info['parse_value_nulls']} valores nulos/no numéricos",
                    }
                )

        except Exception as e:
            quality_issues.append({"type": "read_error", "file": file_name, "detail": str(e)})

    # Guardar resumen
    summary_df = pd.DataFrame(summaries)
    summary_path = os.path.join(OUTPUT_DIR, "data_profile_summary.csv")
    summary_df.to_csv(summary_path, index=False, encoding="utf-8-sig")

    # Guardar issues
    issues_df = pd.DataFrame(quality_issues)
    issues_path = os.path.join(OUTPUT_DIR, "data_quality_issues.csv")
    issues_df.to_csv(issues_path, index=False, encoding="utf-8-sig")

    # Guardar consolidado limpio
    if long_parts:
        full_long = pd.concat(long_parts, ignore_index=True)

        # Limpieza mínima
        full_long = full_long.dropna(subset=["timestamp", "value"])
        full_long = full_long.sort_values(["metric", "timestamp"])

        cleaned_path = os.path.join(OUTPUT_DIR, "cleaned_long_format.csv")
        full_long.to_csv(cleaned_path, index=False, encoding="utf-8-sig")
    else:
        cleaned_path = None

    print("Análisis completado")
    print(f"- Resumen: {summary_path}")
    print(f"- Issues: {issues_path}")
    if cleaned_path:
        print(f"- Limpio (long): {cleaned_path}")


if __name__ == "__main__":
    main()
