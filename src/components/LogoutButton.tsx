"use client";

export default function LogoutButton() {
  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    window.location.href = "/login";
  }
  return (
    <button onClick={logout} className="rounded border px-3 py-1 text-sm">
      Logout
    </button>
  );
}
