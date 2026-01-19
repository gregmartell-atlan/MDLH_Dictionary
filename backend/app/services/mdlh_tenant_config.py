"""
MDLH Tenant Configuration Service

Discovers MDLH schema from Snowflake and reconciles canonical fields
to actual MDLH columns, producing tenant configuration mappings.
"""

import logging
from typing import Dict, List, Optional, Set, Any
from datetime import datetime
import snowflake.connector

logger = logging.getLogger(__name__)

# MDLH canonical fields based on MDLH Foundation reference
MDLH_CANONICAL_FIELDS = {
    'guid': {
        'id': 'guid',
        'displayName': 'GUID',
        'description': 'Universal primary key for joins',
        'mdlhColumns': ['GUID'],
        'category': 'identity',
    },
    'asset_name': {
        'id': 'asset_name',
        'displayName': 'Asset Name',
        'description': 'Name of the asset',
        'mdlhColumns': ['ASSET_NAME', 'NAME'],
        'category': 'identity',
    },
    'asset_type': {
        'id': 'asset_type',
        'displayName': 'Asset Type',
        'description': 'Type of asset (Table, View, Column, etc.)',
        'mdlhColumns': ['ASSET_TYPE', 'TYPE_NAME'],
        'category': 'identity',
    },
    'asset_qualified_name': {
        'id': 'asset_qualified_name',
        'displayName': 'Qualified Name',
        'description': 'Fully qualified name of the asset',
        'mdlhColumns': ['ASSET_QUALIFIED_NAME', 'QUALIFIED_NAME'],
        'category': 'identity',
    },
    'description': {
        'id': 'description',
        'displayName': 'Description',
        'description': 'Short prose description of the asset',
        'mdlhColumns': ['DESCRIPTION', 'USER_DESCRIPTION'],
        'category': 'documentation',
    },
    'owner_users': {
        'id': 'owner_users',
        'displayName': 'Owner Users',
        'description': 'Individual users accountable for the asset',
        'mdlhColumns': ['OWNER_USERS', 'OWNERUSERS'],
        'category': 'ownership',
    },
    'owner_groups': {
        'id': 'owner_groups',
        'displayName': 'Owner Groups',
        'description': 'Teams or groups accountable for the asset',
        'mdlhColumns': ['OWNER_GROUPS', 'OWNERGROUPS'],
        'category': 'ownership',
    },
    'tags': {
        'id': 'tags',
        'displayName': 'Tags',
        'description': 'Tags assigned to the asset',
        'mdlhColumns': ['TAGS'],
        'category': 'governance',
    },
    'term_guids': {
        'id': 'term_guids',
        'displayName': 'Term GUIDs',
        'description': 'GUIDs of glossary terms linked to the asset',
        'mdlhColumns': ['TERM_GUIDS', 'TERMGUIDS'],
        'category': 'governance',
    },
    'has_lineage': {
        'id': 'has_lineage',
        'displayName': 'Has Lineage',
        'description': 'Asset has upstream or downstream lineage',
        'mdlhColumns': ['HAS_LINEAGE', 'HASLINEAGE'],
        'category': 'lineage',
    },
    'certificate_status': {
        'id': 'certificate_status',
        'displayName': 'Certificate Status',
        'description': 'Certification status of the asset',
        'mdlhColumns': ['CERTIFICATE_STATUS', 'CERTIFICATESTATUS'],
        'category': 'governance',
    },
    'popularity_score': {
        'id': 'popularity_score',
        'displayName': 'Popularity Score',
        'description': 'Usage popularity score',
        'mdlhColumns': ['POPULARITY_SCORE', 'POPULARITYSCORE'],
        'category': 'usage',
    },
    'readme_guid': {
        'id': 'readme_guid',
        'displayName': 'README GUID',
        'description': 'GUID of linked README documentation',
        'mdlhColumns': ['README_GUID', 'READMEGUID'],
        'category': 'documentation',
    },
    'connector_name': {
        'id': 'connector_name',
        'displayName': 'Connector Name',
        'description': 'Name of the data source connector',
        'mdlhColumns': ['CONNECTOR_NAME', 'CONNECTORNAME'],
        'category': 'identity',
    },
    'status': {
        'id': 'status',
        'displayName': 'Status',
        'description': 'Asset status (ACTIVE, DELETED, etc.)',
        'mdlhColumns': ['STATUS'],
        'category': 'identity',
    },
    'query_count': {
        'id': 'query_count',
        'displayName': 'Query Count',
        'description': 'Number of queries executed against this asset',
        'mdlhColumns': ['QUERY_COUNT', 'QUERYCOUNT'],
        'category': 'usage',
    },
    'query_user_count': {
        'id': 'query_user_count',
        'displayName': 'Query User Count',
        'description': 'Number of unique users who queried this asset',
        'mdlhColumns': ['QUERY_USER_COUNT', 'QUERYUSERCOUNT'],
        'category': 'usage',
    },
}


def discover_mdlh_schema(
    conn: snowflake.connector.SnowflakeConnection,
    database: str,
    schema: str
) -> Dict[str, Any]:
    """
    Discover MDLH schema from Snowflake.
    
    Returns:
        {
            'tables': List of table info,
            'columns': Dict mapping table_name -> List of column info,
            'customMetadata': List of custom metadata definitions,
            'classifications': List of classification definitions,
            'domains': List of domain definitions,
            'discoveredAt': ISO timestamp
        }
    """
    logger.info(f"Discovering MDLH schema in {database}.{schema}")
    
    cursor = conn.cursor()
    
    try:
        # Discover all tables in the schema
        safe_db = _validate_identifier(database)
        safe_schema_literal = schema.replace("'", "''")
        
        cursor.execute(f"""
            SELECT 
                table_name,
                table_type,
                row_count,
                comment
            FROM {safe_db}.INFORMATION_SCHEMA.TABLES
            WHERE table_schema = '{safe_schema_literal}'
            AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_name
        """)
        
        tables = []
        columns_by_table = {}
        
        for row in cursor.fetchall():
            table_name = row[0]
            table_type = row[1]
            row_count = row[2]
            comment = row[3]
            
            tables.append({
                'name': table_name,
                'type': table_type,
                'rowCount': row_count,
                'comment': comment,
            })
            
            # Discover columns for this table
            try:
                safe_table = _validate_identifier(table_name)
                cursor.execute(f"DESCRIBE TABLE {safe_db}.{safe_schema_literal}.{safe_table}")
                
                table_columns = []
                for col_row in cursor.fetchall():
                    table_columns.append({
                        'name': col_row[0],
                        'type': col_row[1],
                        'nullable': col_row[3] == 'Y' if len(col_row) > 3 else True,
                        'default': col_row[4] if len(col_row) > 4 else None,
                        'comment': col_row[8] if len(col_row) > 8 else None,
                    })
                
                columns_by_table[table_name] = table_columns
            except Exception as e:
                logger.warning(f"Failed to describe table {table_name}: {e}")
                columns_by_table[table_name] = []
        
        # Discover custom metadata from CUSTOMMETADATA_RELATIONSHIP
        custom_metadata = _discover_custom_metadata(cursor, safe_db, safe_schema_literal)
        
        # Discover classifications from TAG_RELATIONSHIP
        classifications = _discover_classifications(cursor, safe_db, safe_schema_literal)
        
        # Discover domains (if ATLASGLOSSARY_ENTITY exists)
        domains = _discover_domains(cursor, safe_db, safe_schema_literal)
        
        return {
            'tables': tables,
            'columns': columns_by_table,
            'customMetadata': custom_metadata,
            'classifications': classifications,
            'domains': domains,
            'discoveredAt': datetime.utcnow().isoformat(),
        }
        
    finally:
        cursor.close()


def reconcile_mdlh_fields(
    discovered_schema: Dict[str, Any],
    primary_table: str = 'ASSETS'
) -> List[Dict[str, Any]]:
    """
    Reconcile canonical fields to discovered MDLH columns.
    
    Args:
        discovered_schema: Result from discover_mdlh_schema()
        primary_table: Primary table to check (default: ASSETS)
    
    Returns:
        List of field mappings with reconciliation status
    """
    logger.info(f"Reconciling MDLH fields against {primary_table}")
    
    # Get columns from primary table
    primary_columns = discovered_schema.get('columns', {}).get(primary_table, [])
    column_names = {col['name'].upper() for col in primary_columns}
    
    mappings = []
    
    for field_id, field_def in MDLH_CANONICAL_FIELDS.items():
        canonical_field_id = field_def['id']
        canonical_field_name = field_def['displayName']
        expected_columns = field_def.get('mdlhColumns', [])
        
        # Try to find matching column
        matched_column = None
        reconciliation_status = 'NOT_FOUND'
        confidence = 0.0
        
        for expected_col in expected_columns:
            expected_upper = expected_col.upper()
            if expected_upper in column_names:
                matched_column = expected_upper
                reconciliation_status = 'MATCHED'
                confidence = 1.0
                break
        
        # Try fuzzy matching if exact match not found
        if not matched_column:
            field_name_upper = field_id.upper().replace('_', '')
            for col_name in column_names:
                col_upper_clean = col_name.replace('_', '').replace('-', '')
                if field_name_upper in col_upper_clean or col_upper_clean in field_name_upper:
                    matched_column = col_name
                    reconciliation_status = 'ALIAS_MATCHED'
                    confidence = 0.7
                    break
        
        # Build field source
        tenant_source = None
        if matched_column:
            tenant_source = {
                'type': 'native',
                'attribute': matched_column,
            }
        
        mapping = {
            'canonicalFieldId': canonical_field_id,
            'canonicalFieldName': canonical_field_name,
            'tenantSource': tenant_source,
            'status': 'auto' if reconciliation_status == 'MATCHED' else 'pending',
            'reconciliationStatus': reconciliation_status,
            'confidence': confidence,
            'expectedColumns': expected_columns,
            'matchedColumn': matched_column,
        }
        
        mappings.append(mapping)
    
    return mappings


def build_tenant_config(
    conn: snowflake.connector.SnowflakeConnection,
    tenant_id: str,
    base_url: str,
    database: str,
    schema: str
) -> Dict[str, Any]:
    """
    Build complete tenant configuration from MDLH discovery.
    
    Returns:
        Tenant configuration dict ready for frontend
    """
    logger.info(f"Building tenant config for {tenant_id}")
    
    # Discover schema
    discovered_schema = discover_mdlh_schema(conn, database, schema)
    
    # Reconcile fields
    field_mappings = reconcile_mdlh_fields(discovered_schema)
    
    # Build config
    now = datetime.utcnow().isoformat()
    
    config = {
        'tenantId': tenant_id,
        'baseUrl': base_url,
        'version': 1,
        'createdAt': now,
        'updatedAt': now,
        'fieldMappings': field_mappings,
        'customFields': [],
        'classificationMappings': [],
        'excludedFields': [],
        'lastSnapshotAt': discovered_schema['discoveredAt'],
        'schemaSnapshot': {
            'tenantId': tenant_id,
            'discoveredAt': discovered_schema['discoveredAt'],
            'entityTypes': [],  # MDLH doesn't have entity types like Atlan
            'nativeAttributes': _extract_native_attributes(discovered_schema['columns']),
            'customMetadata': discovered_schema.get('customMetadata', []),
            'classifications': discovered_schema.get('classifications', []),
            'domains': discovered_schema.get('domains', []),
            # Additional MDLH-specific fields
            'tables': discovered_schema['tables'],
            'columns': discovered_schema['columns'],
        },
    }
    
    return config


def _discover_custom_metadata(
    cursor: Any,
    safe_db: str,
    safe_schema_literal: str
) -> List[Dict[str, Any]]:
    """
    Discover custom metadata sets and attributes from CUSTOMMETADATA_RELATIONSHIP.
    
    Returns list of custom metadata definitions with their attributes.
    """
    try:
        # Check if table exists
        cursor.execute(f"""
            SELECT COUNT(*) 
            FROM {safe_db}.INFORMATION_SCHEMA.TABLES
            WHERE table_schema = '{safe_schema_literal}'
            AND table_name = 'CUSTOMMETADATA_RELATIONSHIP'
        """)
        if cursor.fetchone()[0] == 0:
            logger.info("CUSTOMMETADATA_RELATIONSHIP table not found")
            return []
        
        # Discover distinct custom metadata sets and their attributes
        cursor.execute(f"""
            SELECT DISTINCT
                SETDISPLAYNAME,
                ATTRIBUTEDISPLAYNAME,
                ATTRIBUTENAME
            FROM {safe_db}.{safe_schema_literal}."CUSTOMMETADATA_RELATIONSHIP"
            WHERE SETDISPLAYNAME IS NOT NULL
            ORDER BY SETDISPLAYNAME, ATTRIBUTEDISPLAYNAME
        """)
        
        # Group by set name
        metadata_sets: Dict[str, Dict[str, Any]] = {}
        
        for row in cursor.fetchall():
            set_name = row[0] or 'Unknown'
            attr_display = row[1] or row[2] or 'Unknown'
            attr_name = row[2] or attr_display
            
            if set_name not in metadata_sets:
                metadata_sets[set_name] = {
                    'name': set_name.replace(' ', '_').upper(),
                    'displayName': set_name,
                    'attributes': []
                }
            
            # Check if attribute already added
            existing_attrs = [a['name'] for a in metadata_sets[set_name]['attributes']]
            if attr_name not in existing_attrs:
                metadata_sets[set_name]['attributes'].append({
                    'name': attr_name,
                    'displayName': attr_display,
                    'type': 'STRING'  # Default type, could be enhanced
                })
        
        return list(metadata_sets.values())
        
    except Exception as e:
        logger.warning(f"Failed to discover custom metadata: {e}")
        return []


def _discover_classifications(
    cursor: Any,
    safe_db: str,
    safe_schema_literal: str
) -> List[Dict[str, Any]]:
    """
    Discover classifications from TAG_RELATIONSHIP.
    
    Returns list of classification definitions.
    """
    try:
        # Check if table exists
        cursor.execute(f"""
            SELECT COUNT(*) 
            FROM {safe_db}.INFORMATION_SCHEMA.TABLES
            WHERE table_schema = '{safe_schema_literal}'
            AND table_name = 'TAG_RELATIONSHIP'
        """)
        if cursor.fetchone()[0] == 0:
            logger.info("TAG_RELATIONSHIP table not found")
            return []
        
        # Discover distinct classifications
        cursor.execute(f"""
            SELECT DISTINCT
                TAGNAME,
                COUNT(DISTINCT ENTITYGUID) as usage_count
            FROM {safe_db}.{safe_schema_literal}."TAG_RELATIONSHIP"
            WHERE TAGNAME IS NOT NULL
            GROUP BY TAGNAME
            ORDER BY usage_count DESC, TAGNAME
        """)
        
        classifications = []
        for row in cursor.fetchall():
            tag_name = row[0]
            usage_count = row[1]
            
            classifications.append({
                'name': tag_name,
                'displayName': tag_name,
                'description': f'Used on {usage_count} assets',
                'usageCount': usage_count
            })
        
        return classifications
        
    except Exception as e:
        logger.warning(f"Failed to discover classifications: {e}")
        return []


def _discover_domains(
    cursor: Any,
    safe_db: str,
    safe_schema_literal: str
) -> List[Dict[str, Any]]:
    """
    Discover domains from ATLASGLOSSARY_ENTITY (if available).
    
    Returns list of domain definitions.
    """
    try:
        # Check if table exists
        cursor.execute(f"""
            SELECT COUNT(*) 
            FROM {safe_db}.INFORMATION_SCHEMA.TABLES
            WHERE table_schema = '{safe_schema_literal}'
            AND table_name = 'ATLASGLOSSARY_ENTITY'
        """)
        if cursor.fetchone()[0] == 0:
            logger.info("ATLASGLOSSARY_ENTITY table not found")
            return []
        
        # Discover glossaries (as domains)
        cursor.execute(f"""
            SELECT DISTINCT
                GUID,
                NAME,
                QUALIFIEDNAME
            FROM {safe_db}.{safe_schema_literal}."ATLASGLOSSARY_ENTITY"
            WHERE STATUS = 'ACTIVE'
            ORDER BY NAME
            LIMIT 100
        """)
        
        domains = []
        for row in cursor.fetchall():
            domains.append({
                'guid': row[0] or '',
                'name': row[1] or 'Unknown',
                'qualifiedName': row[2] or ''
            })
        
        return domains
        
    except Exception as e:
        logger.warning(f"Failed to discover domains: {e}")
        return []


def _validate_identifier(identifier: str) -> str:
    """Validate and quote Snowflake identifier."""
    # Remove any existing quotes
    identifier = identifier.strip('"')
    # Quote it
    return f'"{identifier}"'


def _extract_native_attributes(columns_by_table: Dict[str, List[Dict]]) -> List[str]:
    """Extract all unique column names as native attributes."""
    attributes = set()
    for table_columns in columns_by_table.values():
        for col in table_columns:
            attributes.add(col['name'])
    return sorted(list(attributes))
