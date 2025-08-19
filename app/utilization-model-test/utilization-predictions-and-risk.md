## Healthcare Utilization Prediction and Risk Assessment (Test Page)

This document explains how predictions from the Python model are transformed into the app’s healthcare utilization and risk metrics in `app/utilization-model-test/page.tsx`. It is a concise reference covering each derived metric and threshold used by the test page.

### Inputs sent to the model

- The page collects optional features and sanitizes them before calling the API:
  - `age_years_2022`: 0–120, integer
  - `bmi`: 10–100, number
  - `gender`, `race_ethnicity`, `census_region`, `employment_status`: numeric enums (string → Number)
  - `family_size`: 0–100, integer
  - `has_usual_source_of_care`, `difficulty_walking_stairs`, `any_activity_limitation`: 1/2 radio values → Number
  - `k6_distress_score`: 0–24, integer

### Model endpoints

- Health check: `GET /api/utilization-model/health`
- Predict: `POST /api/utilization-model/predict` with the sanitized features

### Model output (PredictResponse)

Annual counts returned by the API:

- `pcp_visits`
- `outpatient_visits`
- `er_visits`
- `inpatient_admits`
- `home_health_visits`
- `rx_fills`
- `dental_visits`
- `equipment_purchases`

Display label mapping in the grid:

- `er_visits` → ER Visits
- `pcp_visits` → Primary Care Visits
- `outpatient_visits` → Outpatient Visits
- `inpatient_admits` → Inpatient Admits
- `home_health_visits` → Home Health Visits
- `rx_fills` → Prescription Fills
- `dental_visits` → Dental Visits
- `equipment_purchases` → Equipment Purchases

### Mapping to HealthcareUtilization (used by `UtilizationDisplay`)

The page converts `PredictResponse` into a `HealthcareUtilization` object.

- predictions (`UtilizationPrediction[]`)

  - Created for each positive count in the response:
    - `pcp_visits` → "Primary care visit to treat an injury or illness"
    - `outpatient_visits` → "Outpatient visits"
    - `er_visits` → "Emergency room care"
    - `inpatient_admits` → "Inpatient admits"
    - `home_health_visits` → "Home health visits"
    - `dental_visits` → "Dental visits"
    - `rx_fills` → "Prescription drugs"
  - Severity per prediction (based on `annualVisits`):
    - `> 10` → `high`
    - `> 5` → `medium`
    - else → `low`
  - `reason`: "Model-predicted annual count"
  - `basedOn`: `"condition"`
  - Note: Equipment purchases are not added to `predictions`.

- totalVisits (integer)

  - Sum of `annualVisits` across predictions, excluding those whose `serviceType` includes "drug" (i.e., prescription drugs are excluded from visit totals).
  - Equipment purchases are also excluded.

- emergencyRisk (0–1)

  - `min(1, (er_visits + inpatient_admits) / 12)`

- costCategory (test-page thresholds)

  - `> 15` → `very_high`
  - `> 10` → `high`
  - `> 5` → `moderate`
  - else → `low`

- riskAssessment
  - Computed via `calculateRiskScore(memberCtx, emergencyRisk, predictions)` from `@/lib/utilization-engine`.
  - The page builds a minimal `memberCtx` from entered age, sex, BMI; other fields (conditions, medications, lifestyle) default to empty/undefined.

### Risk Assessment details (from `@/lib/utilization-engine`)

- overallScore (0–100): sum of weighted factors, capped at 100. Notable contributors:

  - Advanced age: +10 (age > 65) or +20 (age > 75)
  - Pediatric age (< 5): +10
  - Chronic conditions (Diabetes, Heart Disease, COPD, Kidney Disease, Cancer): up to +45 combined
  - Multiple conditions (> 3): +15
  - Polypharmacy (medications > 5): +10
  - Lifestyle: current smoker +15; heavy alcohol +12; sedentary (no exercise, age > 30) +8
  - BMI: obesity (> 30) +10 or +15 (> 35); underweight (< 18.5) +8
  - Emergency risk (> 0.2): +20
  - Pregnancy: normal +10; high-risk +25
  - Mental health conditions (Depression/Anxiety/ADHD/Bipolar): +10 or +15 if multiple

- riskLevel (by overallScore)

  - `>= 70` → `critical`
  - `>= 50` → `high`
  - `>= 30` → `moderate`
  - else → `low`

- recommendations (examples)
  - High/critical: consider comprehensive PPO or low-deductible plans; ensure out-of-pocket maximums are affordable
  - Chronic conditions: verify specialists in-network; check prescription formularies
  - Lifestyle risks: look for wellness programs; prioritize preventive benefits
  - Elevated ER risk (> 0.15): prioritize plans with reasonable ER copays

### Quick reference

- predictions: built from non-zero outputs; severity by thresholds (> 10, > 5)
- totalVisits: sum of non-drug predictions
- emergencyRisk: `min(1, (ER + inpatient) / 12)`
- costCategory: `very_high`/`high`/`moderate`/`low` using > 15, > 10, > 5
- riskAssessment: overallScore (0–100), riskLevel, factors[], recommendations[]
