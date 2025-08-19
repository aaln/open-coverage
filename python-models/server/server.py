"""
MEPS v2 Utilization Service (FastAPI)

Exposes two endpoints used by the Next.js app:
- GET /health: Verifies model registry can be loaded from `python-models/models/v2-pkl`.
- POST /predict: Accepts optional numeric features, assembles them in the
  expected column order, and runs saved joblib pipelines to produce annual
  utilization count predictions for multiple targets (pcp visits, outpatient,
  ER, inpatient admits, home health, Rx fills, dental, equipment).

Implementation details:
- Lazy-loads all target-specific pipelines on first request.
- Includes a shim for pickled preprocessing helpers (e.g., `neg_to_nan`) that
  may have been saved under `__mp_main__` during training.
- Coerces predictions to non-negative integers for stable downstream use.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(title="MEPS v2 Utilization Service", version="1.0.0")
# ---------------------------------------------------------------------------
# Compatibility shim for pickled pipelines
#
# Some training runs may have defined preprocessing helpers (e.g., `neg_to_nan`)
# in the `__mp_main__` module context (common when using multiprocessing).
# When unpickling with joblib, those attributes must be importable at the
# original qualified path. We provide a minimal implementation and register it
# under `__mp_main__` so that unpickling succeeds without retraining.
# ---------------------------------------------------------------------------
import sys
import types


def neg_to_nan(X):
    """
    Replace negative numeric values with NaN.

    Works with pandas Series/DataFrame or array-like inputs.
    """
    if isinstance(X, (pd.Series, pd.DataFrame)):
        return X.mask(X < 0)
    arr = np.asarray(X, dtype=float)
    arr = arr.copy()
    arr[arr < 0] = np.nan
    return arr


# Expose under the module path expected by the pickle, if applicable
mp_main = sys.modules.get("__mp_main__")
if mp_main is None:
    mp_main = types.ModuleType("__mp_main__")
    sys.modules["__mp_main__"] = mp_main
setattr(mp_main, "neg_to_nan", neg_to_nan)



# Targets modeled in MEPS v2
COUNT_TARGETS = [
    "pcp_visits",
    "outpatient_visits",
    "er_visits",
    "inpatient_admits",
    "home_health_visits",
    "rx_fills",
    "dental_visits",
    "equipment_purchases",
]


# Feature columns expected by the saved pipelines (order matters)
FEATURE_COLS = [
    "age_years_2022",
    "gender",
    "race_ethnicity",
    "hispanic_origin_category",
    "census_region",
    "education_years",
    "highest_degree_achieved",
    "family_income_2022",
    "poverty_level_pct",
    "poverty_category",
    "employment_status",
    "hours_worked_per_week",
    "occupation_industry_category",
    "family_size",
    "marital_status",
    "spouse_in_household",
    "insurance_coverage_type",
    "has_usual_source_of_care",
    "usual_care_location_type",
    "delayed_care_due_to_cost",
    "delayed_prescription_due_to_cost",
    "received_snap",
    "snap_benefit_value_2022",
    "bmi",
    "smoking_frequency",
    "alcohol_consumption_frequency",
    "exercise_days_per_week",
    "english_proficiency",
    "us_born_flag",
    "years_in_us",
    "difficulty_lifting_carrying",
    "difficulty_walking_stairs",
    "any_activity_limitation",
    "cognitive_limitation",
    "k6_distress_score",
    "hopelessness_frequency_30d",
    "sadness_frequency_30d",
]


class Features(BaseModel):
    # Define features as optional floats to allow NaNs; integers are acceptable as floats
    age_years_2022: Optional[float] = None
    gender: Optional[float] = None
    race_ethnicity: Optional[float] = None
    hispanic_origin_category: Optional[float] = None
    census_region: Optional[float] = None
    education_years: Optional[float] = None
    highest_degree_achieved: Optional[float] = None
    family_income_2022: Optional[float] = None
    poverty_level_pct: Optional[float] = None
    poverty_category: Optional[float] = None
    employment_status: Optional[float] = None
    hours_worked_per_week: Optional[float] = None
    occupation_industry_category: Optional[float] = None
    family_size: Optional[float] = None
    marital_status: Optional[float] = None
    spouse_in_household: Optional[float] = None
    insurance_coverage_type: Optional[float] = None
    has_usual_source_of_care: Optional[float] = None
    usual_care_location_type: Optional[float] = None
    delayed_care_due_to_cost: Optional[float] = None
    delayed_prescription_due_to_cost: Optional[float] = None
    received_snap: Optional[float] = None
    snap_benefit_value_2022: Optional[float] = None
    bmi: Optional[float] = None
    smoking_frequency: Optional[float] = None
    alcohol_consumption_frequency: Optional[float] = None
    exercise_days_per_week: Optional[float] = None
    english_proficiency: Optional[float] = None
    us_born_flag: Optional[float] = None
    years_in_us: Optional[float] = None
    difficulty_lifting_carrying: Optional[float] = None
    difficulty_walking_stairs: Optional[float] = None
    any_activity_limitation: Optional[float] = None
    cognitive_limitation: Optional[float] = None
    k6_distress_score: Optional[float] = None
    hopelessness_frequency_30d: Optional[float] = None
    sadness_frequency_30d: Optional[float] = None


# Lazy-loaded model registry
_MODELS: Dict[str, Any] | None = None


def _load_models() -> Dict[str, Any]:
    global _MODELS
    if _MODELS is not None:
        return _MODELS

    repo_root = Path(__file__).resolve().parents[2]
    models_dir = repo_root / "python-models" / "models" / "v2-pkl"
    if not models_dir.exists():
        raise RuntimeError(f"Models directory not found: {models_dir}")

    registry: Dict[str, Any] = {}
    for target in COUNT_TARGETS:
        model_path = models_dir / f"model_{target}.pkl"
        if not model_path.exists():
            raise RuntimeError(f"Missing model file: {model_path}")
        registry[target] = joblib.load(str(model_path))

    _MODELS = registry
    return registry


@app.get("/health")
def health() -> Dict[str, str]:
    try:
        _ = _load_models()
        return {"status": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
def predict(features: Features) -> Dict[str, int]:
    try:
        models = _load_models()

        # Ensure ordered columns; allow missing keys to be None
        row = {col: getattr(features, col) for col in FEATURE_COLS}
        X = pd.DataFrame([row], columns=FEATURE_COLS)

        outputs: Dict[str, int] = {}
        for target, pipe in models.items():
            # Each saved pipeline includes preprocessing and model
            pred_value = float(pipe.predict(X)[0])
            outputs[target] = max(0, int(round(pred_value)))

        return outputs
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Local dev runner: python python-models/server/main.py
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001, reload=True)


