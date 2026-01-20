USE DATABASE METADATA_PLANNING;
USE SCHEMA SCORE;

CREATE OR REPLACE TABLE EVIDENCE_GAP_POLICY (
  evidence_key              STRING NOT NULL,
  policy_decision           STRING NOT NULL, -- FIX|ACCEPT_UNKNOWN|DEPRECATE|REPLACE
  rationale                 STRING,
  recommended_source        STRING,
  recommended_method        STRING,
  confidence_target         FLOAT,
  applies_to_connectors     ARRAY,
  effective_from_ts         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  effective_to_ts           TIMESTAMP_NTZ,
  is_active                 BOOLEAN DEFAULT TRUE,
  created_ts                TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_ts                TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (evidence_key)
);

CREATE OR REPLACE VIEW EVIDENCE_GAP_SNAPSHOT AS
WITH needed AS (
  SELECT DISTINCT tb.evidence_key, st.template_id, st.template_name, sp.required_flag, sp.weight
  FROM INTENT.TEMPLATE_BINDING tb
  JOIN INTENT.SCORING_TEMPLATE st ON st.template_id=tb.template_id AND st.is_active=TRUE
  JOIN INTENT.SCORING_PARAMETER sp ON sp.parameter_id=tb.parameter_id
),
available AS (SELECT DISTINCT evidence_key FROM EVIDENCE.EVIDENCE_OBSERVATION)
SELECT n.*, TRUE AS is_missing
FROM needed n
LEFT JOIN available a ON a.evidence_key=n.evidence_key
WHERE a.evidence_key IS NULL;

CREATE OR REPLACE VIEW EVIDENCE_GAP_REPORT AS
SELECT
  s.evidence_key, s.template_id, s.template_name, s.required_flag, s.weight,
  p.policy_decision, p.recommended_source, p.recommended_method, p.confidence_target, p.rationale,
  IFF(p.evidence_key IS NULL,'UNDECIDED','DECIDED') AS decision_state
FROM SCORE.EVIDENCE_GAP_SNAPSHOT s
LEFT JOIN SCORE.EVIDENCE_GAP_POLICY p ON p.evidence_key=s.evidence_key AND p.is_active=TRUE
ORDER BY s.required_flag DESC, s.template_id, s.evidence_key;

CREATE OR REPLACE VIEW EVIDENCE_REMEDIATION_OBSERVED AS
WITH policy AS (SELECT * FROM SCORE.EVIDENCE_GAP_POLICY WHERE is_active=TRUE),
avail AS (SELECT DISTINCT evidence_key FROM EVIDENCE.EVIDENCE_OBSERVATION)
SELECT p.*, IFF(a.evidence_key IS NOT NULL, TRUE, FALSE) AS evidence_now_present
FROM policy p LEFT JOIN avail a ON a.evidence_key=p.evidence_key;
