import { getPythonApiUrl, getSessionId } from '../config/api';

const API_URL = getPythonApiUrl();

export async function submitPivotFeedback(payload) {
  const sessionId = getSessionId();
  if (!sessionId) {
    throw new Error('No active Snowflake session');
  }

  const response = await fetch(`${API_URL}/api/pivots/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Feedback request failed (${response.status})`);
  }

  return response.json();
}
