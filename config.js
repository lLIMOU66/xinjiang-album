/* 部署配置：媒体走 Cloudinary CDN。
   CLOUD = Cloudinary 的 cloud name；留空则用本地相对路径（本地预览用）。
   CLOUDINARY_HOSTS = 交付域名，按顺序尝试；国内网络对 res.cloudinary.com 有阻断，
   加载失败时前端会自动换下一个域名重试。 */
window.CLOUDINARY_CLOUD = "";
window.CLOUDINARY_HOSTS = [];
window.MEDIA_BASE = "";
