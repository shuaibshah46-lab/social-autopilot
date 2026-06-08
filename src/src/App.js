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
