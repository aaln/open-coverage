"use client";

/*
  Utilization Model Test Page
  - Purpose: Simple client UI to validate the end-to-end utilization prediction flow.
  - Actions:
    - "Health Check" calls `/api/utilization-model/health` to ensure the Python FastAPI
      service and models are available.
    - "Predict" posts minimal features (e.g., age, BMI) to `/api/utilization-model/predict`
      and displays the returned annual utilization counts.
  - Note: The "use client" directive must remain the first statement in this file.
*/

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UtilizationDisplay } from "@/components/utilization-display";
import type { Member } from "@/lib/health-profile-store";
import type {
  HealthcareUtilization,
  UtilizationPrediction,
} from "@/lib/utilization-engine";
import { calculateRiskScore } from "@/lib/utilization-engine";
import { useState } from "react";

type PredictResponse = {
  pcp_visits: number;
  outpatient_visits: number;
  er_visits: number;
  inpatient_admits: number;
  home_health_visits: number;
  rx_fills: number;
  dental_visits: number;
  equipment_purchases: number;
};

export default function UtilizationModelTestPage() {
  const [age, setAge] = useState<string>("");
  const [bmi, setBmi] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [raceEthnicity, setRaceEthnicity] = useState<string>("");
  const [censusRegion, setCensusRegion] = useState<string>("");
  const [employmentStatus, setEmploymentStatus] = useState<string>("");
  const [familySize, setFamilySize] = useState<string>("");
  const [hasUsualSourceOfCare, setHasUsualSourceOfCare] = useState<string>("");
  const [difficultyWalkingStairs, setDifficultyWalkingStairs] =
    useState<string>("");
  const [anyActivityLimitation, setAnyActivityLimitation] =
    useState<string>("");
  const [k6DistressScore, setK6DistressScore] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string>("");
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [utilization, setUtilization] = useState<HealthcareUtilization | null>(
    null
  );

  function buildMemberContext(): Member {
    const ageStr = age?.toString() ?? "";
    const parsedAge = ageStr ? ageStr : "";
    const parsedGender =
      gender === "1" ? "male" : gender === "2" ? "female" : "prefer_not_to_say";
    const bmiNum = bmi ? Number(bmi) : undefined;
    return {
      id: "utilization-test-member",
      age: parsedAge,
      gender: parsedGender as Member["gender"],
      pregnancyStatus: undefined,
      height: undefined,
      weight: undefined,
      bmi: bmiNum,
      smokingStatus: undefined,
      alcoholUse: undefined,
      exerciseFrequency: undefined,
      conditions: [],
      medications: [],
      allergies: [],
      visits: [],
      otherServices: [],
    };
  }

  function mapToHealthcareUtilization(
    resp: PredictResponse,
    memberCtx: Member
  ): HealthcareUtilization {
    const toPred = (
      serviceType: string,
      annualVisits: number
    ): UtilizationPrediction => ({
      serviceType,
      annualVisits,
      severity:
        annualVisits > 10 ? "high" : annualVisits > 5 ? "medium" : "low",
      reason: "Model-predicted annual count",
      basedOn: "condition",
    });

    const preds: UtilizationPrediction[] = [];
    if (resp.pcp_visits > 0)
      preds.push(
        toPred(
          "Primary care visit to treat an injury or illness",
          resp.pcp_visits
        )
      );
    if (resp.outpatient_visits > 0)
      preds.push(toPred("Outpatient visits", resp.outpatient_visits));
    if (resp.er_visits > 0)
      preds.push(toPred("Emergency room care", resp.er_visits));
    if (resp.inpatient_admits > 0)
      preds.push(toPred("Inpatient admits", resp.inpatient_admits));
    if (resp.home_health_visits > 0)
      preds.push(toPred("Home health visits", resp.home_health_visits));
    if (resp.dental_visits > 0)
      preds.push(toPred("Dental visits", resp.dental_visits));
    // Count Rx as medications; grouped via "drug" keyword
    if (resp.rx_fills > 0)
      preds.push(toPred("Prescription drugs", resp.rx_fills));
    // Equipment purchases are not visits; omit from total visit counts and detailed cards by default

    const totalVisits = preds
      .filter((p) => !p.serviceType.toLowerCase().includes("drug"))
      .reduce(
        (s, p) => s + (typeof p.annualVisits === "number" ? p.annualVisits : 0),
        0
      );

    const emergencyRisk = Math.min(
      1,
      (resp.er_visits + resp.inpatient_admits) / 12
    );
    const costCategory =
      totalVisits > 15
        ? "very_high"
        : totalVisits > 10
        ? "high"
        : totalVisits > 5
        ? "moderate"
        : "low";
    const riskAssessment = calculateRiskScore(memberCtx, emergencyRisk, preds);

    return {
      predictions: preds,
      totalVisits,
      emergencyRisk,
      costCategory,
      primaryConditions: [],
      recommendations: [],
      riskAssessment,
    };
  }
  const [error, setError] = useState<string>("");

  async function checkHealth() {
    setHealthStatus("checking...");
    setError("");
    try {
      const res = await fetch("/api/utilization-model/health");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || "Service error");
      setHealthStatus("Python service is healthy");
    } catch (e: any) {
      setHealthStatus("");
      setError(e?.message || "Health check failed");
    }
  }

  async function predict() {
    setLoading(true);
    setError("");
    try {
      const features: Record<string, any> = {};
      if (age.trim()) {
        const ageNum = Number(age);
        const clampedAge = Math.min(120, Math.max(0, Math.floor(ageNum)));
        features.age_years_2022 = clampedAge;
      }
      if (bmi.trim()) {
        const bmiNum = Number(bmi);
        const clampedBmi = Math.min(100, Math.max(10, bmiNum));
        features.bmi = clampedBmi;
      }
      if (gender.trim()) features.gender = Number(gender);
      if (raceEthnicity.trim()) features.race_ethnicity = Number(raceEthnicity);
      if (censusRegion.trim()) features.census_region = Number(censusRegion);
      if (employmentStatus.trim())
        features.employment_status = Number(employmentStatus);
      if (familySize.trim()) features.family_size = Number(familySize);
      if (hasUsualSourceOfCare.trim())
        features.has_usual_source_of_care = Number(hasUsualSourceOfCare);
      if (difficultyWalkingStairs.trim())
        features.difficulty_walking_stairs = Number(difficultyWalkingStairs);
      if (anyActivityLimitation.trim())
        features.any_activity_limitation = Number(anyActivityLimitation);
      if (k6DistressScore.trim())
        features.k6_distress_score = Number(k6DistressScore);

      const res = await fetch("/api/utilization-model/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(features),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || "Prediction failed");
      setResult(json as PredictResponse);
      // Build utilization object for shared UI
      const memberCtx = buildMemberContext();
      const mapped = mapToHealthcareUtilization(
        json as PredictResponse,
        memberCtx
      );
      setUtilization(mapped);
    } catch (e: any) {
      setError(e?.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Utilization Model Test</h1>
        <Button variant="outline" onClick={checkHealth}>
          Health Check
        </Button>
      </div>
      {healthStatus && (
        <div className="text-sm text-green-700">{healthStatus}</div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Enter Optional Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Age (years) (0-120)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                step={1}
                value={age}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "") {
                    setAge("");
                    return;
                  }
                  const num = Number(next);
                  if (Number.isNaN(num)) return;
                  const clamped = Math.min(120, Math.max(0, Math.floor(num)));
                  setAge(clamped.toString());
                }}
                placeholder="e.g., 45"
              />
            </div>
            <div>
              <Label className="text-sm">BMI (10-100)</Label>
              <Input
                type="number"
                min={10}
                max={100}
                step="any"
                value={bmi}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "") {
                    setBmi("");
                    return;
                  }
                  const num = Number(next);
                  if (Number.isNaN(num)) return;
                  const clamped = Math.min(100, Math.max(10, num));
                  setBmi(clamped.toString());
                }}
                placeholder="e.g., 27.5"
              />
            </div>
            <div>
              <Label className="text-sm">Sex</Label>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value)}
                className="mt-2 flex items-center gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="sex-male" value="1" />
                  <Label htmlFor="sex-male" className="text-sm">
                    Male
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="sex-female" value="2" />
                  <Label htmlFor="sex-female" className="text-sm">
                    Female
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-sm">Race/Ethnicity</Label>
              <Select value={raceEthnicity} onValueChange={setRaceEthnicity}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Select race/ethnicity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">HISPANIC</SelectItem>
                  <SelectItem value="2">NON-HISPANIC WHITE ONLY</SelectItem>
                  <SelectItem value="3">NON-HISPANIC BLACK ONLY</SelectItem>
                  <SelectItem value="4">NON-HISPANIC ASIAN ONLY</SelectItem>
                  <SelectItem value="5">
                    NON-HISPANIC OTHER RACE OR MULTIPLE RACE
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">U.S. Region</Label>
              <Select value={censusRegion} onValueChange={setCensusRegion}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Northeast</SelectItem>
                  <SelectItem value="2">Midwest</SelectItem>
                  <SelectItem value="3">South</SelectItem>
                  <SelectItem value="4">West</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Employment Status</Label>
              <Select
                value={employmentStatus}
                onValueChange={setEmploymentStatus}
              >
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Select employment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Employed</SelectItem>
                  <SelectItem value="2">Job To Return To</SelectItem>
                  <SelectItem value="3">Job During</SelectItem>
                  <SelectItem value="4">Not Employed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Family Size (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={familySize}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "") {
                    setFamilySize("");
                    return;
                  }
                  const num = Number(next);
                  if (Number.isNaN(num)) return;
                  const clamped = Math.min(100, Math.max(0, Math.floor(num)));
                  setFamilySize(clamped.toString());
                }}
                placeholder="e.g., 4"
              />
            </div>
            <div>
              <Label className="text-sm">Usual Source of Care</Label>
              <RadioGroup
                value={hasUsualSourceOfCare}
                onValueChange={(value) => setHasUsualSourceOfCare(value)}
                className="mt-2 flex items-center gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="usual-care-yes" value="1" />
                  <Label htmlFor="usual-care-yes" className="text-sm">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="usual-care-no" value="2" />
                  <Label htmlFor="usual-care-no" className="text-sm">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-sm">Difficulty Walking/Stairs</Label>
              <RadioGroup
                value={difficultyWalkingStairs}
                onValueChange={(value) => setDifficultyWalkingStairs(value)}
                className="mt-2 flex items-center gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="walking-difficulty-yes" value="1" />
                  <Label htmlFor="walking-difficulty-yes" className="text-sm">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="walking-difficulty-no" value="2" />
                  <Label htmlFor="walking-difficulty-no" className="text-sm">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-sm">Any Activity Limitation</Label>
              <RadioGroup
                value={anyActivityLimitation}
                onValueChange={(value) => setAnyActivityLimitation(value)}
                className="mt-2 flex items-center gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="activity-limitation-yes" value="1" />
                  <Label htmlFor="activity-limitation-yes" className="text-sm">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="activity-limitation-no" value="2" />
                  <Label htmlFor="activity-limitation-no" className="text-sm">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-sm">
                K6 Psychological Distress (0-24)
              </Label>
              <Input
                type="number"
                min={0}
                max={24}
                step={1}
                value={k6DistressScore}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "") {
                    setK6DistressScore("");
                    return;
                  }
                  const num = Number(next);
                  if (Number.isNaN(num)) return;
                  const clamped = Math.min(24, Math.max(0, Math.floor(num)));
                  setK6DistressScore(clamped.toString());
                }}
                placeholder="e.g., 8"
              />
            </div>
          </div>
          <Button onClick={predict} disabled={loading} className="w-full">
            {loading ? "Predicting..." : "Predict"}
          </Button>
        </CardContent>
      </Card>

      {utilization && (
        <>
          {/* Predictions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Model Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {result &&
                  Object.entries(result).map(([key, value]) => {
                    // Custom label mapping for better readability
                    const getLabel = (key: string) => {
                      switch (key) {
                        case "er_visits":
                          return "ER Visits";
                        case "pcp_visits":
                          return "Primary Care Visits";
                        case "outpatient_visits":
                          return "Outpatient Visits";
                        case "inpatient_admits":
                          return "Inpatient Admits";
                        case "home_health_visits":
                          return "Home Health Visits";
                        case "rx_fills":
                          return "Prescription Fills";
                        case "dental_visits":
                          return "Dental Visits";
                        case "equipment_purchases":
                          return "Equipment Purchases";
                        default:
                          return key.replace(/_/g, " ");
                      }
                    };

                    return (
                      <div
                        key={key}
                        className="text-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="text-2xl font-bold text-blue-600">
                          {value}
                        </div>
                        <div className="text-xs text-gray-600">
                          {getLabel(key)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Existing Utilization Display */}
          <UtilizationDisplay
            utilization={utilization}
            memberName={(() => {
              const ageStr = age ? `${age}` : undefined;
              const sex =
                gender === "1" ? "Male" : gender === "2" ? "Female" : null;
              return [
                "Member",
                ageStr ? `(Age ${ageStr})` : null,
                sex ? `• ${sex}` : null,
              ]
                .filter(Boolean)
                .join(" ");
            })()}
          />
        </>
      )}
    </div>
  );
}
