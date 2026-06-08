import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@momentum-lab/shared";
import { config } from "./config.js";
import { supabaseAdminClient, supabaseAuthClient } from "./supabase.js";

const COOKIE_NAME = "momentum_session";

export interface AuthSession {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthSession;
    }
  }
}

function sign(payload: string) {
  return crypto
    .createHmac("sha256", config.authSecret)
    .update(payload)
    .digest("base64url");
}

function encodeSession(session: AuthSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(raw?: string): AuthSession | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, session: AuthSession) {
  res.cookie(COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

export function readSession(req: Request): AuthSession | null {
  return decodeSession(req.cookies?.[COOKIE_NAME]);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  req.user = session;
  next();
}

export function sessionToUser(session: AuthSession): User {
  const now = new Date().toISOString();
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    created_at: now,
    updated_at: now
  };
}

export async function loginWithPassword(email: string, password: string) {
  if (supabaseAuthClient) {
    const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return null;
    }

    const session = {
      id: data.user.id,
      email: data.user.email ?? email,
      name:
        typeof data.user.user_metadata?.name === "string"
          ? data.user.user_metadata.name
          : null,
      role: "user"
    } satisfies AuthSession;

    if (supabaseAdminClient) {
      const { data: existingUser } = await supabaseAdminClient
        .from("users")
        .select("role")
        .eq("id", session.id)
        .maybeSingle();

      const role =
        typeof existingUser?.role === "string" ? existingUser.role : session.role;

      await supabaseAdminClient.from("users").upsert({
        id: session.id,
        email: session.email,
        name: session.name,
        role
      });
    }

    return session;
  }

  if (email === config.adminEmail && password === config.adminPassword) {
    return {
      id: "local-admin",
      email,
      name: "Momentum Admin",
      role: "admin"
    } satisfies AuthSession;
  }

  return null;
}
