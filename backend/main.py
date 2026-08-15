# main.py - CRS Converter Web App API.

"""FastAPI backend for the CRS Converter Web App.

Run with:
    python -m uvicorn backend.main:app --reload --port 8000

The Vite dev server proxies /api requests here; CORS is also enabled so the
frontend can hit the API directly if needed.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import batch_service, crs_service, transform_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

app = FastAPI(title="CRS Converter Web App", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/crs/search")
def search_crs(q: Annotated[str, Query(min_length=1, max_length=100)]) -> dict:
    return {"results": crs_service.search_crs(q)}


@app.get("/api/crs/{code}")
def get_crs(code: int) -> dict:
    try:
        return crs_service.get_crs(code)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"EPSG:{code} not found")


@app.get("/api/operations")
def operations(
    source: str = Query(min_length=1),
    target: str = Query(min_length=1),
) -> dict:
    try:
        ops = transform_service.get_operations(source, target)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CRS pair: {exc}")
    return {"operations": ops}


@app.post("/api/transform")
def transform(
    source: str = Query(min_length=1),
    target: str = Query(min_length=1),
    x: float = Query(...),
    y: float = Query(...),
    operation_index: int | None = Query(default=None, ge=0),
) -> dict:
    try:
        return transform_service.transform_point(
            source, target, x, y, operation_index
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/transform/batch")
async def transform_batch(
    file: Annotated[UploadFile, File(...)],
    source: str = Form(...),
    target: str = Form(...),
    operation_index: int | None = Form(default=None),
    id_col: str | None = Form(default=None),
    x_col: str | None = Form(default=None),
    y_col: str | None = Form(default=None),
    delimiter: str = Form(default=","),
) -> dict:
    data = await file.read()
    try:
        return batch_service.transform_batch(
            data=data,
            source=source,
            target=target,
            operation_index=operation_index,
            id_col=id_col,
            x_col=x_col,
            y_col=y_col,
            delimiter=delimiter,
        )
    except batch_service.BatchError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
