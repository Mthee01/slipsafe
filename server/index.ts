import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { existsSync, mkdirSync } from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import passport, { hashPassword } from "./auth";
import { storage } from "./storage";

if (!existsSync("uploads")) {
  mkdirSync("uploads", { recursive: true });
  log("Created uploads/ directory");
}

async function seedAdminUser() {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPhone = process.env.ADMIN_PHONE || "+254700000000";

  if (!adminUsername || !adminPassword) {
    log("No admin credentials provided in environment variables (ADMIN_USERNAME, ADMIN_PASSWORD)");
    return;
  }

  try {
    const existingAdmin = await storage.getUserByUsername(adminUsername);
    
    if (existingAdmin) {
      if (existingAdmin.role !== "admin") {
        await storage.updateUserRole(existingAdmin.id, "admin");
        log(`Updated existing user "${adminUsername}" to admin role`);
      } else {
        log(`Admin user "${adminUsername}" already exists`);
      }
      return;
    }

    const hashedPassword = await hashPassword(adminPassword);
    const adminUser = await storage.createUser({
      username: adminUsername,
      password: hashedPassword,
      phone: adminPhone,
      accountType: "individual",
    });
    
    await storage.updateUserRole(adminUser.id, "admin");
    log(`Created admin user "${adminUsername}" successfully`);
  } catch (error) {
    console.error("Failed to seed admin user:", error);
  }
}

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || "slipsafe_dev_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await seedAdminUser();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
