// 留言板 API：GET 获取留言列表，POST 提交新留言
export async function onRequestGet({ env }) {
  const raw = await env.ALBUM_KV.get("messages");
  const list = raw ? JSON.parse(raw) : [];
  // 最新的在前
  return json({ messages: list.slice().reverse().slice(0, 50) });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 20);
  const text = String(body.text || "").trim().slice(0, 200);

  if (!name || !text) {
    return json({ error: "昵称和留言都不能为空" }, 400);
  }

  const raw = await env.ALBUM_KV.get("messages");
  const list = raw ? JSON.parse(raw) : [];
  list.push({ name, text, ts: Date.now() });
  // 最多保留 200 条
  await env.ALBUM_KV.put("messages", JSON.stringify(list.slice(-200)));

  return json({ ok: true, count: list.length });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
  });
}
