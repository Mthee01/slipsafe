import request from "supertest";
import type { Express } from "express";
import { createUser, type CreateUserOptions } from "./fixtures";

export interface AuthenticatedAgent {
  agent: request.Agent;
  user: Awaited<ReturnType<typeof createUser>>;
  cookies: string[];
}

export async function createAuthenticatedUser(
  app: Express,
  options: CreateUserOptions = {}
): Promise<AuthenticatedAgent> {
  const password = options.password || "password123";
  const user = await createUser({ ...options, password });
  
  const agent = request.agent(app);
  
  const loginRes = await agent
    .post("/api/auth/login")
    .send({ username: user.username, password });
  
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }
  
  const rawCookies = loginRes.headers["set-cookie"];
  const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : (rawCookies ? [rawCookies] : []);
  
  return { agent, user, cookies };
}

export interface LoginResult {
  agent: request.Agent;
  cookies: string[];
}

export async function loginAsUser(
  app: Express,
  username: string,
  password: string = "password123"
): Promise<LoginResult> {
  const agent = request.agent(app);
  
  const loginRes = await agent
    .post("/api/auth/login")
    .send({ username, password });
  
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }
  
  const rawCookies = loginRes.headers["set-cookie"];
  const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : (rawCookies ? [rawCookies] : []);
  
  return { agent, cookies };
}

export function withAuth(agent: request.Agent): request.Agent {
  return agent;
}
