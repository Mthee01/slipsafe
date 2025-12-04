import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "../server/auth";
import { registerRoutes } from "../server/routes";
import { registerOrganizationRoutes } from "../server/organization-routes";

export function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(session({
    secret: "test_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  registerRoutes(app);
  registerOrganizationRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Test] Error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
