# crs_service.py - CRS database search and lookup backed by pyproj's EPSG database.

"""Search and describe EPSG coordinate reference systems using pyproj.

The full EPSG database is enumerated once at import time (about 6k CRS,
takes ~0.3s) and cached. Searching filters in-memory so the UI can offer
fast autocomplete over every projected and geographic CRS.
"""

from __future__ import annotations

import logging

from pyproj import CRS
from pyproj.database import query_crs_info
from pyproj.enums import PJType

logger = logging.getLogger("coord_web.crs")

# CRS kinds the app exposes. Projected CRS are the primary use case; the
# geographic 2D set covers common targets like EPSG:4326.
_CRS_TYPES = (PJType.PROJECTED_CRS, PJType.GEOGRAPHIC_2D_CRS)

# List of (code, name, type_name, area_of_use_name, projection_method).
_INDEX: list[dict] = []
_BY_CODE: dict[int, dict] = {}
MAX_RESULTS = 50


def _index_crs() -> None:
    """Build the in-memory EPSG index once at startup."""
    global _INDEX, _BY_CODE
    infos = list(
        query_crs_info(
            auth_name="EPSG",
            pj_types=_CRS_TYPES,
            allow_deprecated=False,
        )
    )
    for info in infos:
        code = int(info.code)
        entry = {
            "code": code,
            "name": info.name,
            "type": info.type.name if hasattr(info.type, "name") else str(info.type),
            "area": info.area_of_use.name if info.area_of_use else None,
            "method": getattr(info, "projection_method_name", None),
        }
        _INDEX.append(entry)
        _BY_CODE[code] = entry
    logger.info("indexed %d EPSG CRS", len(_INDEX))


_index_crs()


def search_crs(query: str, limit: int = MAX_RESULTS) -> list[dict]:
    """Return CRS entries matching a code or name substring.

    A bare integer query matches the exact EPSG code first, then any codes
    that contain the digits. Non-numeric queries are case-insensitive
    substring matches on the name.
    """
    q = query.strip()
    if not q:
        return []

    results: list[dict] = []
    seen: set[int] = set()

    def add(entry: dict) -> bool:
        if entry["code"] in seen:
            return False
        seen.add(entry["code"])
        results.append(entry)
        return True

    if q.isdigit():
        # Exact code first.
        entry = _BY_CODE.get(int(q))
        if entry is not None:
            add(entry)
        if len(results) >= limit:
            return results
        # Then codes containing the digits (covers ranges like 32648).
        for e in _INDEX:
            if str(e["code"]).find(q) >= 0:
                add(e)
                if len(results) >= limit:
                    return results
        return results

    ql = q.lower()
    # Names are tokenized; match if every whitespace token is contained.
    tokens = [tok for tok in ql.split() if tok]
    for e in _INDEX:
        name = e["name"].lower()
        if all(tok in name for tok in tokens):
            add(e)
            if len(results) >= limit:
                return results
    return results


def get_crs(code: int) -> dict:
    """Return detail fields for a single EPSG code.

    Raises KeyError when the code is not a known, non-deprecated CRS.
    """
    base = _BY_CODE.get(code)
    if base is None:
        raise KeyError(f"EPSG:{code} not found in index")

    crs = CRS.from_epsg(code)
    detail = dict(base)
    detail["is_geographic"] = crs.is_geographic
    detail["is_projected"] = crs.is_projected

    aou = crs.area_of_use
    detail["area_bounds"] = (
        {"west": aou.west, "south": aou.south, "east": aou.east, "north": aou.north}
        if aou is not None and aou.west is not None
        else None
    )
    detail["axis_info"] = [
        {"name": ax.name, "abbrev": ax.abbrev, "direction": ax.direction}
        for ax in crs.axis_info
    ]
    try:
        detail["proj4"] = crs.to_proj4()
    except Exception:  # some CRS cannot be serialized to proj4
        detail["proj4"] = None
    try:
        detail["wkt"] = crs.to_wkt()
    except Exception:
        detail["wkt"] = None
    return detail
