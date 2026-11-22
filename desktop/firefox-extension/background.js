"use strict";

// Talks to Claritard's native host. Timed URLs are sent to the gate page until Claritard grants
// them for the current Firefox session.
const HOST = "claritard_url_gate";
let rules = [];
let appearance = null;
const allowed = new Map();
const profileId = crypto.randomUUID();
let sessionId = null;
let presenceTimer;
let reporting = false;
let needsReport = false;

function scheduleTabReport() {
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(() => void reportTabs(), 150);
}

async function reportTabs() {
  if (reporting) {
    needsReport = true;
    return;
  }
  if (!sessionId || !Array.from(allowed.values()).some(end => end > Date.now())) return;
  const reportedSessionId = sessionId;
  reporting = true;
  try {
    const tabs = await browser.tabs.query({});
    const hasTimedTab = tabs.some(tab => (allowed.get(matchingRule(tab.url)?.url) || 0) > Date.now());
    if (sessionId === reportedSessionId) await native({type: "tabs", sessionId, profileId, hasTimedTab});
  } catch (error) {
    console.error("Could not report timed tabs:", error);
  } finally {
    reporting = false;
    if (needsReport) {
      needsReport = false;
      scheduleTabReport();
    }
  }
}

browser.tabs.onCreated.addListener(scheduleTabReport);
browser.tabs.onRemoved.addListener(scheduleTabReport);
browser.tabs.onUpdated.addListener((_tabId, change) => { if (change.url) scheduleTabReport(); });
setInterval(() => void reportTabs(), 5000);

function matchingRule(address) {
  let page;
  try { page = new URL(address); } catch (_) { return null; }
  if (page.protocol !== "http:" && page.protocol !== "https:") return null;
  return rules.filter(rule => {
    const scope = new URL(rule.url);
    const host = scope.hostname.toLowerCase();
    const pageHost = page.hostname.toLowerCase();
    const path = scope.pathname.replace(/\/+$/, "") || "/";
    return (pageHost === host || pageHost.endsWith("." + host)) &&
      (path === "/" || page.pathname === path || page.pathname.startsWith(path + "/"));
  }).sort((a, b) => {
    const first = new URL(a.url);
    const second = new URL(b.url);
    return second.pathname.length - first.pathname.length || second.hostname.length - first.hostname.length;
  })[0] || null;
}

async function native(request) {
  const answer = await browser.runtime.sendNativeMessage(HOST, request);
  if (answer.error) throw Object.assign(new Error(answer.error), {code: answer.code});
  return answer;
}

function applyRules(state) {
  if (state.error) {
    console.error("Claritard native host:", state.error);
    return;
  }
  sessionId = state.sessionId ?? null;
  rules = state.rules;
  appearance = state.appearance;
  allowed.clear();
  for (const rule of state.unlocked || []) allowed.set(rule, state.deadline * 1000);
  scheduleTabReport();
}

// The host pushes fresh rules whenever Claritard saves its settings. If it is missing or exits,
// retry so connecting it later in Claritard needs no extension reload. A host from before
// Claritard 1.2.315 answers "watch" with an error; then ask it once per retry instead.
const RECONNECT_MS = 5000;
const OLD_HOST_RETRY_MS = 60000;
let markReady;
const ready = new Promise(resolve => { markReady = resolve; });

async function loadRulesOnce() {
  try {
    applyRules(await native({type: "rules"}));
  } catch (error) {
    console.error("Claritard native host:", error);
  }
  markReady();
}

function connect() {
  const port = browser.runtime.connectNative(HOST);
  let closed = false;
  port.onMessage.addListener(state => {
    if (state.type !== "rules") {
      closed = true;
      port.disconnect();
      loadRulesOnce();
      setTimeout(connect, OLD_HOST_RETRY_MS);
      return;
    }
    applyRules(state);
    markReady();
  });
  port.onDisconnect.addListener(() => {
    if (closed) return;
    if (port.error) console.error("Claritard native host:", port.error.message);
    markReady();
    setTimeout(connect, RECONNECT_MS);
  });
  port.postMessage({type: "watch"});
}

connect();

async function intercept(details) {
  await ready;
  const rule = matchingRule(details.url);
  if (!rule || (allowed.get(rule.url) || 0) > Date.now()) return {};
  return {redirectUrl: browser.runtime.getURL("gate.html") + "?url=" + encodeURIComponent(details.url)};
}

browser.webRequest.onBeforeRequest.addListener(
  intercept, {urls: ["<all_urls>"], types: ["main_frame"]}, ["blocking"]
);

browser.runtime.onMessage.addListener(async request => {
  if (request.type === "rule") {
    // Fresh numbers, so a daily limit used up since the last push shows at once.
    try { applyRules(await native({type: "rules"})); } catch (error) { console.error("Claritard native host:", error); }
    const rule = matchingRule(request.url);
    return rule ? {...rule, appearance, unlocked: (allowed.get(rule.url) || 0) > Date.now()} :
      {error: "This timer was removed in Claritard.", appearance};
  }
  if (request.type === "grant") {
    const rule = matchingRule(request.url);
    if (!rule) return {error: "This timer was removed in Claritard."};
    try {
      const answer = await native({type: "grant", url: rule.url});
      sessionId = answer.sessionId ?? null;
      allowed.set(rule.url, answer.deadline * 1000);
      scheduleTabReport();
      browser.runtime.sendMessage({type: "unlocked", rule: rule.url}).catch(() => {});
      return {ok: true};
    } catch (error) {
      return {error: String(error.message || error), done: error.code === "daily-limit"};
    }
  }
  return {error: "Unknown request"};
});
