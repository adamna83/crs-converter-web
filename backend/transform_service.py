# transform_service.py - coordinate conversion with selectable datum transformations.

"""Single-point coordinate transformation between any two EPSG CRS.

pyproj's TransformerGroup enumerates every candidate coordinate operation
(including the specific datum transformation, e.g. Kertau 1968 to WGS 84 (1)
= EPSG:1158 geocentric translations). Each candidate is a ready-to-use
Transformer, so applying a specific datum transformation is just picking an
entry from the group and calling transform().
"""

from __future__ import annotations

import logging

from pyproj import CRS, Transformer
from pyproj.enums import TransformDirection
from pyproj.transformer import TransformerGroup

logger = logging.getLogger("coord_web.transform")

WGS84 = "EPSG:4326"
MAX_OPERATIONS = 12


def resolve_crs(source: str, target: str) -> tuple[CRS, CRS]:
    """Parse and validate source/target CRS strings."""
    src = CRS.from_user_input(source)
    dst = CRS.from_user_input(target)
    return src, dst


def _operation_summary(candidate: Transformer) -> dict:
    """Human-readable summary of one TransformerGroup candidate."""
    steps = []
    for op in candidate.operations:
        step = {
            "name": op.name,
            "method": op.method_name,
            "method_code": getattr(op, "method_code", None),
            "accuracy": op.accuracy,
        }
        try:
            step["towgs84"] = op.towgs84
        except Exception:
            step["towgs84"] = None
        steps.append(step)
    return {
        "description": candidate.description,
        "steps": steps,
    }


def get_operations(source: str, target: str) -> list[dict]:
    """Enumerate candidate coordinate operations between two CRS."""
    src, dst = resolve_crs(source, target)
    group = TransformerGroup(src, dst, always_xy=True)
    candidates = group.transformers[:MAX_OPERATIONS]
    out = []
    for i, candidate in enumerate(candidates):
        item = _operation_summary(candidate)
        item["index"] = i
        out.append(item)
    return out


def transform_point(
    source: str,
    target: str,
    x: float,
    y: float,
    operation_index: int | None = None,
) -> dict:
    """Transform a single coordinate, optionally forcing a specific operation."""
    src, dst = resolve_crs(source, target)

    if operation_index is None:
        transformer = Transformer.from_crs(src, dst, always_xy=True)
        chosen = "default"
    else:
        group = TransformerGroup(src, dst, always_xy=True)
        transformer = group.transformers[operation_index]
        chosen = transformer.description

    tx, ty = transformer.transform(x, y)

    # Reproject both the source point and the result to WGS84 so the map
    # viewer can plot them without knowing the source/target projection.
    src_ll = Transformer.from_crs(src, WGS84, always_xy=True)
    dst_ll = Transformer.from_crs(dst, WGS84, always_xy=True)
    src_lon, src_lat = src_ll.transform(x, y)
    dst_lon, dst_lat = dst_ll.transform(tx, ty)

    return {
        "source": {"name": src.name, "code": src.to_epsg()},
        "target": {"name": dst.name, "code": dst.to_epsg()},
        "chosen_operation": chosen,
        "result": {"x": tx, "y": ty},
        "source_wgs84": {"lon": src_lon, "lat": src_lat},
        "target_wgs84": {"lon": dst_lon, "lat": dst_lat},
    }
