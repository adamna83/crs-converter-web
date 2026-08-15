# batch_service.py - batch CSV coordinate transformation.

"""Transform coordinate columns in an uploaded CSV file.

Column auto-detection follows the same header patterns as the standalone
coord_transformer.py utility: ID columns, X/Easting columns, and
Y/Northing columns are matched case-insensitively, with explicit overrides
taking precedence.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone

from pyproj import CRS, Transformer
from pyproj.transformer import TransformerGroup

_ID_PATTERNS = re.compile(r"^(id|asset.?id|well.?id|uwi|unique.?id|api|permit|name|well.?name|facility)$", re.I)
_X_PATTERNS = re.compile(r"^(x|easting|e|long|longitude|lon|x_?coord|e_?coord|central.?meridian|x[_\s-]*easting|easting[_\s-]*x)$", re.I)
_Y_PATTERNS = re.compile(r"^(y|northing|n|lat|latitude|y_?coord|n_?coord|y[_\s-]*northing|northing[_\s-]*y)$", re.I)

MAX_BATCH_ROWS = 50_000
DATE_STAMP = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class BatchError(ValueError):
    """Raised for user-facing batch input problems."""


def _detect_column(headers: list[str], pattern: re.Pattern, label: str) -> str:
    for h in headers:
        if pattern.match(h.strip()):
            return h.strip()
    raise BatchError(
        f"Cannot auto-detect the {label} column from headers: {headers}. "
        "Rename the column or use explicit column overrides."
    )


def resolve_columns(
    headers: list[str],
    id_col: str | None,
    x_col: str | None,
    y_col: str | None,
) -> tuple[str, str, str]:
    headers_stripped = [h.strip() for h in headers]

    if id_col:
        if id_col not in headers_stripped:
            raise BatchError(f"Specified ID column '{id_col}' not found in CSV headers: {headers_stripped}")
        id_column = id_col
    else:
        id_column = _detect_column(headers_stripped, _ID_PATTERNS, "ID")

    if x_col:
        if x_col not in headers_stripped:
            raise BatchError(f"Specified X column '{x_col}' not found in CSV headers: {headers_stripped}")
        x_column = x_col
    else:
        x_column = _detect_column(headers_stripped, _X_PATTERNS, "X/Easting")

    if y_col:
        if y_col not in headers_stripped:
            raise BatchError(f"Specified Y column '{y_col}' not found in CSV headers: {headers_stripped}")
        y_column = y_col
    else:
        y_column = _detect_column(headers_stripped, _Y_PATTERNS, "Y/Northing")

    if x_column == y_column:
        raise BatchError(f"X and Y columns resolve to the same header '{x_column}'.")
    if id_column == x_column or id_column == y_column:
        raise BatchError("ID column conflicts with a coordinate column; specify columns explicitly.")
    return id_column, x_column, y_column


def _parse_float(value: str, field: str, row_id: str) -> float:
    cleaned = value.strip()
    if cleaned == "":
        raise BatchError(f"Blank value in '{field}' for record '{row_id}'.")
    try:
        return float(cleaned)
    except ValueError:
        raise BatchError(f"Non-numeric value in '{field}' for record '{row_id}': '{value}'")


def _read_csv(data: bytes, delimiter: str = ",") -> tuple[list[str], list[dict]]:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if reader.fieldnames is None:
        raise BatchError("Input CSV appears to be empty or has no header row.")
    headers = [h.strip() for h in reader.fieldnames]
    rows = [dict(row) for row in reader]
    if not rows:
        raise BatchError("Input CSV has no data rows.")
    if len(rows) > MAX_BATCH_ROWS:
        raise BatchError(f"Input has {len(rows)} rows; limit is {MAX_BATCH_ROWS}.")
    return headers, rows


def transform_batch(
    data: bytes,
    source: str,
    target: str,
    operation_index: int | None = None,
    id_col: str | None = None,
    x_col: str | None = None,
    y_col: str | None = None,
    delimiter: str = ",",
) -> dict:
    """Transform all coordinate rows in an uploaded CSV.

    Returns a summary plus one result per row with the transformed values and
    a WGS84 position for plotting on the map.
    """
    src = CRS.from_user_input(source)
    dst = CRS.from_user_input(target)

    headers, rows = _read_csv(data, delimiter)
    id_column, x_column, y_column = resolve_columns(headers, id_col, x_col, y_col)

    if operation_index is None:
        transformer = Transformer.from_crs(src, dst, always_xy=True)
        chosen = "default"
    else:
        group = TransformerGroup(src, dst, always_xy=True)
        transformer = group.transformers[operation_index]
        chosen = transformer.description

    src_ll = Transformer.from_crs(src, "EPSG:4326", always_xy=True)
    dst_ll = Transformer.from_crs(dst, "EPSG:4326", always_xy=True)

    results = []
    total = 0
    transformed = 0
    errors = 0

    for i, row in enumerate(rows, start=1):
        total += 1
        row_id = row.get(id_column, f"ROW_{i}")
        try:
            x = _parse_float(row.get(x_column, ""), x_column, row_id)
            y = _parse_float(row.get(y_column, ""), y_column, row_id)
            tx, ty = transformer.transform(x, y)
            lon, lat = dst_ll.transform(tx, ty)
            results.append(
                {
                    "row": i,
                    "id": str(row_id),
                    "x": x,
                    "y": y,
                    "transformed_x": tx,
                    "transformed_y": ty,
                    "lon": lon,
                    "lat": lat,
                    "status": "OK",
                }
            )
            transformed += 1
        except Exception as exc:
            errors += 1
            results.append(
                {
                    "row": i,
                    "id": str(row_id),
                    "x": row.get(x_column, ""),
                    "y": row.get(y_column, ""),
                    "transformed_x": None,
                    "transformed_y": None,
                    "lon": None,
                    "lat": None,
                    "status": f"ERROR: {exc}",
                }
            )

    csv_out = _build_output_csv(rows, results, id_column, x_column, y_column, target)

    return {
        "summary": {
            "total_rows": total,
            "transformed": transformed,
            "errors": errors,
            "source": {"name": src.name, "code": src.to_epsg()},
            "target": {"name": dst.name, "code": dst.to_epsg()},
            "chosen_operation": chosen,
            "columns": {"id": id_column, "x": x_column, "y": y_column},
            "date": DATE_STAMP,
        },
        "results": results,
        "csv": csv_out,
    }


def _build_output_csv(
    rows: list[dict],
    results: list[dict],
    id_column: str,
    x_column: str,
    y_column: str,
    target: str,
) -> str:
    target_epsg = CRS.from_user_input(target).to_epsg()
    target_str = f"EPSG:{target_epsg}" if target_epsg else target

    out_headers = list(rows[0].keys())
    out_headers.extend(["transformed_x", "transformed_y", "target_epsg", "transform_status"])

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=out_headers)
    writer.writeheader()
    for row, res in zip(rows, results):
        out = dict(row)
        out["transformed_x"] = f"{res['transformed_x']:.8f}" if res["transformed_x"] is not None else ""
        out["transformed_y"] = f"{res['transformed_y']:.8f}" if res["transformed_y"] is not None else ""
        out["target_epsg"] = target_str
        out["transform_status"] = "OK" if res["status"] == "OK" else res["status"]
        writer.writerow(out)
    return buf.getvalue()
