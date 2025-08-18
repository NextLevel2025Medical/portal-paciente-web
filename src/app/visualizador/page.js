'use client';
import { useState } from "react";
import dynamic from "next/dynamic"; // aqui pode manter 'dynamic' porque NÃO vamos exportar 'dynamic' neste arquivo
const Viewer = dynamic(() => import("./Viewer"), { ssr: false });

export default function Page() {
  const [selecionados, setSelecionados] = useState([]);
  const REGIOES = ["face", "braco", "mama", "abdomen", "coxa", "gluteos", "costas", "umbigo", "pescoco","intima"];

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#0b0f16", color: "#e7c268" }}>
      {/* MENU LATERAL */}
      <aside
        style={{
          width: 260,
          padding: "16px 20px",
          borderRight: "1px solid rgba(255,255,255,.06)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Regiões</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", rowGap: 10 }}>
          {REGIOES.map((k) => (
            <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={selecionados.includes(k)}
                onChange={(e) =>
                  setSelecionados((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))
                }
              />
              {k}
            </label>
          ))}
        </div>
      </aside>

      {/* ÁREA DO 3D */}
      <main style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <div style={{ width: "100%", height: "100vh" }}>
          <Viewer selecionados={selecionados} autoRotate />
        </div>
      </main>
    </div>
  );
}
