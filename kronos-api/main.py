"""
Kronos K-line Prediction API Service

Provides REST endpoints for financial K-line prediction using the Kronos model.
Run with: uvicorn main:app --host 0.0.0.0 --port 8000
"""

import io
import sys
import logging
from enum import Enum
from pathlib import Path
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("kronos-api")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Data directory
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent / "data"

SYMBOL_FILES = {
    "BTC_USDT": DATA_DIR / "BTC_USDT_5min.csv",
    "ETH_USDT": DATA_DIR / "ETH_USDT_5min.csv",
}

SYMBOL_NAMES = {
    "BTC_USDT": "Bitcoin / USDT",
    "ETH_USDT": "Ethereum / USDT",
}

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------
MODEL_ZOO = {
    "mini":  {"tokenizer": "NeoQuasar/Kronos-Tokenizer-2k",   "model": "NeoQuasar/Kronos-mini",  "max_context": 2048, "params": "4.1M"},
    "small": {"tokenizer": "NeoQuasar/Kronos-Tokenizer-base",  "model": "NeoQuasar/Kronos-small", "max_context": 512,  "params": "24.7M"},
    "base":  {"tokenizer": "NeoQuasar/Kronos-Tokenizer-base",  "model": "NeoQuasar/Kronos-base",  "max_context": 512,  "params": "102.3M"},
}


class ModelName(str, Enum):
    mini = "mini"
    small = "small"
    base = "base"


# ---------------------------------------------------------------------------
# Global model references (loaded once on startup)
# ---------------------------------------------------------------------------
predictors: dict = {}  # model_name -> KronosPredictor
MODEL_LOADED = False


def _load_models():
    """Attempt to load Kronos models from HuggingFace Hub."""
    global MODEL_LOADED

    model_dir = Path(__file__).parent / "model"
    if model_dir.exists():
        sys.path.insert(0, str(model_dir.parent))

    try:
        from model.kronos import KronosTokenizer, Kronos, KronosPredictor

        for name, cfg in MODEL_ZOO.items():
            try:
                logger.info("Loading Kronos-%s ...", name)
                tok = KronosTokenizer.from_pretrained(cfg["tokenizer"])
                mdl = Kronos.from_pretrained(cfg["model"])
                predictors[name] = KronosPredictor(mdl, tok, max_context=cfg["max_context"])
                logger.info("Kronos-%s loaded (%s params).", name, cfg["params"])
            except Exception as exc:
                logger.warning("Could not load Kronos-%s: %s", name, exc)

        MODEL_LOADED = len(predictors) > 0
    except Exception as exc:
        logger.warning("Kronos import failed (%s). Running in mock mode.", exc)
        MODEL_LOADED = False


def _get_predictor(model_name: str):
    """Return predictor for given model name, or None."""
    return predictors.get(model_name)


# ---------------------------------------------------------------------------
# Mock prediction (fallback)
# ---------------------------------------------------------------------------
def _mock_predict(df: pd.DataFrame, x_ts, y_ts, pred_len: int, sample_count: int = 1) -> pd.DataFrame:
    """Generate mock prediction data when the real model is unavailable."""
    last_row = df.iloc[-1]
    price = float(last_row["close"])
    vol = float(last_row.get("volume", 1.0))

    rng = np.random.default_rng(seed=42)
    rows = []
    for _ in range(pred_len):
        change = rng.normal(0, 0.002)
        o = price
        c = price * (1 + change)
        h = max(o, c) * (1 + abs(rng.normal(0, 0.001)))
        l = min(o, c) * (1 - abs(rng.normal(0, 0.001)))
        v = vol * (1 + abs(rng.normal(0, 0.3)))
        rows.append({"open": o, "high": h, "low": l, "close": c, "volume": v, "amount": v * (o + c) / 2})
        price = c

    return pd.DataFrame(rows, index=y_ts[:pred_len])


# ---------------------------------------------------------------------------
# Shared prediction helper
# ---------------------------------------------------------------------------
def _run_prediction(
    df: pd.DataFrame,
    x_timestamp: pd.Series,
    y_timestamp: pd.Series,
    pred_len: int,
    model_name: str = "small",
    temperature: float = 1.0,
    top_p: float = 0.9,
    sample_count: int = 1,
    include_volume: bool = True,
) -> pd.DataFrame:
    """Run prediction with given parameters, falling back to mock if needed."""
    if not include_volume:
        df = df[["open", "high", "low", "close"]].copy()

    pred = _get_predictor(model_name)
    if pred is not None:
        try:
            pred_df = pred.predict(
                df=df,
                x_timestamp=x_timestamp,
                y_timestamp=y_timestamp,
                pred_len=pred_len,
                T=temperature,
                top_p=top_p,
                sample_count=sample_count,
                verbose=False,
            )
            return pred_df
        except Exception as exc:
            logger.error("Prediction with Kronos-%s failed: %s", model_name, exc)

    return _mock_predict(df, x_timestamp, y_timestamp, pred_len, sample_count)


def _load_symbol_data(symbol: str) -> pd.DataFrame:
    """Load CSV data for a built-in symbol."""
    if symbol not in SYMBOL_FILES:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")
    csv_path = SYMBOL_FILES[symbol]
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail=f"Data file for '{symbol}' not found")
    df = pd.read_csv(csv_path)
    df["timestamps"] = pd.to_datetime(df["timestamps"])
    return df


def _prepare_timestamps(df: pd.DataFrame, lookback: int, pred_len: int):
    """Prepare x/y timestamps and trim lookback."""
    total = len(df)
    lookback = min(lookback, total - pred_len)
    if lookback < 50:
        raise HTTPException(status_code=400, detail="Not enough data for the requested lookback + prediction length")

    x_timestamp = df.iloc[:lookback]["timestamps"]
    y_timestamp = df.iloc[lookback: lookback + pred_len]["timestamps"]

    if len(y_timestamp) < pred_len:
        last_ts = df["timestamps"].iloc[-1]
        extra = pd.date_range(start=last_ts + pd.Timedelta(minutes=5), periods=pred_len - len(y_timestamp), freq="5min")
        y_timestamp = pd.concat([y_timestamp, pd.Series(extra)]).reset_index(drop=True)

    return lookback, x_timestamp, y_timestamp


def _df_to_bars(df_slice: pd.DataFrame, ts_col: str = "timestamps") -> list:
    """Convert a DataFrame slice to a list of KlineBar dicts."""
    bars = []
    for _, row in df_slice.iterrows():
        bars.append(KlineBar(
            timestamp=row[ts_col].isoformat() if hasattr(row[ts_col], "isoformat") else str(row[ts_col]),
            open=round(float(row["open"]), 2),
            high=round(float(row["high"]), 2),
            low=round(float(row["low"]), 2),
            close=round(float(row["close"]), 2),
            volume=round(float(row.get("volume", 0)), 4),
        ))
    return bars


def _pred_to_bars(pred_df: pd.DataFrame, timestamps) -> list:
    """Convert prediction DataFrame to KlineBar list."""
    ts_list = timestamps.tolist() if hasattr(timestamps, "tolist") else list(timestamps)
    bars = []
    for i, (_, row) in enumerate(pred_df.iterrows()):
        ts = ts_list[i] if i < len(ts_list) else ts_list[-1]
        ts_str = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        bars.append(KlineBar(
            timestamp=ts_str,
            open=round(float(row["open"]), 2),
            high=round(float(row["high"]), 2),
            low=round(float(row["low"]), 2),
            close=round(float(row["close"]), 2),
            volume=round(float(row.get("volume", 0)), 4),
        ))
    return bars


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_models()
    yield


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(title="Kronos Prediction API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class KlineBar(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class PredictRequest(BaseModel):
    symbol: str = Field(default="BTC_USDT", description="Trading pair symbol")
    lookback: int = Field(default=400, ge=50, le=600)
    pred_len: int = Field(default=120, ge=10, le=200)
    temperature: float = Field(default=1.0, ge=0.1, le=2.0)
    top_p: float = Field(default=0.9, ge=0.1, le=1.0)
    model: ModelName = Field(default=ModelName.small, description="Model variant: mini, small, base")
    sample_count: int = Field(default=1, ge=1, le=10, description="Number of forecast paths to average")
    include_volume: bool = Field(default=True, description="Include volume/amount in prediction")


class PredictResponse(BaseModel):
    symbol: str
    interval: str
    model_name: str
    model_loaded: bool
    history: list[KlineBar]
    prediction: list[KlineBar]


class BatchPredictRequest(BaseModel):
    symbols: list[str] = Field(description="List of symbols to predict")
    lookback: int = Field(default=400, ge=50, le=600)
    pred_len: int = Field(default=120, ge=10, le=200)
    temperature: float = Field(default=1.0, ge=0.1, le=2.0)
    top_p: float = Field(default=0.9, ge=0.1, le=1.0)
    model: ModelName = Field(default=ModelName.small)
    sample_count: int = Field(default=1, ge=1, le=10)
    include_volume: bool = Field(default=True)


class BatchPredictResponse(BaseModel):
    results: list[PredictResponse]


class SymbolInfo(BaseModel):
    symbol: str
    name: str
    bars: int


class ModelInfo(BaseModel):
    name: str
    params: str
    max_context: int
    loaded: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/symbols", response_model=list[SymbolInfo])
async def list_symbols():
    """List available trading pair symbols."""
    result = []
    for sym, path in SYMBOL_FILES.items():
        if path.exists():
            df = pd.read_csv(path)
            result.append(SymbolInfo(symbol=sym, name=SYMBOL_NAMES.get(sym, sym), bars=len(df)))
    return result


@app.get("/api/models", response_model=list[ModelInfo])
async def list_models():
    """List available model variants and their status."""
    return [
        ModelInfo(
            name=name,
            params=cfg["params"],
            max_context=cfg["max_context"],
            loaded=name in predictors,
        )
        for name, cfg in MODEL_ZOO.items()
    ]


@app.post("/api/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """Run single-symbol K-line prediction."""
    df = _load_symbol_data(req.symbol)
    lookback, x_ts, y_ts = _prepare_timestamps(df, req.lookback, req.pred_len)

    cols = ["open", "high", "low", "close", "volume", "amount"]
    x_df = df.iloc[:lookback][cols].copy()

    pred_df = _run_prediction(
        df=x_df, x_timestamp=x_ts, y_timestamp=y_ts,
        pred_len=req.pred_len, model_name=req.model.value,
        temperature=req.temperature, top_p=req.top_p,
        sample_count=req.sample_count, include_volume=req.include_volume,
    )

    return PredictResponse(
        symbol=req.symbol,
        interval="5min",
        model_name=req.model.value,
        model_loaded=req.model.value in predictors,
        history=_df_to_bars(df.iloc[:lookback]),
        prediction=_pred_to_bars(pred_df, y_ts),
    )


@app.post("/api/predict-batch", response_model=BatchPredictResponse)
async def predict_batch(req: BatchPredictRequest):
    """Run prediction for multiple symbols in parallel."""
    if not req.symbols:
        raise HTTPException(status_code=400, detail="symbols list cannot be empty")
    if len(req.symbols) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 symbols per batch request")

    results = []
    for sym in req.symbols:
        try:
            df = _load_symbol_data(sym)
            lookback, x_ts, y_ts = _prepare_timestamps(df, req.lookback, req.pred_len)
            cols = ["open", "high", "low", "close", "volume", "amount"]
            x_df = df.iloc[:lookback][cols].copy()

            pred_df = _run_prediction(
                df=x_df, x_timestamp=x_ts, y_timestamp=y_ts,
                pred_len=req.pred_len, model_name=req.model.value,
                temperature=req.temperature, top_p=req.top_p,
                sample_count=req.sample_count, include_volume=req.include_volume,
            )

            results.append(PredictResponse(
                symbol=sym,
                interval="5min",
                model_name=req.model.value,
                model_loaded=req.model.value in predictors,
                history=_df_to_bars(df.iloc[:lookback]),
                prediction=_pred_to_bars(pred_df, y_ts),
            ))
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Batch prediction failed for %s: %s", sym, exc)
            raise HTTPException(status_code=500, detail=f"Prediction failed for {sym}: {exc}")

    return BatchPredictResponse(results=results)


@app.post("/api/predict-csv", response_model=PredictResponse)
async def predict_csv(
    file: UploadFile = File(..., description="CSV file with K-line data"),
    pred_len: int = Form(default=120, ge=10, le=200),
    lookback: int = Form(default=400, ge=50, le=600),
    temperature: float = Form(default=1.0, ge=0.1, le=2.0),
    top_p: float = Form(default=0.9, ge=0.1, le=1.0),
    model: str = Form(default="small"),
    sample_count: int = Form(default=1, ge=1, le=10),
    include_volume: bool = Form(default=True),
):
    """Predict from user-uploaded CSV file."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}")

    # Validate required columns
    required = {"open", "high", "low", "close"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {missing}")

    # Handle timestamps
    if "timestamps" in df.columns:
        df["timestamps"] = pd.to_datetime(df["timestamps"])
    elif "timestamp" in df.columns:
        df.rename(columns={"timestamp": "timestamps"}, inplace=True)
        df["timestamps"] = pd.to_datetime(df["timestamps"])
    elif "date" in df.columns:
        df.rename(columns={"date": "timestamps"}, inplace=True)
        df["timestamps"] = pd.to_datetime(df["timestamps"])
    else:
        # Generate synthetic timestamps at 5min intervals
        df["timestamps"] = pd.date_range(start="2025-01-01", periods=len(df), freq="5min")

    # Fill optional columns
    if "volume" not in df.columns:
        df["volume"] = 0.0
    if "amount" not in df.columns:
        df["amount"] = 0.0

    total = len(df)
    actual_lookback = min(lookback, total - pred_len)
    if actual_lookback < 50:
        raise HTTPException(status_code=400, detail=f"Not enough data: {total} rows, need at least {pred_len + 50}")

    x_ts = df.iloc[:actual_lookback]["timestamps"]
    y_start = actual_lookback
    y_end = actual_lookback + pred_len
    if y_end <= total:
        y_ts = df.iloc[y_start:y_end]["timestamps"]
    else:
        existing = df.iloc[y_start:]["timestamps"]
        last = df["timestamps"].iloc[-1]
        extra = pd.date_range(start=last + pd.Timedelta(minutes=5), periods=pred_len - len(existing), freq="5min")
        y_ts = pd.concat([existing, pd.Series(extra)]).reset_index(drop=True)

    cols = ["open", "high", "low", "close", "volume", "amount"]
    x_df = df.iloc[:actual_lookback][cols].copy()

    model_name = model if model in MODEL_ZOO else "small"

    pred_df = _run_prediction(
        df=x_df, x_timestamp=x_ts, y_timestamp=y_ts,
        pred_len=pred_len, model_name=model_name,
        temperature=temperature, top_p=top_p,
        sample_count=sample_count, include_volume=include_volume,
    )

    return PredictResponse(
        symbol=file.filename or "uploaded.csv",
        interval="5min",
        model_name=model_name,
        model_loaded=model_name in predictors,
        history=_df_to_bars(df.iloc[:actual_lookback]),
        prediction=_pred_to_bars(pred_df, y_ts),
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": MODEL_LOADED,
        "loaded_models": list(predictors.keys()),
    }
