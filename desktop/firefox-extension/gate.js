"use strict";

const url = new URL(location.href).searchParams.get("url");
const time = document.getElementById("time");
const hint = document.getElementById("hint");
const open = document.getElementById("open");
const error = document.getElementById("error");
const progress = document.getElementById("progress");
const circumference = 2 * Math.PI * 52;
progress.style.strokeDasharray = String(circumference);
document.getElementById("url").textContent = url || "";
let rule;
let deadline = null;
let busy = false;

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;
function applyAppearance(appearance) {
  if (!appearance) return;
  document.documentElement.classList.toggle("light", appearance.mode === "light");
  const set = (name, value) => { if (typeof value === "string" && COLOR.test(value)) document.documentElement.style.setProperty(name, value); };
  set("--bg", appearance.background);
  set("--paper", appearance.paper);
  set("--text", appearance.text);
  set("--muted", appearance.textSecondary);
  set("--accent", appearance.primary);
  set("--on-accent", appearance.onPrimary);
}

browser.runtime.onMessage.addListener(message => {
  if (message.type === "unlocked" && rule && message.rule === rule.url) location.replace(url);
});

function active() { return document.visibilityState === "visible" && document.hasFocus(); }
function draw(remaining) {
  time.textContent = String(remaining);
  const fraction = rule.delay ? remaining / rule.delay : 0;
  progress.style.strokeDashoffset = String(circumference * (1 - fraction));
}
function tick() {
  if (!rule || busy) return;
  if (!active()) {
    deadline = null;
    open.disabled = true;
    draw(rule.delay);
    hint.classList.add("paused");
    hint.textContent = "Countdown reset. Focus this tab to start again.";
    return;
  }
  hint.classList.remove("paused");
  if (deadline === null) deadline = performance.now() + rule.delay * 1000;
  const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
  draw(remaining);
  open.disabled = remaining !== 0;
  hint.textContent = remaining ? "Keep this tab active until the countdown ends." : "Ready when you are.";
}

function showDone() {
  document.body.classList.add("done");
  document.getElementById("eyebrow").textContent = "Done for today";
  document.getElementById("message").textContent = "This site's daily time is used up.";
  hint.textContent = "It opens again tomorrow.";
}

open.addEventListener("click", async () => {
  if (!rule || !active() || deadline === null || performance.now() < deadline || busy) return;
  busy = true;
  open.disabled = true;
  const result = await browser.runtime.sendMessage({type: "grant", url});
  if (result.error) {
    if (result.done) { showDone(); return; }
    error.textContent = result.error;
    busy = false;
    return;
  }
  location.replace(url);
});

browser.runtime.sendMessage({type: "rule", url}).then(result => {
  applyAppearance(result.appearance);
  if (result.error) { error.textContent = result.error; return; }
  rule = result;
  if (rule.unlocked) { location.replace(url); return; }
  if (rule.dailyLimit && rule.usedToday >= rule.dailyLimit) { showDone(); return; }
  document.getElementById("message").textContent = rule.message;
  tick();
  setInterval(tick, 100);
}).catch(reason => { error.textContent = String(reason); });
