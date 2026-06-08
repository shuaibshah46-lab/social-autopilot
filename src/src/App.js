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
