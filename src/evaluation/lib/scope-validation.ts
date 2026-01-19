/**
 * Scope Validation Utilities
 *
 * Validates and sanitizes scopeId parameters to prevent:
 * - Invalid scope formats
 * - Injection attacks
 * - Cross-tenant data access
 */

// ============================================================================
// Scope Format Patterns
// ============================================================================

/**
 * Valid scope ID patterns:
 *
 * 1. Qualified Name: default/connector/connectionId/database/schema
 *    Example: default/snowflake/1698696666/WIDE_WORLD_IMPORTERS/PROCESSED_GOLD
 *
 * 2. Domain GUID: Standard UUID format
 *    Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *
 * 3. Connection Scope: default/connector/connectionId
 *    Example: default/snowflake/1698696666
 */

// Qualified name pattern: default/connector/connectionId[/database[/schema[/table[/column]]]]
const QUALIFIED_NAME_PATTERN = /^default\/[a-zA-Z0-9_-]+\/[0-9]+(?:\/[a-zA-Z0-9_.-]+)*$/;

// UUID pattern for domain GUIDs
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed characters in scope (prevent injection)
const SAFE_SCOPE_CHARS = /^[a-zA-Z0-9_.\-\/]+$/;

// Maximum scope length (prevent DoS)
const MAX_SCOPE_LENGTH = 500;

// ============================================================================
// Validation Functions
// ============================================================================

export interface ScopeValidationResult {
  valid: boolean;
  scopeType: 'qualified_name' | 'domain_guid' | 'unknown';
  sanitized: string;
  error?: string;
}

/**
 * Validate and sanitize a scope ID.
 *
 * @param scopeId - The scope ID to validate
 * @returns Validation result with sanitized scope
 */
export function validateScopeId(scopeId: string | null | undefined): ScopeValidationResult {
  // Check for null/undefined/empty
  if (!scopeId || typeof scopeId !== 'string') {
    return {
      valid: false,
      scopeType: 'unknown',
      sanitized: '',
      error: 'Scope ID is required',
    };
  }

  // Trim whitespace
  const trimmed = scopeId.trim();

  // Check length
  if (trimmed.length === 0) {
    return {
      valid: false,
      scopeType: 'unknown',
      sanitized: '',
      error: 'Scope ID cannot be empty',
    };
  }

  if (trimmed.length > MAX_SCOPE_LENGTH) {
    return {
      valid: false,
      scopeType: 'unknown',
      sanitized: '',
      error: `Scope ID exceeds maximum length of ${MAX_SCOPE_LENGTH} characters`,
    };
  }

  // Check for dangerous characters (injection prevention)
  if (!SAFE_SCOPE_CHARS.test(trimmed)) {
    return {
      valid: false,
      scopeType: 'unknown',
      sanitized: '',
      error: 'Scope ID contains invalid characters',
    };
  }

  // Determine scope type
  if (UUID_PATTERN.test(trimmed)) {
    return {
      valid: true,
      scopeType: 'domain_guid',
      sanitized: trimmed.toLowerCase(), // Normalize UUIDs to lowercase
    };
  }

  if (QUALIFIED_NAME_PATTERN.test(trimmed)) {
    return {
      valid: true,
      scopeType: 'qualified_name',
      sanitized: trimmed,
    };
  }

  // Check if it looks like a qualified name but doesn't match pattern
  if (trimmed.includes('/')) {
    return {
      valid: false,
      scopeType: 'unknown',
      sanitized: '',
      error: `Invalid qualified name format. Expected: default/connector/connectionId/... Got: ${trimmed}`,
    };
  }

  // Unknown format - could be a custom scope, allow with warning
  return {
    valid: true,
    scopeType: 'unknown',
    sanitized: trimmed,
  };
}

/**
 * Ensure scope ID is valid, throw error if not.
 */
export function requireValidScope(scopeId: string | null | undefined): string {
  const result = validateScopeId(scopeId);
  if (!result.valid) {
    throw new Error(result.error || 'Invalid scope ID');
  }
  return result.sanitized;
}

/**
 * Parse a qualified name into components.
 */
export interface QualifiedNameParts {
  tenantId: string;      // Usually "default"
  connector: string;     // e.g., "snowflake"
  connectionId: string;  // e.g., "1698696666"
  database?: string;
  schema?: string;
  table?: string;
  column?: string;
}

export function parseQualifiedName(qualifiedName: string): QualifiedNameParts | null {
  const validation = validateScopeId(qualifiedName);
  if (!validation.valid || validation.scopeType !== 'qualified_name') {
    return null;
  }

  const parts = validation.sanitized.split('/');

  return {
    tenantId: parts[0],
    connector: parts[1],
    connectionId: parts[2],
    database: parts[3],
    schema: parts[4],
    table: parts[5],
    column: parts[6],
  };
}

/**
 * Get the connection-level scope from a qualified name.
 * Useful for filtering assets within a connection.
 */
export function getConnectionScope(qualifiedName: string): string | null {
  const parts = parseQualifiedName(qualifiedName);
  if (!parts) return null;

  return `${parts.tenantId}/${parts.connector}/${parts.connectionId}`;
}

/**
 * Check if a qualified name is within a scope.
 *
 * @param qualifiedName - The asset's qualified name
 * @param scopeId - The scope to check against
 * @returns true if the asset is within the scope
 */
export function isWithinScope(qualifiedName: string, scopeId: string): boolean {
  const qnValidation = validateScopeId(qualifiedName);
  const scopeValidation = validateScopeId(scopeId);

  if (!qnValidation.valid || !scopeValidation.valid) {
    return false;
  }

  // If scope is a domain GUID, we can't do prefix matching
  if (scopeValidation.scopeType === 'domain_guid') {
    // Domain membership requires a separate check via domain GUIDs
    return false;
  }

  // Prefix matching for qualified names
  return qnValidation.sanitized.startsWith(scopeValidation.sanitized);
}
