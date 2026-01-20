USE DATABASE METADATA_PLANNING;
USE SCHEMA EVIDENCE;

CREATE OR REPLACE TABLE ASSET_UNIVERSE (
  asset_key              STRING NOT NULL,
  asset_type             STRING NOT NULL,
  domain_key             STRING,
  use_case_key           STRING,
  is_active              BOOLEAN DEFAULT TRUE,
  updated_ts             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (asset_key)
);

CREATE OR REPLACE TABLE EVIDENCE_OBSERVATION (
  observation_ts         TIMESTAMP_NTZ NOT NULL,
  source                 STRING NOT NULL,
  asset_key              STRING NOT NULL,
  asset_type             STRING NOT NULL,
  evidence_key           STRING NOT NULL,
  evidence_value         VARIANT,
  confidence             FLOAT DEFAULT 1.0
);

CREATE OR REPLACE VIEW LATEST_EVIDENCE AS
SELECT *
FROM (
  SELECT
    eo.*,
    ROW_NUMBER() OVER (
      PARTITION BY asset_key, evidence_key
      ORDER BY observation_ts DESC
    ) AS rn
  FROM EVIDENCE_OBSERVATION eo
)
WHERE rn = 1;
