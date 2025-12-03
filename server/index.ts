import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { existsSync, mkdirSync } from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import passport, { hashPassword } from "./auth";
import { storage } from "./storage";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./lib/stripeClient";
import { WebhookHandlers } from "./lib/webhookHandlers";

if (!existsSync("uploads")) {
  mkdirSync("uploads", { recursive: true });
  log("Created uploads/ directory");
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("DATABASE_URL not found - Stripe initialization skipped");
    return;
  }

  try {
    log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    log("Setting up managed webhook...");
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['*'],
        description: 'SlipSafe managed webhook for Stripe sync',
      }
    );
    log(`Webhook configured: ${webhook.url}`);

    log("Starting Stripe data sync in background...");
    stripeSync.syncBackfill()
      .then(() => log("Stripe data synced"))
      .catch((err: any) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
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

// Trust proxy for deployments behind reverse proxies (Azure, Heroku, etc.)
// This is required for secure cookies to work correctly
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || "slipsafe_dev_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

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
  await initStripe();
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
