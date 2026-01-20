USE DATABASE METADATA_PLANNING;
USE SCHEMA INTENT;

CREATE OR REPLACE TABLE SCORING_TEMPLATE (
  template_id            STRING NOT NULL,
  template_name          STRING NOT NULL,
  template_version       STRING NOT NULL,
  scope_type             STRING NOT NULL,
  methodology            STRING NOT NULL, -- WEIGHTED | UNWEIGHTED | GATE
  quality_min            FLOAT,
  coverage_min           FLOAT,
  confidence_min         FLOAT,
  is_active              BOOLEAN DEFAULT TRUE,
  created_ts             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_ts             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (template_id)
);

CREATE OR REPLACE TABLE SCORING_PARAMETER (
  parameter_id           STRING NOT NULL,
  template_id            STRING NOT NULL,
  parameter_key          STRING NOT NULL,
  parameter_label        STRING,
  weight                 FLOAT DEFAULT 1.0,
  required_flag          BOOLEAN DEFAULT FALSE,
  aggregation            STRING DEFAULT 'BOOL', -- BOOL|COUNT|LENGTH|NUM
  pass_condition         STRING DEFAULT 'TRUTHY', -- TRUTHY|GT0|GTE1|LEN_GT0
  created_ts             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (parameter_id),
  FOREIGN KEY (template_id) REFERENCES SCORING_TEMPLATE(template_id)
);

CREATE OR REPLACE TABLE TEMPLATE_BINDING (
  binding_id             STRING NOT NULL,
  template_id            STRING NOT NULL,
  parameter_id           STRING NOT NULL,
  asset_type             STRING NOT NULL,
  evidence_key           STRING NOT NULL,
  priority               INTEGER DEFAULT 1,
  created_ts             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (binding_id),
  FOREIGN KEY (template_id) REFERENCES SCORING_TEMPLATE(template_id),
  FOREIGN KEY (parameter_id) REFERENCES SCORING_PARAMETER(parameter_id)
);
