### Proposed solution (fits your 2-step plan, with a few refinements)

- Part 1: Create a minimal test endpoint and page to validate end-to-end

  - Add a server-only API proxy in Next.js to call the Python service, validate inputs/outputs with Zod, and standardize errors.
  - Add a simple page with a tiny form to submit features (we can start with just age and BMI) and display the 8 returned counts. Include a health check.
  - This isolates model issues and ensures connectivity and validation before touching `@health-profile/`.

- Part 2: Integrate into `@health-profile/` without breaking current behavior
  - Keep the existing rules-based `calculateHealthcareUtilization` as a fallback.
  - Add a utilization model service in `lib/services/` that:
    - Maps `Member` → model `Features` (use what we have: age, BMI; leave the rest as None; the pipeline will handle NaNs).
    - Calls the new API proxy, validates response, applies caching with TTL.
    - Converts model outputs into the `HealthcareUtilization` structure expected by `UtilizationDisplay`.
  - Wire the page at `app/health-profile/page.tsx` to fetch predictions per member when minimal data exists (e.g., has age). Show baseline results immediately; replace with model results when ready; fall back on errors.
  - Preserve all existing UI components (`BasicInformation`, `LifestyleFactors`, `MedicalInformation`, `MemberCard`, `UtilizationAnalysis`) and their behavior.

### Key details

- Server-only proxy API (recommended path)

  - Add `app/api/utilization-model/predict/route.ts`.
  - Env var: `PY_UTILIZATION_BASE_URL` (default `http://127.0.0.1:8001`).
  - Endpoints:
    - POST `/api/utilization-model/predict` → forwards to `POST /predict`.
    - GET `/api/utilization-model/health` → forwards to `GET /health`.
  - Zod-validate both request and response per the 8 counts.

- Test page

  - Add `app/utilization-model-test/page.tsx`:
    - Simple form: age, BMI (optional), submit to API.
    - Display returned 8 counts.
    - “Health check” button to verify the Python server is up.

- Mapping model outputs to UI

  - Model returns: `pcp_visits`, `outpatient_visits`, `er_visits`, `inpatient_admits`, `home_health_visits`, `rx_fills`, `dental_visits`, `equipment_purchases`.
  - Map to display service types:
    - pcp_visits → “Primary care visit to treat an injury or illness”
    - outpatient_visits → “Outpatient visit”
    - er_visits → “Emergency room care”
    - inpatient_admits → “Hospital admissions”
    - home_health_visits → “Home health care”
    - rx_fills → “Prescription drugs”
    - dental_visits → “Dental visits”
    - equipment_purchases → “Durable medical equipment”
  - Build `HealthcareUtilization.predictions` from these labels with count as `annualVisits`.
  - Derive `totalVisits` as the sum.
  - Heuristic `costCategory` and `emergencyRisk` from counts (keep existing risk model as-is if desired).

- Service layer and caching

  - Add `lib/services/utilization-model-service.ts`:
    - `predictCounts(features)` calls the API with retry and Zod validation.
    - `mapMemberToModelFeatures(member)` returns a sparse feature object (age, BMI; others as undefined).
    - `toHealthcareUtilization(outputs, member)` converts counts to the structure used by `UtilizationDisplay`.
    - Implement simple in-memory cache with TTL (e.g., 24h) keyed by a stable hash of features. Optionally back with `cache()` to avoid recompute on server.
  - Do not call Python directly from components; always via this service + API route.

- Health profile integration

  - In `app/health-profile/page.tsx`, when a member has age (and optionally BMI), trigger a background fetch for predictions using the service.
  - While loading or on error, show existing rule-based utilization.
  - Once predictions arrive, replace the `utilization` object for that member with the model-driven one (preserve the rest of the UI: risk badges, toggles, etc.).
  - Add a lightweight toggle (dev-only flag) to switch between “Model” and “Rules” for debugging, but keep “Model first, Rules fallback” as default in production.

- Error handling and resilience (matches project rules)

  - Structured errors in the service; never surface raw Python errors to the client.
  - Timeouts and retries to the Python server.
  - If predictions fail, degrade gracefully to existing utilization engine.
  - Add a warning badge in UI when falling back (optional).

- Alignment with `health-profile-enhancement-plan.md`

  - Preserves Phase 1 & 2 outcomes, augments utilization with ML predictions.
  - Sets foundation for Phase 3 (AI integration) by standardizing the service pattern, validation, and caching.
  - Keeps the “Service Layer First” and multi-model/fallback standards.

- Ops/dev setup
  - Run Python service locally: `uvicorn python-models.server.server:app --host 127.0.0.1 --port 8001 --reload` or `python python-models/server/server.py`.
  - Add `.env.local`: `PY_UTILIZATION_BASE_URL=http://127.0.0.1:8001`.
  - Keep everything server-side; no keys are exposed.

If you’d like, I can scaffold the API route, service, and test page now, then wire `health-profile` to consume the predictions with fallback.

Summary

- Add server-only proxy API and env config for the Python model.
- Create a minimal test page to verify the 8-count outputs.
- Add a utilization model service to map `Member` → Features, call API with Zod validation and caching, convert outputs to existing `HealthcareUtilization`.
- Integrate into `@health-profile/` with “model-first, rules-fallback” behavior, preserving all current UI and interactions.

### How to run Part 1 locally

Quick start (recommended)

1. Start the Python model server (auto-venv + install + reload):

```bash
bun run py:dev
```

Notes:

- The script creates `python-models/.venv`, installs `python-models/requirements.txt`, and starts FastAPI with reload at `http://127.0.0.1:8001`.
- To change host/port, set env vars when running: `PY_HOST=0.0.0.0 PY_PORT=8002 bun run py:dev`.

2. Health check (in a second terminal):

```bash
bun run py:health
# → {"status":"ok"}
```

3. Example prediction (age + BMI):

```bash
bun run py:predict:example
# → { "pcp_visits": ..., "outpatient_visits": ..., ... }
```

4. Start the Next.js dev server:

```bash
bun run dev
```

5. Test end-to-end in the app:

```text
Visit /utilization-model-test
Click “Health Check” (should say healthy)
Enter Age (e.g., 45) and optional BMI (e.g., 27.5), then “Predict” to see 8 outputs
```

Optional: configure API base URL (defaults to `http://127.0.0.1:8001`):

```env
# .env.local
PY_UTILIZATION_BASE_URL=http://127.0.0.1:8001
```

Manual alternative

If you prefer not to use the repo scripts, you can run uvicorn directly:

```bash
python -m venv python-models/.venv
source python-models/.venv/bin/activate
pip install -r python-models/requirements.txt
uvicorn python-models.server.server:app --host 127.0.0.1 --port 8001 --reload
```
