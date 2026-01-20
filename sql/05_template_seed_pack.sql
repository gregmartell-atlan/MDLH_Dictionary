USE DATABASE METADATA_PLANNING;
USE SCHEMA INTENT;

-- ============================================================
-- Template 1: Foundations (WEIGHTED)
-- ============================================================
INSERT INTO SCORING_TEMPLATE(template_id, template_name, template_version, scope_type, methodology, is_active)
SELECT 'TPL_FOUNDATIONS', 'Metadata Foundations', 'v1', 'ASSET', 'WEIGHTED', TRUE
WHERE NOT EXISTS (SELECT 1 FROM SCORING_TEMPLATE WHERE template_id='TPL_FOUNDATIONS');

INSERT INTO SCORING_PARAMETER(parameter_id, template_id, parameter_key, parameter_label, weight, required_flag, aggregation, pass_condition)
SELECT * FROM VALUES
  ('PAR_FND_OWNER',   'TPL_FOUNDATIONS', 'owner.exists',            'Owner assigned',             1.0, TRUE,  'BOOL',   'TRUTHY'),
  ('PAR_FND_DESC',    'TPL_FOUNDATIONS', 'description.present',     'Description present',        0.7, FALSE, 'LENGTH', 'LEN_GT0'),
  ('PAR_FND_TAGS',    'TPL_FOUNDATIONS', 'tags.count',              'Tags present',               0.3, FALSE, 'COUNT',  'GT0'),
  ('PAR_FND_CUST',    'TPL_FOUNDATIONS', 'custom_metadata.present', 'Custom metadata present',    0.3, FALSE, 'BOOL',   'TRUTHY'),
  ('PAR_FND_CERT',    'TPL_FOUNDATIONS', 'certification.present',   'Certification present',      0.4, FALSE, 'BOOL',   'TRUTHY'),
  ('PAR_FND_README',  'TPL_FOUNDATIONS', 'readme.present',          'README present',             0.2, FALSE, 'BOOL',   'TRUTHY')
WHERE NOT EXISTS (SELECT 1 FROM SCORING_PARAMETER WHERE template_id='TPL_FOUNDATIONS');

INSERT INTO TEMPLATE_BINDING(binding_id, template_id, parameter_id, asset_type, evidence_key, priority)
SELECT * FROM VALUES
  ('BND_FND_1', 'TPL_FOUNDATIONS', 'PAR_FND_OWNER',  'TABLE',  'atlan.owner.exists',             1),
  ('BND_FND_2', 'TPL_FOUNDATIONS', 'PAR_FND_DESC',   'TABLE',  'atlan.description.length',       1),
  ('BND_FND_3', 'TPL_FOUNDATIONS', 'PAR_FND_TAGS',   'TABLE',  'atlan.tags.count',               1),
  ('BND_FND_4', 'TPL_FOUNDATIONS', 'PAR_FND_CUST',   'TABLE',  'atlan.custom_metadata.present',  1),
  ('BND_FND_5', 'TPL_FOUNDATIONS', 'PAR_FND_CERT',   'TABLE',  'atlan.certification.present',    1),
  ('BND_FND_6', 'TPL_FOUNDATIONS', 'PAR_FND_README', 'TABLE',  'atlan.readme.present',            1),

  ('BND_FND_7', 'TPL_FOUNDATIONS', 'PAR_FND_OWNER',  'COLUMN', 'atlan.owner.exists',             1),
  ('BND_FND_8', 'TPL_FOUNDATIONS', 'PAR_FND_DESC',   'COLUMN', 'atlan.description.length',       1),
  ('BND_FND_9', 'TPL_FOUNDATIONS', 'PAR_FND_TAGS',   'COLUMN', 'atlan.tags.count',               1),
  ('BND_FND_10','TPL_FOUNDATIONS', 'PAR_FND_CUST',   'COLUMN', 'atlan.custom_metadata.present',  1),
  ('BND_FND_11','TPL_FOUNDATIONS', 'PAR_FND_CERT',   'COLUMN', 'atlan.certification.present',    1),
  ('BND_FND_12','TPL_FOUNDATIONS', 'PAR_FND_README', 'COLUMN', 'atlan.readme.present',            1)
WHERE NOT EXISTS (SELECT 1 FROM TEMPLATE_BINDING WHERE template_id='TPL_FOUNDATIONS');

-- ============================================================
-- Template 2: Lineage Readiness (WEIGHTED)
-- ============================================================
INSERT INTO SCORING_TEMPLATE(template_id, template_name, template_version, scope_type, methodology, is_active)
SELECT 'TPL_LINEAGE', 'Lineage Readiness', 'v1', 'ASSET', 'WEIGHTED', TRUE
WHERE NOT EXISTS (SELECT 1 FROM SCORING_TEMPLATE WHERE template_id='TPL_LINEAGE');

INSERT INTO SCORING_PARAMETER(parameter_id, template_id, parameter_key, parameter_label, weight, required_flag, aggregation, pass_condition)
SELECT * FROM VALUES
  ('PAR_LIN_UP',     'TPL_LINEAGE', 'lineage.upstream.count',   'Upstream lineage exists',     1.0, TRUE,  'COUNT', 'GT0'),
  ('PAR_LIN_DOWN',   'TPL_LINEAGE', 'lineage.downstream.count', 'Downstream lineage exists',   0.7, FALSE, 'COUNT', 'GT0'),
  ('PAR_LIN_FRESH',  'TPL_LINEAGE', 'lineage.freshness.days',   'Lineage freshness (days)',    0.3, FALSE, 'NUM',   'GTE1'),
  ('PAR_LIN_JOB',    'TPL_LINEAGE', 'lineage.job.count',        'Jobs/flows captured',         0.5, FALSE, 'COUNT', 'GT0')
WHERE NOT EXISTS (SELECT 1 FROM SCORING_PARAMETER WHERE template_id='TPL_LINEAGE');

INSERT INTO TEMPLATE_BINDING(binding_id, template_id, parameter_id, asset_type, evidence_key, priority)
SELECT * FROM VALUES
  ('BND_LIN_1', 'TPL_LINEAGE', 'PAR_LIN_UP',    'TABLE', 'atlan.lineage.upstream.count',    1),
  ('BND_LIN_2', 'TPL_LINEAGE', 'PAR_LIN_DOWN',  'TABLE', 'atlan.lineage.downstream.count',  1),
  ('BND_LIN_3', 'TPL_LINEAGE', 'PAR_LIN_FRESH', 'TABLE', 'atlan.lineage.freshness.days',    1),
  ('BND_LIN_4', 'TPL_LINEAGE', 'PAR_LIN_JOB',   'TABLE', 'atlan.lineage.job.count',         1)
WHERE NOT EXISTS (SELECT 1 FROM TEMPLATE_BINDING WHERE template_id='TPL_LINEAGE');

-- ============================================================
-- Template 3: Joinability (WEIGHTED) - Snowflake is truth
-- ============================================================
INSERT INTO SCORING_TEMPLATE(template_id, template_name, template_version, scope_type, methodology, is_active)
SELECT 'TPL_JOINABILITY', 'Joinability', 'v1', 'ASSET', 'WEIGHTED', TRUE
WHERE NOT EXISTS (SELECT 1 FROM SCORING_TEMPLATE WHERE template_id='TPL_JOINABILITY');

INSERT INTO SCORING_PARAMETER(parameter_id, template_id, parameter_key, parameter_label, weight, required_flag, aggregation, pass_condition)
SELECT * FROM VALUES
  ('PAR_JN_PK',     'TPL_JOINABILITY', 'joinability.pk.present', 'Primary key present',          1.0, TRUE,  'BOOL',  'TRUTHY'),
  ('PAR_JN_FK',     'TPL_JOINABILITY', 'joinability.fk.count',   'Foreign keys exist',           0.8, FALSE, 'COUNT', 'GT0'),
  ('PAR_JN_RELS',   'TPL_JOINABILITY', 'joinability.rels.count', 'Relationships known (Atlan)',  0.6, FALSE, 'COUNT', 'GT0')
WHERE NOT EXISTS (SELECT 1 FROM SCORING_PARAMETER WHERE template_id='TPL_JOINABILITY');

INSERT INTO TEMPLATE_BINDING(binding_id, template_id, parameter_id, asset_type, evidence_key, priority)
SELECT * FROM VALUES
  ('BND_JN_1', 'TPL_JOINABILITY', 'PAR_JN_PK',   'TABLE', 'snowflake.pk.present',       1),
  ('BND_JN_2', 'TPL_JOINABILITY', 'PAR_JN_FK',   'TABLE', 'snowflake.fk.count',         1),
  ('BND_JN_3', 'TPL_JOINABILITY', 'PAR_JN_RELS', 'TABLE', 'atlan.relationships.count',  1)
WHERE NOT EXISTS (SELECT 1 FROM TEMPLATE_BINDING WHERE template_id='TPL_JOINABILITY');

-- ============================================================
-- Template 4: Policy & PII Controls (WEIGHTED)
-- ============================================================
INSERT INTO SCORING_TEMPLATE(template_id, template_name, template_version, scope_type, methodology, is_active)
SELECT 'TPL_POLICY_PII', 'Policy & PII Controls', 'v1', 'ASSET', 'WEIGHTED', TRUE
WHERE NOT EXISTS (SELECT 1 FROM SCORING_TEMPLATE WHERE template_id='TPL_POLICY_PII');

INSERT INTO SCORING_PARAMETER(parameter_id, template_id, parameter_key, parameter_label, weight, required_flag, aggregation, pass_condition)
SELECT * FROM VALUES
  ('PAR_PII_TAG',    'TPL_POLICY_PII', 'policy.pii.tagged',      'PII classified/tagged',          1.0, TRUE,  'BOOL',  'TRUTHY'),
  ('PAR_PII_STEWARD','TPL_POLICY_PII', 'policy.steward.exists',  'Steward assigned',              0.7, TRUE,  'BOOL',  'TRUTHY'),
  ('PAR_PII_POL',    'TPL_POLICY_PII', 'policy.linked.exists',   'Policy linked',                 0.7, TRUE,  'BOOL',  'TRUTHY'),
  ('PAR_PII_MASK',   'TPL_POLICY_PII', 'policy.masking.present', 'Masking/protection present',    0.6, FALSE, 'BOOL',  'TRUTHY'),
  ('PAR_PII_COLCNT', 'TPL_POLICY_PII', 'pii.columns.count',      'PII columns identified',        0.4, FALSE, 'COUNT', 'GT0')
WHERE NOT EXISTS (SELECT 1 FROM SCORING_PARAMETER WHERE template_id='TPL_POLICY_PII');

INSERT INTO TEMPLATE_BINDING(binding_id, template_id, parameter_id, asset_type, evidence_key, priority)
SELECT * FROM VALUES
  ('BND_PII_1', 'TPL_POLICY_PII', 'PAR_PII_TAG',     'TABLE',  'atlan.classification.pii',   1),
  ('BND_PII_2', 'TPL_POLICY_PII', 'PAR_PII_STEWARD', 'TABLE',  'atlan.steward.exists',       1),
  ('BND_PII_3', 'TPL_POLICY_PII', 'PAR_PII_POL',     'TABLE',  'atlan.policy.linked.exists', 1),
  ('BND_PII_4', 'TPL_POLICY_PII', 'PAR_PII_MASK',    'TABLE',  'snowflake.masking.present',  1),
  ('BND_PII_5', 'TPL_POLICY_PII', 'PAR_PII_COLCNT',  'TABLE',  'atlan.pii.columns.count',    1),

  ('BND_PII_6', 'TPL_POLICY_PII', 'PAR_PII_TAG',     'COLUMN', 'atlan.classification.pii',   1),
  ('BND_PII_7', 'TPL_POLICY_PII', 'PAR_PII_MASK',    'COLUMN', 'snowflake.masking.present',  1)
WHERE NOT EXISTS (SELECT 1 FROM TEMPLATE_BINDING WHERE template_id='TPL_POLICY_PII');

-- ============================================================
-- Template 5: Talk-to-Data Gate (GATE)
-- ============================================================
INSERT INTO SCORING_TEMPLATE(template_id, template_name, template_version, scope_type, methodology, quality_min, coverage_min, confidence_min, is_active)
SELECT 'TPL_T2D_GATE', 'Talk-to-Data Agent Readiness (Gate)', 'v1', 'ASSET', 'GATE', 0.75, 0.70, 0.80, TRUE
WHERE NOT EXISTS (SELECT 1 FROM SCORING_TEMPLATE WHERE template_id='TPL_T2D_GATE');

INSERT INTO SCORING_PARAMETER(parameter_id, template_id, parameter_key, parameter_label, weight, required_flag, aggregation, pass_condition)
SELECT * FROM VALUES
  ('PAR_T2D_OWNER',  'TPL_T2D_GATE', 'owner.exists',                 'Owner assigned',                 1.0, TRUE,  'BOOL',   'TRUTHY'),
  ('PAR_T2D_DESC',   'TPL_T2D_GATE', 'description.present',          'Description present',            0.6, FALSE, 'LENGTH', 'LEN_GT0'),
  ('PAR_T2D_LINE',   'TPL_T2D_GATE', 'lineage.upstream.count',       'Upstream lineage exists',        1.0, TRUE,  'COUNT',  'GT0'),
  ('PAR_T2D_JOIN',   'TPL_T2D_GATE', 'joinability.fk.count',         'Foreign keys exist',             0.7, FALSE, 'COUNT',  'GT0'),
  ('PAR_T2D_PII',    'TPL_T2D_GATE', 'policy.pii.tagged',            'PII classified/tagged',          1.0, TRUE,  'BOOL',   'TRUTHY'),
  ('PAR_T2D_GLOSS',  'TPL_T2D_GATE', 'semantic.glossary.links.count','Glossary links exist',           0.6, FALSE, 'COUNT',  'GT0'),
  ('PAR_T2D_METRIC', 'TPL_T2D_GATE', 'semantic.metrics.count',       'Metrics/semantic layer exists',  0.3, FALSE, 'COUNT',  'GT0')
WHERE NOT EXISTS (SELECT 1 FROM SCORING_PARAMETER WHERE template_id='TPL_T2D_GATE');

INSERT INTO TEMPLATE_BINDING(binding_id, template_id, parameter_id, asset_type, evidence_key, priority)
SELECT * FROM VALUES
  ('BND_T2D_1', 'TPL_T2D_GATE', 'PAR_T2D_OWNER',  'TABLE', 'atlan.owner.exists',           1),
  ('BND_T2D_2', 'TPL_T2D_GATE', 'PAR_T2D_DESC',   'TABLE', 'atlan.description.length',     1),
  ('BND_T2D_3', 'TPL_T2D_GATE', 'PAR_T2D_LINE',   'TABLE', 'atlan.lineage.upstream.count', 1),
  ('BND_T2D_4', 'TPL_T2D_GATE', 'PAR_T2D_JOIN',   'TABLE', 'snowflake.fk.count',           1),
  ('BND_T2D_5', 'TPL_T2D_GATE', 'PAR_T2D_PII',    'TABLE', 'atlan.classification.pii',     1),
  ('BND_T2D_6', 'TPL_T2D_GATE', 'PAR_T2D_GLOSS',  'TABLE', 'atlan.glossary.links.count',   1),
  ('BND_T2D_7', 'TPL_T2D_GATE', 'PAR_T2D_METRIC', 'TABLE', 'semantic.metrics.count',       2)
WHERE NOT EXISTS (SELECT 1 FROM TEMPLATE_BINDING WHERE template_id='TPL_T2D_GATE');
