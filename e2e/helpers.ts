/**
 * Shared E2E test helpers.
 * Uses the Playwright `request` fixture to call the GraphQL API directly
 * without going through the browser, making setup fast and stable.
 */
import type { APIRequestContext } from '@playwright/test';

// ─── Raw GraphQL ───────────────────────────────────────────────────────────────

export async function gqlRequest(
  request: APIRequestContext,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await request.post('/graphql', {
    headers,
    data: { query, variables },
  });

  if (!response.ok()) {
    throw new Error(`GraphQL HTTP error: ${response.status()}\n${await response.text()}`);
  }

  return response.json();
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────

/** Log in as superadmin and return a Bearer token for subsequent API calls. */
export async function loginViaApi(request: APIRequestContext): Promise<string> {
  const data = await gqlRequest(request, `
    mutation {
      login(username: "superadmin", password: "Admin@123") {
        token
      }
    }
  `);
  const token = (data as { data: { login: { token: string } } }).data?.login?.token;
  if (!token) throw new Error('loginViaApi: no token returned — is the dev server running?');
  return token;
}

/** Create an invitation and return the raw invite token. */
export async function createInviteToken(
  request: APIRequestContext,
  adminToken: string,
  email: string,
): Promise<string> {
  const data = await gqlRequest(
    request,
    `mutation($email: String!, $role: UserRole) {
      createInvitation(email: $email, role: $role) { token }
    }`,
    { email, role: 'user' },
    adminToken,
  );
  const tok = (data as { data: { createInvitation: { token: string } } }).data?.createInvitation?.token;
  if (!tok) throw new Error(`createInviteToken: no token for ${email}`);
  return tok;
}

/** Register a new user with an invite token and return the access token. */
export async function registerViaApi(
  request: APIRequestContext,
  username: string,
  password: string,
  inviteToken: string,
): Promise<string> {
  const data = await gqlRequest(
    request,
    `mutation($username: String!, $password: String!, $token: String!) {
      register(username: $username, password: $password, token: $token) { token }
    }`,
    { username, password, token: inviteToken },
  );
  const tok = (data as { data: { register: { token: string } } }).data?.register?.token;
  if (!tok) throw new Error(`registerViaApi: no token for ${username}`);
  return tok;
}

// ─── Project helpers ───────────────────────────────────────────────────────────

/**
 * Return the ID of the first accessible project, creating one if none exist.
 * Superadmin can see all projects; a fresh local DB has none, so the first
 * E2E run creates a reusable "E2E Test Project".
 */
export async function getOrCreateProjectId(
  request: APIRequestContext,
  adminToken: string,
): Promise<string> {
  const data = await gqlRequest(
    request,
    `query { projects { _id name } }`,
    undefined,
    adminToken,
  );
  const projects = (data as { data: { projects: { _id: string; name: string }[] } }).data?.projects ?? [];

  if (projects.length > 0) return projects[0]._id;

  // No projects yet — create one
  const create = await gqlRequest(
    request,
    `mutation($input: ProjectInput!) { createProject(input: $input) { _id } }`,
    { input: { name: 'E2E Test Project', description: 'Auto-created by Playwright setup' } },
    adminToken,
  );
  const pid = (create as { data: { createProject: { _id: string } } }).data?.createProject?._id;
  if (!pid) throw new Error('getOrCreateProjectId: project creation failed');
  return pid;
}

/**
 * Create a task with a known title in the given project.
 * Returns the task _id.
 */
export async function createTaskViaApi(
  request: APIRequestContext,
  adminToken: string,
  projectId: string,
  title: string,
): Promise<string> {
  const data = await gqlRequest(
    request,
    `mutation($input: TaskInput!) { createTask(input: $input) { _id } }`,
    { input: { projectId, title, status: 'backlog' } },
    adminToken,
  );
  const tid = (data as { data: { createTask: { _id: string } } }).data?.createTask?._id;
  if (!tid) throw new Error(`createTaskViaApi: task creation failed for "${title}"`);
  return tid;
}
