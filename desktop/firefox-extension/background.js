"use strict";

// Talks to Claritard's native host. Timed URLs are sent to the gate page until Claritard grants
// them for the current Firefox session.
const HOST = "claritard_url_gate";
let rules = [];
let appearance = null;
const allowed = new Map();

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
  if (answer.error) throw new Error(answer.error);
  return answer;
}

async function loadRules() {
  try {
    const state = await native({type: "rules"});
    rules = state.rules;
    appearance = state.appearance;
    for (const rule of state.unlocked || []) allowed.set(rule, state.deadline * 1000);
  } catch (error) {
    console.error("Claritard native host:", error);
  }
}

const ready = loadRules();

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
    const rule = matchingRule(request.url);
    return rule ? {...rule, appearance, unlocked: (allowed.get(rule.url) || 0) > Date.now()} :
      {error: "This timer was removed in Claritard. Reload the extension.", appearance};
  }
  if (request.type === "grant") {
    const rule = matchingRule(request.url);
    if (!rule) return {error: "This timer was removed in Claritard. Reload the extension."};
    try {
      const answer = await native({type: "grant", url: rule.url});
      allowed.set(rule.url, answer.deadline * 1000);
      browser.runtime.sendMessage({type: "unlocked", rule: rule.url}).catch(() => {});
      return {ok: true};
    } catch (error) {
      return {error: String(error.message || error)};
    }
  }
  return {error: "Unknown request"};
});
