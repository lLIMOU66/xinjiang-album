// 点赞 API：GET 获取数量，POST 点赞 +1
export async function onRequestGet({ env }) {
  const count = parseInt(await env.ALBUM_KV.get("like_count") || "0", 10);
  return json({ count });
}

export async function onRequestPost({ env }) {
  const current = parseInt(await env.ALBUM_KV.get("like_count") || "0", 10);
  const next = current + 1;
  await env.ALBUM_KV.put("like_count", String(next));
  return json({ count: next });
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
  });
}
