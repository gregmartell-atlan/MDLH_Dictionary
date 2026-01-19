import { test, expect } from '@playwright/test';

const apiBaseUrl = process.env.E2E_API_URL || 'http://localhost:8000';

const requiredEnv = [
  'E2E_SNOWFLAKE_ACCOUNT',
  'E2E_SNOWFLAKE_USER',
  'E2E_SNOWFLAKE_TOKEN',
  'E2E_SNOWFLAKE_WAREHOUSE',
  'E2E_SNOWFLAKE_DATABASE',
  'E2E_SNOWFLAKE_SCHEMA',
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);
const hasEnvCredentials = missingEnv.length === 0;
const manualMode = process.env.E2E_MANUAL === '1';

const getSnowflakeEnv = () => ({
  account: process.env.E2E_SNOWFLAKE_ACCOUNT || '',
  user: process.env.E2E_SNOWFLAKE_USER || '',
  token: process.env.E2E_SNOWFLAKE_TOKEN || '',
  warehouse: process.env.E2E_SNOWFLAKE_WAREHOUSE || '',
  database: process.env.E2E_SNOWFLAKE_DATABASE || '',
  schema: process.env.E2E_SNOWFLAKE_SCHEMA || '',
  role: process.env.E2E_SNOWFLAKE_ROLE || '',
});

async function createSession(request: typeof test.request) {
  const env = getSnowflakeEnv();
  const response = await request.post(`${apiBaseUrl}/api/connect`, {
    data: {
      account: env.account,
      user: env.user,
      token: env.token,
      warehouse: env.warehouse,
      database: env.database,
      schema_name: env.schema,
      role: env.role || undefined,
      auth_type: 'token',
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  expect(data.connected).toBeTruthy();
  expect(data.session_id).toBeTruthy();

  const sessionInfo = {
    sessionId: data.session_id,
    user: data.user || env.user,
    warehouse: data.warehouse || env.warehouse,
    database: data.database || env.database,
    schema: env.schema,
    role: data.role || env.role,
    timestamp: Date.now(),
  };

  const configInfo = {
    account: env.account,
    user: env.user,
    warehouse: env.warehouse,
    database: env.database,
    schema: env.schema,
    role: env.role,
    authMethod: 'token',
  };

  return { sessionInfo, configInfo, env };
}

async function seedSessionStorage(page: any, sessionInfo: any, configInfo: any) {
  await page.addInitScript(
    ({ sessionInfo, configInfo }) => {
      window.sessionStorage.setItem('snowflake_session', JSON.stringify(sessionInfo));
      window.localStorage.setItem('snowflake_config', JSON.stringify(configInfo));
      window.localStorage.setItem('query_editor_sql', 'SELECT CURRENT_VERSION() AS VERSION;');
    },
    { sessionInfo, configInfo }
  );
}

async function waitForManualConnection(page: any) {
  await page.goto('/');
  await page.getByTestId('connection-indicator').click();
  await expect(page.getByTestId('connection-modal')).toBeVisible();
  await expect(page.getByTestId('connection-indicator')).toHaveAttribute('data-state', 'connected', {
    timeout: 5 * 60 * 1000,
  });
}

async function ensureConnected(page: any, request: typeof test.request) {
  if (hasEnvCredentials) {
    const env = getSnowflakeEnv();
    await page.goto('/');
    await page.getByTestId('connection-indicator').click();
    await expect(page.getByTestId('connection-modal')).toBeVisible();
    await page.getByTestId('connection-auth-token').click();
    await page.getByTestId('connection-account').fill(env.account);
    await page.getByTestId('connection-user').fill(env.user);
    await page.getByTestId('connection-token').fill(env.token);
    await page.getByTestId('connection-warehouse').fill(env.warehouse);
    await page.getByTestId('connection-database').fill(env.database);
    await page.getByTestId('connection-schema').fill(env.schema);
    if (env.role) {
      await page.getByTestId('connection-role').fill(env.role);
    }
    await page.getByTestId('connection-submit').click();
    await expect(page.getByTestId('connection-result')).toContainText('Connected successfully');
    await expect(page.getByTestId('connection-indicator')).toHaveAttribute('data-state', 'connected');
    await expect(page.getByTestId('connection-modal')).toHaveCount(0);
    return;
  }

  if (manualMode) {
    await waitForManualConnection(page);
    return;
  }

  test.skip(true, `Missing env vars: ${missingEnv.join(', ')}`);
}

test.describe('Snowflake connection E2E', () => {
  test('connects via modal and shows connected status', async ({ page }) => {
    await ensureConnected(page, test.request);

    if (hasEnvCredentials) {
      const env = getSnowflakeEnv();
      await expect(page.getByTestId('connection-indicator')).toContainText(`${env.database}.${env.schema}`);
    }
  });

  test('schema explorer loads and query executes in editor', async ({ page, request }) => {
    if (hasEnvCredentials) {
      const { sessionInfo, configInfo } = await createSession(request);
      await seedSessionStorage(page, sessionInfo, configInfo);
      await page.goto('/');
      await expect(page.getByTestId('connection-indicator')).toHaveAttribute('data-state', 'connected');
    } else if (manualMode) {
      await ensureConnected(page, request);
    } else {
      test.skip(true, `Missing env vars: ${missingEnv.join(', ')}`);
    }

    await page.getByTestId('nav-editor').click();
    await expect(page.getByTestId('query-editor')).toBeVisible();

    await expect(page.getByTestId('schema-tree')).toBeVisible();
    await expect(page.getByTestId('schema-tree-search')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('query-editor-run').click();
    await expect(page.getByTestId('query-results-table')).toBeVisible({ timeout: 60000 });
  });

  test('connected session renders core views and tools', async ({ page, request }) => {
    if (hasEnvCredentials) {
      const { sessionInfo, configInfo } = await createSession(request);
      await seedSessionStorage(page, sessionInfo, configInfo);
      await page.goto('/');
      await expect(page.getByTestId('connection-indicator')).toHaveAttribute('data-state', 'connected');
    } else if (manualMode) {
      await ensureConnected(page, request);
    } else {
      test.skip(true, `Missing env vars: ${missingEnv.join(', ')}`);
    }

    await page.getByTestId('nav-evaluation').click();
    await expect(page.getByTestId('evaluation-app')).toBeVisible();

    await page.getByTestId('nav-modeling').click();
    await expect(page.getByTestId('modeling-app')).toBeVisible();

    await page.getByTestId('nav-pivot').click();
    await expect(page.getByTestId('pivot-builder')).toBeVisible();

    await page.getByTestId('nav-tenant-config').click();
    await expect(page.getByTestId('tenant-config-page')).toBeVisible();
  });
});
