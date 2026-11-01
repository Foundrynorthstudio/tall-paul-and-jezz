import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT = "5722000f882f8635263687ba35892740";
const HOST = "tall-paul-and-jezz.pages.dev";
const APP_NAME = "Tall Paul and Jezz set desk";

function loadEnvFile() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function emails() {
  const paul = process.env.SET_DESK_PAUL_EMAIL?.trim() || "";
  const jezz = process.env.SET_DESK_JEZZ_EMAIL?.trim() || "";
  return [paul, jezz].filter(Boolean);
}

function token() {
  const file = join(homedir(), "Library/Preferences/.wrangler/config/default.toml");
  if (!existsSync(file)) return "";
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim().startsWith("oauth_token")) continue;
    return line.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
  }
  return "";
}

async function api(path, options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const message = body.errors?.[0]?.message || `Cloudflare Access request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body.result;
}

function destinations() {
  return [
    `${HOST}/sets`,
    `${HOST}/sets/*`,
    `*.${HOST}/sets`,
    `*.${HOST}/sets/*`,
  ];
}

loadEnvFile();
const allowed = [...new Set(emails())];
if (allowed.length < 2) {
  console.log("Set desk login needs SET_DESK_PAUL_EMAIL and SET_DESK_JEZZ_EMAIL.");
  process.exit(1);
}

const apps = await api(`/accounts/${ACCOUNT}/access/apps`);
let app = (apps ?? []).find((item) => item.name === APP_NAME);
const payload = {
  name: APP_NAME,
  type: "self_hosted",
  domain: `${HOST}/sets`,
  session_duration: "24h",
  app_launcher_visible: false,
  self_hosted_domains: destinations(),
  destinations: destinations().map((uri) => ({ type: "public", uri })),
};
if (app) {
  app = await api(`/accounts/${ACCOUNT}/access/apps/${app.id}`, {
    method: "PUT",
    body: JSON.stringify({ ...payload, allowed_idps: app.allowed_idps }),
  });
} else {
  app = await api(`/accounts/${ACCOUNT}/access/apps`, { method: "POST", body: JSON.stringify(payload) });
}

const policies = await api(`/accounts/${ACCOUNT}/access/apps/${app.id}/policies`);
const policyName = "Tall Paul and Jezz";
const policy = {
  name: policyName,
  decision: "allow",
  include: allowed.map((email) => ({ email: { email } })),
  precedence: 1,
};
const existing = (policies ?? []).find((item) => item.name === policyName);
if (existing) {
  await api(`/accounts/${ACCOUNT}/access/apps/${app.id}/policies/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify(policy),
  });
} else {
  await api(`/accounts/${ACCOUNT}/access/apps/${app.id}/policies`, {
    method: "POST",
    body: JSON.stringify(policy),
  });
}

console.log("Set desk login is on /sets for the two addresses.");
