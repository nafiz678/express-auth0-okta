import type { ErrorRequestHandler, RequestHandler } from "express";

require("dotenv").config();
const path = require("path") as typeof import("path");
const express = require("express") as typeof import("express");
const cors = require("cors") as typeof import("cors");
const { auth } =
  require("express-openid-connect") as typeof import("express-openid-connect");

const isProduction = process.env.NODE_ENV === "production";

// Where the React app runs
const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL || "";

// Sites that are allowed to call the API (comma separated)
const allowedOrigins = (process.env.CORS_ORIGINS || frontendUrl)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
// The host runs the app behind an https proxy. Needed for secure cookies
app.set("trust proxy", 1);
app.use(express.json());

// CORS: let the React app call /api and send the login cookie
app.use("/api", cors({ origin: allowedOrigins, credentials: true }));

// Auth0 login. Adds /logout and /callback and keeps the session in a cookie
app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    issuerBaseURL: process.env.ISSUER_BASE_URL,
    authorizationParams: {
      response_type: "code",
      scope: "openid profile email",
      connection: "okta-corp",
    },
    logoutParams: { federated: "" },
    routes: { login: false, postLogoutRedirect: frontendUrl },
  }),
);

// Log in, then go back to the React app. Only paths like /dashboard are allowed
app.get("/login", (req, res) => {
  const asked = req.query.returnTo;
  const page =
    typeof asked === "string" && /^\/(?!\/)[\w\-./]*$/.test(asked)
      ? asked
      : "/dashboard";
  res.oidc.login({ returnTo: frontendUrl + page });
});

// Block API calls from users who are not logged in
const requireLogin: RequestHandler = (req, res, next) =>
  req.oidc.isAuthenticated()
    ? next()
    : res.status(401).json({ error: "unauthorized" });

// The logged in user
app.get("/api/me", requireLogin, (req, res) => {
  const { sub, name, email, picture } = req.oidc.user!;
  res.json({ sub, name, email, picture });
});

// Example private API. Add your own routes like this one
app.get("/api/private/hello", requireLogin, (req, res) => {
  res.json({
    message: `Hello ${req.oidc.user!.name}, this came from the server`,
  });
});

// Details of the current session
app.get("/api/private/session", requireLogin, (req, res) => {
  res.json({ claims: req.oidc.idTokenClaims });
});

// Unknown API route
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "not_found",
    message: `No route for ${req.method} ${req.originalUrl}`,
  });
});

// In production, serve the built React app
if (isProduction) {
  const dist = path.join(__dirname, "..", "dist");
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(path.join(dist, "index.html")));
}

// API errors are sent as JSON
const apiErrors: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent || !req.originalUrl.startsWith("/api")) return next(err);
  console.error(err);
  const status = err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    error: "server_error",
    message: isProduction ? "Internal server error" : String(err.message),
  });
};
app.use(apiErrors);

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`API listening on http://localhost:${port}`),
);
