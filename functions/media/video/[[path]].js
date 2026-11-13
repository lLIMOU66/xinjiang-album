// Pages Functions: Cloudinary 视频代理
//
// 作用：只把 /media/video/ 开头的请求转发到 Cloudinary。
// 为什么需要它：国内网络会拦截 *.cloudinary.com 域名，用自己的 pages.dev 域名代理就绕开了。
// 为什么只代理 /media/video/：如果代理整个 /media/，本地静态视频和照片也会被转发，全部 404。
//
// 路径映射：
//   请求 /media/video/upload/abc.mp4
//   → https://res-3.cloudinary.com/<cloud>/video/upload/abc.mp4

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Cloud Name 优先读环境变量（wrangler.toml 的 [vars] 或 Pages 面板），其次读这里的默认值
  const CLOUD_NAME = (env && env.CLOUDINARY_CLOUD) || "YOUR_CLOUD_NAME";

  if (!url.pathname.startsWith("/media/video/")) {
    return new Response("Not Found", { status: 404 });
  }

  const cloudinaryPath = url.pathname.replace("/media/", "/");
  const cloudinaryUrl = `https://res-3.cloudinary.com/${CLOUD_NAME}${cloudinaryPath}`;

  // 只透传必要请求头，Host 头不能带过去
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const response = await fetch(cloudinaryUrl, {
    method: request.method,
    headers,
    cf: { cacheEverything: true, cacheTtl: 3600 },
  });

  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  newResponse.headers.set("Cache-Control", "public, max-age=3600");
  return newResponse;
}
