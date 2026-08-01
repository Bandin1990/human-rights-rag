"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

export function CaseLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cases/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "เข้าสู่ระบบไม่สำเร็จ");
      router.push("/cases");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="case-login-form" onSubmit={submit}>
      <label>อีเมลองค์กร<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>รหัสผ่าน<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="case-form-error" role="alert">{error}</p>}
      <button type="submit" className="case-primary-button" disabled={loading}><LogIn size={17} /> {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}</button>
    </form>
  );
}
