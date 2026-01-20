USE DATABASE METADATA_PLANNING;
USE SCHEMA SCORE;

CREATE OR REPLACE PROCEDURE RUN_TEMPLATE_ASSESSMENT(TEMPLATE_ID_IN STRING, RUN_LABEL_IN STRING)
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
  RUN_ID STRING;
  RUN_TS TIMESTAMP_NTZ;
BEGIN
  RUN_ID := UUID_STRING();
  RUN_TS := CURRENT_TIMESTAMP();

  INSERT INTO SCORE.ASSESSMENT_RUN(run_id, run_ts, template_id, run_label)
  VALUES (:RUN_ID, :RUN_TS, :TEMPLATE_ID_IN, :RUN_LABEL_IN);

  INSERT INTO SCORE.ASSESSMENT_PARAMETER_RESULT (
    run_id, template_id, asset_key, asset_type,
    parameter_id, parameter_key, required_flag, weight,
    state, score,
    evidence_key_used, evidence_value, evidence_confidence
  )
  WITH tpl AS (
    SELECT * FROM INTENT.SCORING_TEMPLATE
    WHERE template_id = :TEMPLATE_ID_IN AND is_active = TRUE
  ),
  params AS (
    SELECT p.* FROM INTENT.SCORING_PARAMETER p JOIN tpl ON tpl.template_id = p.template_id
  ),
  assets AS (
    SELECT asset_key, asset_type FROM EVIDENCE.ASSET_UNIVERSE WHERE is_active = TRUE
  ),
  bindings AS (
    SELECT b.* FROM INTENT.TEMPLATE_BINDING b JOIN tpl ON tpl.template_id = b.template_id
  ),
  candidate AS (
    SELECT
      a.asset_key, a.asset_type,
      p.parameter_id, p.parameter_key, p.required_flag, p.weight, p.pass_condition,
      b.evidence_key, b.priority,
      le.evidence_value, le.confidence AS evidence_confidence,
      ROW_NUMBER() OVER (
        PARTITION BY a.asset_key, p.parameter_id
        ORDER BY b.priority ASC
      ) AS pick_one
    FROM assets a
    JOIN params p ON 1=1
    JOIN bindings b
      ON b.parameter_id = p.parameter_id
     AND b.asset_type = a.asset_type
    LEFT JOIN EVIDENCE.LATEST_EVIDENCE le
      ON le.asset_key = a.asset_key
     AND le.evidence_key = b.evidence_key
  ),
  picked AS (SELECT * FROM candidate WHERE pick_one = 1)
  SELECT
    :RUN_ID,
    :TEMPLATE_ID_IN,
    asset_key, asset_type,
    parameter_id, parameter_key, required_flag, weight,
    CASE
      WHEN evidence_value IS NULL THEN 'UNKNOWN'
      WHEN pass_condition = 'TRUTHY'  AND TRY_TO_BOOLEAN(evidence_value) = TRUE THEN 'PRESENT'
      WHEN pass_condition = 'TRUTHY'  AND TRY_TO_BOOLEAN(evidence_value) = FALSE THEN 'ABSENT'
      WHEN pass_condition = 'GT0'     AND TRY_TO_NUMBER(evidence_value) > 0 THEN 'PRESENT'
      WHEN pass_condition = 'GT0'     AND TRY_TO_NUMBER(evidence_value) <= 0 THEN 'ABSENT'
      WHEN pass_condition = 'GTE1'    AND TRY_TO_NUMBER(evidence_value) >= 1 THEN 'PRESENT'
      WHEN pass_condition = 'GTE1'    AND TRY_TO_NUMBER(evidence_value) < 1 THEN 'ABSENT'
      WHEN pass_condition = 'LEN_GT0' AND LENGTH(TRY_TO_VARCHAR(evidence_value)) > 0 THEN 'PRESENT'
      WHEN pass_condition = 'LEN_GT0' AND LENGTH(TRY_TO_VARCHAR(evidence_value)) = 0 THEN 'ABSENT'
      ELSE 'UNKNOWN'
    END AS state,
    CASE
      WHEN evidence_value IS NULL THEN NULL
      WHEN (
        (pass_condition='TRUTHY' AND TRY_TO_BOOLEAN(evidence_value)=TRUE) OR
        (pass_condition='GT0' AND TRY_TO_NUMBER(evidence_value)>0) OR
        (pass_condition='GTE1' AND TRY_TO_NUMBER(evidence_value)>=1) OR
        (pass_condition='LEN_GT0' AND LENGTH(TRY_TO_VARCHAR(evidence_value))>0)
      ) THEN 1
      WHEN (
        (pass_condition='TRUTHY' AND TRY_TO_BOOLEAN(evidence_value)=FALSE) OR
        (pass_condition='GT0' AND TRY_TO_NUMBER(evidence_value)<=0) OR
        (pass_condition='GTE1' AND TRY_TO_NUMBER(evidence_value)<1) OR
        (pass_condition='LEN_GT0' AND LENGTH(TRY_TO_VARCHAR(evidence_value))=0)
      ) THEN 0
      ELSE NULL
    END AS score,
    evidence_key AS evidence_key_used,
    evidence_value,
    COALESCE(evidence_confidence, 1.0)
  FROM picked;

  INSERT INTO SCORE.ASSESSMENT_RESULT (
    run_id, template_id, asset_key, asset_type,
    quality_score, coverage, confidence, qtriplet_score,
    status, failed_required_count
  )
  WITH tpl AS (
    SELECT * FROM INTENT.SCORING_TEMPLATE WHERE template_id = :TEMPLATE_ID_IN
  ),
  pr AS (
    SELECT * FROM SCORE.ASSESSMENT_PARAMETER_RESULT
    WHERE run_id = :RUN_ID AND template_id = :TEMPLATE_ID_IN
  ),
  agg AS (
    SELECT
      asset_key, asset_type,
      SUM(weight) AS total_weight,
      SUM(IFF(score IS NULL, 0, weight)) AS known_weight,
      SUM(IFF(score IS NULL, 0, weight * score)) AS weighted_num,
      AVG(IFF(score IS NULL, NULL, evidence_confidence)) AS conf_avg,
      SUM(IFF(required_flag AND state='ABSENT', 1, 0)) AS failed_required_count
    FROM pr
    GROUP BY 1,2
  )
  SELECT
    :RUN_ID,
    :TEMPLATE_ID_IN,
    asset_key,
    asset_type,
    IFF(known_weight=0, NULL, weighted_num/known_weight) AS quality_score,
    IFF(total_weight=0, NULL, known_weight/total_weight) AS coverage,
    COALESCE(conf_avg, 1.0) AS confidence,
    IFF(known_weight=0 OR total_weight=0, NULL,
      (weighted_num/known_weight) * (known_weight/total_weight) * COALESCE(conf_avg,1.0)
    ) AS qtriplet_score,
    CASE
      WHEN failed_required_count > 0 THEN 'FAILED_REQUIREMENT'
      WHEN known_weight = 0 THEN 'INSUFFICIENT_EVIDENCE'
      WHEN (SELECT methodology FROM tpl)='GATE' THEN
        CASE
          WHEN (weighted_num/NULLIF(known_weight,0)) >= COALESCE((SELECT quality_min FROM tpl), 0)
           AND (known_weight/NULLIF(total_weight,0)) >= COALESCE((SELECT coverage_min FROM tpl), 0)
           AND COALESCE(conf_avg,1.0)               >= COALESCE((SELECT confidence_min FROM tpl), 0)
          THEN 'READY' ELSE 'IN_PROGRESS' END
      ELSE 'IN_PROGRESS'
    END AS status,
    failed_required_count
  FROM agg;

  RETURN 'OK: run_id=' || :RUN_ID;
END;
$$;

CREATE OR REPLACE PROCEDURE RUN_ALL_ACTIVE_TEMPLATES(RUN_LABEL_IN STRING)
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE TID STRING; CNT INTEGER DEFAULT 0;
BEGIN
  FOR rec IN (SELECT template_id FROM INTENT.SCORING_TEMPLATE WHERE is_active = TRUE)
  DO
    TID := rec.template_id;
    CALL SCORE.RUN_TEMPLATE_ASSESSMENT(:TID, :RUN_LABEL_IN);
    CNT := CNT + 1;
  END FOR;
  RETURN 'OK: ran ' || CNT || ' templates';
END;
$$;

CREATE OR REPLACE VIEW TEMPLATE_CATALOG AS
SELECT
  t.template_id,
  t.template_name,
  t.template_version,
  t.methodology,
  t.is_active,
  COUNT(DISTINCT p.parameter_id) AS parameter_count,
  COUNT(DISTINCT b.binding_id)   AS binding_count
FROM INTENT.SCORING_TEMPLATE t
LEFT JOIN INTENT.SCORING_PARAMETER p ON p.template_id = t.template_id
LEFT JOIN INTENT.TEMPLATE_BINDING b  ON b.template_id = t.template_id
GROUP BY 1,2,3,4,5;
