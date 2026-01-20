USE DATABASE METADATA_PLANNING;
USE SCHEMA SCORE;

CREATE OR REPLACE TABLE ASSESSMENT_RUN (
  run_id                 STRING NOT NULL,
  run_ts                 TIMESTAMP_NTZ NOT NULL,
  template_id            STRING NOT NULL,
  run_label              STRING,
  inputs_version_hash    STRING,
  PRIMARY KEY (run_id)
);

CREATE OR REPLACE TABLE ASSESSMENT_PARAMETER_RESULT (
  run_id                 STRING NOT NULL,
  template_id            STRING NOT NULL,
  asset_key              STRING NOT NULL,
  asset_type             STRING NOT NULL,
  parameter_id           STRING NOT NULL,
  parameter_key          STRING NOT NULL,
  required_flag          BOOLEAN NOT NULL,
  weight                 FLOAT NOT NULL,
  state                  STRING NOT NULL, -- PRESENT|ABSENT|UNKNOWN
  score                  FLOAT,           -- 1|0|NULL
  evidence_key_used      STRING,
  evidence_value         VARIANT,
  evidence_confidence    FLOAT,
  created_ts             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE ASSESSMENT_RESULT (
  run_id                 STRING NOT NULL,
  template_id            STRING NOT NULL,
  asset_key              STRING NOT NULL,
  asset_type             STRING NOT NULL,
  quality_score          FLOAT,
  coverage               FLOAT,
  confidence             FLOAT,
  qtriplet_score         FLOAT,
  status                 STRING, -- READY|IN_PROGRESS|INSUFFICIENT_EVIDENCE|FAILED_REQUIREMENT
  failed_required_count  INTEGER,
  created_ts             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (run_id, template_id, asset_key)
);
