// 鉴权诊断：用假凭据探 Supabase auth，根据返回判断是 key 问题还是凭据/邮箱确认问题。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
console.log("url:", url);
console.log("key:", key ? key.slice(0, 24) + "..." : "(缺失!)");

// 探测：用不存在的账号试登录。返回码区分 key 是否有效。
const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "content-type": "application/json" },
  body: JSON.stringify({ email: "probe@example.test", password: "WrongProbe123!" }),
});
console.log("status:", r.status);
console.log("body:", await r.text());
