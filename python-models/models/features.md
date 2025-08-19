| **Category**               | **Feature**                 | **Variable Name**           | **Description**                                    |
| -------------------------- | --------------------------- | --------------------------- | -------------------------------------------------- |
| **Identifiers**            | Person ID                   | `person_id`                 | Unique person identifier (for merges)              |
| **Demographics**           | Age                         | `age_years_2022`            | Age as of 12/31/2022 (imputed)                     |
|                            | Sex                         | `gender`                    | Survey-reported gender (1 = Male, 2 = Female)      |
|                            | Race/Ethnicity              | `race_ethnicity`            | Detailed race and ethnicity categories             |
|                            | Region                      | `census_region`             | Census region (Northeast, Midwest, South, West)    |
| **Socioeconomic**          | Employment Status           | `employment_status`         | Employed full-/part-time vs. unemployed/inactive   |
|                            | Family Size                 | `family_size`               | Number of people in the family unit                |
| **Access & Utilization**   | Usual Source of Care        | `has_usual_source_of_care`  | Has a usual source of medical care                 |
| **Behaviors & Lifestyle**  | BMI                         | `bmi`                       | Body Mass Index (>17) from Round 4/5               |
| **Functional & Cognitive** | Difficulty Walking/Stairs   | `difficulty_walking_stairs` | Serious difficulty walking or climbing stairs      |
|                            | Any Activity Limitation     | `any_activity_limitation`   | Any limitation in usual activities due to health   |
|                            | Psychological Distress (K6) | `k6_distress_score`         | Kessler 6-item psychological distress score (0–24) |
| **Outcome**                | Total Expenditures (target) | `total_expenditures_2022`   | Sum of all payments in 2022                        |
