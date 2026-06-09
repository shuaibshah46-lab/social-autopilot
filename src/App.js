import React from 'react';
import { useState, useEffect, useRef } from "react";

const PLATFORMS = [
  { id: "twitter", name: "Twitter/X", icon: "🐦", color: "#1DA1F2" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", color: "#0A66C2" },
  { id: "pinterest", name: "Pinterest", icon: "📌", color: "#E60023" },
  { id: "facebook", name: "Facebook", icon: "📘", color: "#1877F2" },
  { id: "instagram", name: "Instagram", icon: "📸", color: "#E1306C" },
];

const TONES = ["Professional", "Casual", "Funny", "Inspirational", "Promotional"];
const TOPICS = ["Technology", "Fashion", "Food", "Travel", "Fitness", "Business", "Art", "Nature"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchImage(query, unsplashKey) {
  const seed = Math.abs([...query].reduce((a, c) => a + c.charCodeAt(0), 0)) % 1000;
  const fallback = { url: `https://picsum.photos/seed/${seed}/800/500`, author: "Picsum Photos" };
  if (!unsplashKey) return fallback;
  try {
    const res = await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${unsplashKey}`);
    if (!res.ok) throw new Error();
    const d = await res.json();
    return { url: d.urls?.regular, author: d.user?.name, authorLink: d.user?.links?.html };
  } catch { return fallback; }
}

async function postToTwitter(caption, keys) {
  if (!keys.twitterBearerToken) throw new Error("Twitter Bearer Token missing");
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { "Authorization": `Bearer ${keys.twitterBearerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: caption.slice(0, 280) }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Twitter failed"); }
}

async function postToLinkedIn(caption, imageUrl, keys) {
  if (!keys.linkedinToken || !keys.linkedinPersonUrn) throw new Error("LinkedIn token/URN missing");
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: { "Authorization": `Bearer ${keys.linkedinToken}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify({
      author: `urn:li:person:${keys.linkedinPersonUrn}`,
      lifecycleState: "PUBLISHED",
      specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: caption.slice(0, 3000) }, shareMediaCategory: "NONE" } },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
    }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || "LinkedIn failed"); }
}

async function postToPinterest(caption, imageUrl, keys) {
  if (!keys.pinterestToken || !keys.pinterestBoardId) throw new Error("Pinterest token/Board ID missing");
  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { "Authorization": `Bearer ${keys.pinterestToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ board_id: keys.pinterestBoardId, title: caption.slice(0, 100), description: caption.slice(0, 500), media_source: { source_type: "image_url", url: imageUrl || `https://picsum.photos/800/500` } }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Pinterest failed"); }
}

async function postToFacebook(caption, imageUrl, keys) {
  if (!keys.facebookPageToken || !keys.facebookPageId) throw new Error("Facebook Token/ID missing");
  const endpoint = imageUrl
    ? `https://graph.facebook.com/v18.0/${keys.facebookPageId}/photos`
    : `https://graph.facebook.com/v18.0/${keys.facebookPageId}/feed`;
  const body = imageUrl
    ? { caption, url: imageUrl, access_token: keys.facebookPageToken }
    : { message: caption, access_token: keys.facebookPageToken };
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Facebook failed"); }
}

async function postToInstagram(caption, imageUrl, keys) {
  if (!keys.instagramAccountId || !keys.facebookPageToken) throw new Error("Instagram ID / Facebook Token missing");
  if (!imageUrl) throw new Error("Instagram ke liye image zaroori hai");
  const c = await fetch(`https://graph.facebook.com/v18.0/${keys.instagramAccountId}/media`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption: caption.slice(0, 2200), access_token: keys.facebookPageToken }),
  });
  if (!c.ok) { const e = await c.json(); throw new Error(e.error?.message || "Instagram container failed"); }
  const { id: creationId } = await c.json();
  await sleep(2000);
  const p = await fetch(`https://graph.facebook.com/v18.0/${keys.instagramAccountId}/media_publish`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: keys.facebookPageToken }),
  });
  if (!p.ok) { const e = await p.json(); throw new Error(e.error?.message || "Instagram publish failed"); }
              }
function TypewriterText({ text, speed = 14 }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed(""); setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, ++i)); }
      else { setDone(true); clearInterval(iv); }
    }, speed);
    return () => clearInterval(iv);
  }, [text]);
  return <span>{displayed}{!done && <span style={{animation:"blink .8s infinite"}}>|</span>}</span>;
}

function StatusPill({ s }) {
  const map = { ok: ["✅ Posted!", "#22c55e", "#0f2a16"], fail: ["❌ Failed", "#ef4444", "#2a0f0f"], pending: ["⏳ Pending", "#f59e0b", "#292310"] };
  const [label, color, bg] = map[s] || map.pending;
  return <span style={{ background: bg, color, border: `1px solid ${color}44`, padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{label}</span>;
}

function KeyInput({ label, placeholder, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
          style={{ flex: 1, background: "#0a0e1a", border: "1px solid #1e293b", color: "#e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontFamily: "monospace" }} />
        <button onClick={() => setShow(!show)} style={{ background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8, padding: "0 10px", cursor: "pointer" }}>
          {show ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );
}

function PlatformKeys({ platform, keys, setKeys }) {
  const update = (k, v) => setKeys(prev => ({ ...prev, [k]: v }));
  if (platform === "twitter") return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>👉 <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noreferrer" style={{color:"#818cf8"}}>developer.twitter.com</a> → App → Keys & Tokens</div>
      <KeyInput label="Bearer Token" placeholder="AAAA...xxxx" value={keys.twitterBearerToken || ""} onChange={v => update("twitterBearerToken", v)} />
    </div>
  );
  if (platform === "linkedin") return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>👉 <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer" style={{color:"#818cf8"}}>linkedin.com/developers</a> → App → Auth</div>
      <KeyInput label="Access Token" placeholder="AQV..." value={keys.linkedinToken || ""} onChange={v => update("linkedinToken", v)} />
      <KeyInput label="Person URN (Profile ID)" placeholder="abc123" value={keys.linkedinPersonUrn || ""} onChange={v => update("linkedinPersonUrn", v)} />
    </div>
  );
  if (platform === "pinterest") return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>👉 <a href="https://developers.pinterest.com/apps/" target="_blank" rel="noreferrer" style={{color:"#818cf8"}}>developers.pinterest.com</a> → App → Access Token</div>
      <KeyInput label="Access Token" placeholder="pina_..." value={keys.pinterestToken || ""} onChange={v => update("pinterestToken", v)} />
      <KeyInput label="Board ID" placeholder="123456789" value={keys.pinterestBoardId || ""} onChange={v => update("pinterestBoardId", v)} />
    </div>
  );
  if (platform === "facebook") return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>👉 <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" style={{color:"#818cf8"}}>developers.facebook.com</a> → Graph API Explorer</div>
      <KeyInput label="Page Access Token" placeholder="EAAx..." value={keys.facebookPageToken || ""} onChange={v => update("facebookPageToken", v)} />
      <KeyInput label="Page ID" placeholder="123456789" value={keys.facebookPageId || ""} onChange={v => update("facebookPageId", v)} />
    </div>
  );
  if (platform === "instagram") return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>👉 Facebook approval ke baad milega. Facebook Page Token upar wala use hoga.</div>
      <KeyInput label="Instagram Business Account ID" placeholder="17841400..." value={keys.instagramAccountId || ""} onChange={v => update("instagramAccountId", v)} />
      <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Facebook Page Token automatically use hoga ✅</div>
    </div>
  );
  return null;
}

function PostCard({ post, onDelete }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {post.platformResults?.map(r => {
            const pl = PLATFORMS.find(x => x.id === r.id);
            return <span key={r.id} style={{ fontSize: 11, background: pl?.color + "22", color: pl?.color, border: `1px solid ${pl?.color}44`, borderRadius: 99, padding: "2px 8px" }}>{pl?.icon} {pl?.name}</span>;
          })}
        </div>
        <button onClick={() => onDelete(post.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}>✕</button>
      </div>
      {post.image?.url && (
        <div style={{ borderRadius: 10, overflow: "hidden", marginBottom: 10, position: "relative" }}>
          <img src={post.image.url} alt="post" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
          {post.image.author && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#00000077", padding: "6px 10px", fontSize: 10, color: "#ffffffaa" }}>
              📷 {post.image.author}
            </div>
          )}
        </div>
      )}
      <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap" }}>{post.caption}</div>
      <div style={{ borderTop: "1px solid #1e293b", paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
        {post.platformResults?.map(r => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>{PLATFORMS.find(x => x.id === r.id)?.icon} {PLATFORMS.find(x => x.id === r.id)?.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {r.error && <span style={{ fontSize: 10, color: "#ef444488" }}>{r.error}</span>}
              <StatusPill s={r.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function App() {
  const [topic, setTopic] = useState("Technology");
  const [tone, setTone] = useState("Professional");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["twitter"]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [posts, setPosts] = useState([]);
  const [log, setLog] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("compose");
  const [expandedKey, setExpandedKey] = useState(null);
  const [keys, setKeys] = useState({
    unsplashKey: "", twitterBearerToken: "", linkedinToken: "",
    linkedinPersonUrn: "", pinterestToken: "", pinterestBoardId: "",
    facebookPageToken: "", facebookPageId: "", instagramAccountId: "",
  });
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const addLog = (msg, type = "info") => setLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);
  const togglePlatform = (id) => setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const keysConfigured = (pid) => {
    if (pid === "twitter") return !!keys.twitterBearerToken;
    if (pid === "linkedin") return !!(keys.linkedinToken && keys.linkedinPersonUrn);
    if (pid === "pinterest") return !!(keys.pinterestToken && keys.pinterestBoardId);
    if (pid === "facebook") return !!(keys.facebookPageToken && keys.facebookPageId);
    if (pid === "instagram") return !!(keys.instagramAccountId && keys.facebookPageToken);
    return false;
  };

  const generate = async () => {
    if (!selectedPlatforms.length) return alert("Koi platform select karo!");
    setGenerating(true);
    setLog([]);
    addLog("🤖 AI pipeline shuru...", "system");
    let caption = "", hashtags = "", imageQuery = topic, image = null;
    try {
      addLog("✍️ Caption generate ho raha hai...", "info");
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a social media manager. Return ONLY valid JSON, no markdown: {"caption":"...","imageQuery":"3-4 word image search","hashtags":"#tag1 #tag2"}`,
          messages: [{ role: "user", content: `Topic: ${topic}. Tone: ${tone}. Platforms: ${selectedPlatforms.join(", ")}. ${customPrompt ? "Extra: " + customPrompt : ""}` }],
        }),
      });
      const aiData = await aiRes.json();
      const raw = aiData.content?.map(i => i.text || "").join("") || "{}";
      try {
        const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
        caption = p.caption || raw.slice(0, 280);
        hashtags = p.hashtags || "";
        imageQuery = p.imageQuery || topic;
      } catch { caption = raw.slice(0, 280); }
      addLog("✅ Caption ready!", "success");
      addLog(`🖼️ Image fetch: "${imageQuery}"...`, "info");
      image = await fetchImage(imageQuery, keys.unsplashKey);
      addLog(`✅ Image ready! (${image.author})`, "success");
      const fullCaption = caption + "\n\n" + hashtags;
      const platformResults = [];
      for (const pid of selectedPlatforms) {
        const pl = PLATFORMS.find(x => x.id === pid);
        addLog(`🚀 ${pl?.name} pe post ho raha hai...`, "info");
        try {
          if (pid === "twitter") await postToTwitter(fullCaption, keys);
          else if (pid === "linkedin") await postToLinkedIn(fullCaption, image?.url, keys);
          else if (pid === "pinterest") await postToPinterest(fullCaption, image?.url, keys);
          else if (pid === "facebook") await postToFacebook(fullCaption, image?.url, keys);
          else if (pid === "instagram") await postToInstagram(fullCaption, image?.url, keys);
          addLog(`${pl?.icon} ${pl?.name} — Posted! ✅`, "success");
          platformResults.push({ id: pid, status: "ok" });
        } catch (err) {
          addLog(`❌ ${pl?.name} — ${err.message}`, "error");
          platformResults.push({ id: pid, status: "fail", error: err.message });
        }
        await sleep(500);
      }
      setPosts(prev => [{ id: Date.now(), caption: fullCaption, image, topic, tone, platformResults }, ...prev]);
      addLog(`🎉 Done! ${platformResults.filter(r => r.status === "ok").length}/${selectedPlatforms.length} posted.`, "system");
    } catch (err) {
      addLog("❌ Error: " + err.message, "error");
    } finally { setGenerating(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#e2e8f0", fontFamily: "'Sora','Segoe UI',sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:99px}
      `}</style>
      <div style={{ background: "linear-gradient(135deg,#0f172a,#1e1b4b)", borderBottom: "1px solid #1e293b", padding: "24px 0 18px", textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#6366f1", textTransform: "uppercase", marginBottom: 5 }}>AI-Powered</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, background: "linear-gradient(90deg,#818cf8,#a78bfa,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Social Autopilot ⚡</h1>
        <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>AI likhega • Image laega • Khud post karega</p>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b", background: "#0a0e1a" }}>
        {[["compose", "✍️ Compose"], ["keys", "🔑 API Keys"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ flex: 1, padding: "13px 0", background: "none", border: "none", color: activeTab === id ? "#a78bfa" : "#475569", fontWeight: activeTab === id ? 700 : 400, fontSize: 13, cursor: "pointer", borderBottom: activeTab === id ? "2px solid #a78bfa" : "2px solid transparent", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "22px 16px 0" }}>
        {activeTab === "compose" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {[["📌 Topic", topic, setTopic, TOPICS], ["🎭 Tone", tone, setTone, TONES]].map(([lbl, val, set, opts]) => (
                <div key={lbl}>
                  <label style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>{lbl}</label>
                  <select value={val} onChange={e => set(e.target.value)} style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0", borderRadius: 10, padding: "9px 12px", fontSize: 13, cursor: "pointer" }}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>📲 Platforms</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PLATFORMS.map(p => {
                  const active = selectedPlatforms.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => togglePlatform(p.id)}
                      style={{ background: active ? p.color + "22" : "#0f172a", border: `1.5px solid ${active ? p.color : "#1e293b"}`, color: active ? p.color : "#475569", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {p.icon} {p.name} {active && <span style={{ fontSize: 9 }}>✓</span>}
                      {!keysConfigured(p.id) && <span title="API key missing">⚠️</span>}
                    </button>
                  );
                })}
              </div>
              {selectedPlatforms.some(p => !keysConfigured(p)) && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#f59e0b" }}>
                  ⚠️ Keys missing — <button onClick={() => setActiveTab("keys")} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 11, padding: 0 }}>API Keys tab mein daalo</button>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>✏️ Custom Instructions</label>
              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={2}
                placeholder="Jaise: Hinglish mein likho, sale announce karo..."
                style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <button onClick={generate} disabled={generating}
              style={{ width: "100%", background: generating ? "#1e293b" : "linear-gradient(135deg,#6366f1,#a78bfa)", border: "none", color: "#fff", borderRadius: 12, padding: "15px 0", fontSize: 15, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
              {generating ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⚙️</span> AI Kaam Kar Raha Hai...</> : "⚡ Generate & Post Karo"}
            </button>
            {log.length > 0 && (
              <div ref={logRef} style={{ marginTop: 14, background: "#0a0e1a", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 14px", maxHeight: 150, overflowY: "auto" }}>
                {log.map((l, i) => (
                  <div key={i} style={{ fontSize: 11, marginBottom: 4, color: l.type === "success" ? "#22c55e" : l.type === "error" ? "#ef4444" : l.type === "system" ? "#a78bfa" : "#64748b", fontFamily: "monospace" }}>
                    <span style={{ color: "#1e293b", marginRight: 6 }}>[{l.ts}]</span>
                    <TypewriterText text={l.msg} speed={10} />
                  </div>
                ))}
              </div>
            )}
            {posts.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>📋 Posts ({posts.length})</span>
                  <button onClick={() => setPosts([])} style={{ background: "none", border: "1px solid #1e293b", color: "#475569", borderRadius: 8, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>Clear</button>
                </div>
                {posts.map(p => <PostCard key={p.id} post={p} onDelete={id => setPosts(prev => prev.filter(x => x.id !== id))} />)}
              </div>
            )}
            {posts.length === 0 && !generating && (
              <div style={{ textAlign: "center", marginTop: 40, color: "#1e293b" }}>
                <div style={{ fontSize: 40 }}>🤖</div>
                <div style={{ fontSize: 13, marginTop: 8, color: "#334155" }}>Ready hai — generate karo!</div>
              </div>
            )}
          </>
        )}
        {activeTab === "keys" && (
          <>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpandedKey(expandedKey === "unsplash" ? null : "unsplash")}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>🖼️ Unsplash</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Real photos ke liye (Free)</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {keys.unsplashKey ? <span style={{ fontSize: 10, color: "#22c55e" }}>✅ Set</span> : <span style={{ fontSize: 10, color: "#f59e0b" }}>⚠️ Missing</span>}
                  <span style={{ color: "#475569" }}>{expandedKey === "unsplash" ? "▲" : "▼"}</span>
                </div>
              </div>
              {expandedKey === "unsplash" && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 11, color: "#64748b", margin: "12px 0 8px" }}>
                    👉 <a href="https://unsplash.com/developers" target="_blank" rel="noreferrer" style={{color:"#818cf8"}}>unsplash.com/developers</a> → New App → Access Key
                  </div>
                  <KeyInput label="Access Key" placeholder="abc123..." value={keys.unsplashKey} onChange={v => setKeys(p => ({ ...p, unsplashKey: v }))} />
                </div>
              )}
            </div>
            {PLATFORMS.map(pl => (
              <div key={pl.id} style={{ background: "#0f172a", border: `1px solid ${keysConfigured(pl.id) ? pl.color + "44" : "#1e293b"}`, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpandedKey(expandedKey === pl.id ? null : pl.id)}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{pl.icon} {pl.name}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>API Integration</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {keysConfigured(pl.id) ? <span style={{ fontSize: 10, color: "#22c55e" }}>✅ Ready</span> : <span style={{ fontSize: 10, color: "#f59e0b" }}>⚠️ Setup</span>}
                    <span style={{ color: "#475569" }}>{expandedKey === pl.id ? "▲" : "▼"}</span>
                  </div>
                </div>
                {expandedKey === pl.id && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1e293b" }}>
                    <div style={{ marginTop: 12 }}>
                      <PlatformKeys platform={pl.id} keys={keys} setKeys={setKeys} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>📌 Important Notes:</div>
              <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.8 }}>
                • Keys sirf browser session mein save hoti hain<br/>
                • Instagram ke liye Facebook approval zaroori hai<br/>
                • Twitter free tier: 1500 tweets/month<br/>
                • Unsplash free tier: 50 requests/hour
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
                                           }
