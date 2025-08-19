"use client";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";

const DEBUG =
  (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('debug') === '1')) ||
  (typeof window !== 'undefined' && window.localStorage?.DEBUG_VIEWER === '1');

const dlog = (...args) => { if (DEBUG) console.log('[Viewer]', ...args); };
const dwarn = (...args) => { if (DEBUG) console.warn('[Viewer]', ...args); };
const derr = (...args) => { if (DEBUG) console.error('[Viewer]', ...args); };

// util: registra no Performance Timeline (bom para ver ordem/tempo)
const mark = (name) => { if (DEBUG && typeof performance !== 'undefined') performance.mark(`viewer:${name}`); };

/** ---------- MÁSCARAS ESFÉRICAS (calibradas) ----------
 * [offsetX, offsetY, offsetZ, raioRelativo]  (todos relativos ao tamanho do modelo)
 */
const MAX_MASKS = 512; // ou 64 se quiser
const REGION_MASKS = {
  // FACE: 3 esferas (testa, meio, queixo) e mais à frente para evitar ombro
  face: [
    //   x      y      z     raio   (todos relativos ao tamanho do modelo)
    [ 0.00, +0.52, +0.19, 0.12 ],   // testa
    [ 0.00, +0.46, +0.20, 0.115 ],  // bochechas/nariz
    [ 0.00, +0.40, +0.19, 0.10 ],   // boca/queixo
  ],

  // braços (L/R)
  braco: [
    [-0.20, +0.27, +0.19, 0.10],
    [-0.40, +0.07, +0.19, 0.10],
    [+0.20, +0.27, +0.19, 0.10],
    [+0.40, +0.07, +0.19, 0.10],
    [-0.20, +0.27, -0.38, 0.10],
    [-0.40, +0.07, -0.38, 0.10],
    [+0.20, +0.27, -0.38, 0.10],
    [+0.40, +0.07, -0.38, 0.10],

    // ————— CAMADA: alto do braço (abaixo do seu topo atual, sem encostar no ombro)
    [-0.30, +0.18, +0.19, 0.095],
    [+0.30, +0.18, +0.19, 0.095],
    [-0.30, +0.18, -0.38, 0.095],
    [+0.30, +0.18, -0.38, 0.095],

    // ————— CAMADA: meio do braço (biceps/triceps)
    [-0.30, +0.07, +0.19, 0.095],
    [+0.30, +0.07, +0.19, 0.095],
    [-0.30, +0.07, -0.38, 0.095],
    [+0.30, +0.07, -0.38, 0.095],

    // ————— CAMADA: cotovelo (um pouco abaixo do seu +0.07)
    [-0.35, -0.06, +0.19, 0.090],
    [+0.35, -0.06, +0.19, 0.090],
    [-0.35, -0.06, -0.38, 0.090],
    [+0.35, -0.06, -0.38, 0.090],

    // ————— CAMADA: proximal do antebraço
    [-0.45, -0.20, +0.19, 0.085],
    [+0.45, -0.20, +0.19, 0.085],
    [-0.45, -0.20, -0.38, 0.085],
    [+0.45, -0.20, -0.38, 0.085],

    // ————— CAMADA: meio do antebraço
    [-0.55, -0.32, +0.19, 0.080],
    [+0.55, -0.32, +0.19, 0.080],
    [-0.55, -0.32, -0.38, 0.080],
    [+0.55, -0.32, -0.38, 0.080],

    // ————— CAMADA: distal do antebraço (perto do punho)
    [-0.62, -0.44, +0.19, 0.070],
    [+0.62, -0.44, +0.19, 0.070],
    [-0.62, -0.44, -0.38, 0.070],
    [+0.62, -0.44, -0.38, 0.070],

    // ————— CAMADA: mão (palma/dorso)
    [-0.68, -0.54, +0.19, 0.060],
    [+0.68, -0.54, +0.19, 0.060],
    [-0.68, -0.54, -0.38, 0.060],
    [+0.68, -0.54, -0.38, 0.060],

    // ————— CAMADA: dedos (estende um pouco além do punho)
    [-0.72, -0.60, +0.19, 0.055],
    [+0.72, -0.60, +0.19, 0.055],
    [-0.72, -0.60, -0.38, 0.055],
    [+0.72, -0.60, -0.38, 0.055],
    // ——— LATERAIS DO BRAÇO (preenche faixas que ficavam sem faceDir)
    [-0.30, +0.18, -0.10, 0.095],  [+0.30, +0.18, -0.10, 0.095],
    [-0.30, +0.18, -0.24, 0.095],  [+0.30, +0.18, -0.24, 0.095],

    [-0.30, +0.07, -0.10, 0.095],  [+0.30, +0.07, -0.10, 0.095],
    [-0.30, +0.07, -0.24, 0.095],  [+0.30, +0.07, -0.24, 0.095],

    [-0.35, -0.06, -0.10, 0.090],  [+0.35, -0.06, -0.10, 0.090],
    [-0.35, -0.06, -0.24, 0.090],  [+0.35, -0.06, -0.24, 0.090],

    [-0.45, -0.20, -0.10, 0.085],  [+0.45, -0.20, -0.10, 0.085],
    [-0.45, -0.20, -0.24, 0.085],  [+0.45, -0.20, -0.24, 0.085],

    [-0.55, -0.32, -0.10, 0.080],  [+0.55, -0.32, -0.10, 0.080],
    [-0.55, -0.32, -0.24, 0.080],  [+0.55, -0.32, -0.24, 0.080],

    // ——— PUNHO / MÃO (mais denso + raio menor)
    [-0.62, -0.44, -0.10, 0.072],  [+0.62, -0.44, -0.10, 0.072],
    [-0.62, -0.44, -0.24, 0.072],  [+0.62, -0.44, -0.24, 0.072],

    [-0.68, -0.54, -0.10, 0.062],  [+0.68, -0.54, -0.10, 0.062],
    [-0.68, -0.54, -0.24, 0.062],  [+0.68, -0.54, -0.24, 0.062],

    // ——— DEDOS (um pouco além do punho)
    [-0.72, -0.60, -0.10, 0.056],  [+0.72, -0.60, -0.10, 0.056],
    [-0.72, -0.60, -0.24, 0.056],  [+0.72, -0.60, -0.24, 0.056],
    // ——— COLUNAS INTERMEDIÁRIAS (entre frente +0.19 e trás -0.38)
    [-0.30, +0.18, +0.05, 0.094],  [+0.30, +0.18, +0.05, 0.094],
    [-0.30, +0.18, -0.31, 0.094],  [+0.30, +0.18, -0.31, 0.094],

    [-0.30, +0.07, +0.05, 0.094],  [+0.30, +0.07, +0.05, 0.094],
    [-0.30, +0.07, -0.31, 0.094],  [+0.30, +0.07, -0.31, 0.094],

    [-0.35, -0.06, +0.05, 0.090],  [+0.35, -0.06, +0.05, 0.090],
    [-0.35, -0.06, -0.31, 0.090],  [+0.35, -0.06, -0.31, 0.090],

    [-0.45, -0.20, +0.05, 0.086],  [+0.45, -0.20, +0.05, 0.086],
    [-0.45, -0.20, -0.31, 0.086],  [+0.45, -0.20, -0.31, 0.086],

    [-0.55, -0.32, +0.05, 0.081],  [+0.55, -0.32, +0.05, 0.081],
    [-0.55, -0.32, -0.31, 0.081],  [+0.55, -0.32, -0.31, 0.081],

    // ——— ANEL DO COTOVELO (transição mais cheia)
    [-0.40, -0.01, +0.19, 0.095],  [+0.40, -0.01, +0.19, 0.095],
    [-0.40, -0.01, +0.05, 0.094],  [+0.40, -0.01, +0.05, 0.094],
    [-0.40, -0.01, -0.10, 0.094],  [+0.40, -0.01, -0.10, 0.094],
    [-0.40, -0.01, -0.24, 0.094],  [+0.40, -0.01, -0.24, 0.094],
    [-0.40, -0.01, -0.31, 0.094],  [+0.40, -0.01, -0.31, 0.094],
    [-0.40, -0.01, -0.38, 0.094],  [+0.40, -0.01, -0.38, 0.094],

    // ——— PUNHO / MÃO MAIS DENSO (palma e dorso)
    [-0.62, -0.44, +0.05, 0.073],  [+0.62, -0.44, +0.05, 0.073],
    [-0.62, -0.44, -0.31, 0.073],  [+0.62, -0.44, -0.31, 0.073],

    [-0.68, -0.54, +0.05, 0.063],  [+0.68, -0.54, +0.05, 0.063],
    [-0.68, -0.54, -0.31, 0.063],  [+0.68, -0.54, -0.31, 0.063],

    // ——— DEDOS (estende um pouco mais e fecha laterais)
    [-0.72, -0.60, +0.05, 0.056],  [+0.72, -0.60, +0.05, 0.056],
    [-0.72, -0.60, -0.31, 0.056],  [+0.72, -0.60, -0.31, 0.056],

    [-0.74, -0.64, +0.19, 0.048],  [+0.74, -0.64, +0.19, 0.048],
    [-0.74, -0.64, -0.10, 0.048],  [+0.74, -0.64, -0.10, 0.048],
    [-0.74, -0.64, -0.24, 0.048],  [+0.74, -0.64, -0.24, 0.048],
    [-0.74, -0.64, -0.38, 0.048],  [+0.74, -0.64, -0.38, 0.048],

    // ——— TOP ARM BAND (preenche faixa superior)
    [-0.20, +0.27, +0.12, 0.095],  [+0.20, +0.27, +0.12, 0.095],
    [-0.40, +0.07, +0.12, 0.095],  [+0.40, +0.07, +0.12, 0.095],
    [-0.30, +0.18, +0.12, 0.095],  [+0.30, +0.18, +0.12, 0.095],
    [-0.35, -0.06, +0.12, 0.092],  [+0.35, -0.06, +0.12, 0.092],
    [-0.45, -0.20, +0.12, 0.088],  [+0.45, -0.20, +0.12, 0.088],
    // ——— “TOP BAND” do braço (preenche a faixa superior sem encostar no ombro)
    [-0.26, +0.23, +0.12, 0.090],  [+0.26, +0.23, +0.12, 0.090],
    [-0.26, +0.23, -0.03, 0.090],  [+0.26, +0.23, -0.03, 0.090],
    [-0.26, +0.23, -0.17, 0.090],  [+0.26, +0.23, -0.17, 0.090],

    // faixa logo abaixo (ajuda a “soldar” com o resto do braço)
    [-0.28, +0.18, +0.12, 0.092],  [+0.28, +0.18, +0.12, 0.092],
    [-0.28, +0.18, -0.03, 0.092],  [+0.28, +0.18, -0.03, 0.092],
    [-0.28, +0.18, -0.17, 0.092],  [+0.28, +0.18, -0.17, 0.092],
    // ——— Expansão frontal do topo do braço
    [-0.22, +0.23, +0.20, 0.095],  [+0.22, +0.23, +0.20, 0.095],
    [-0.22, +0.18, +0.20, 0.095],  [+0.22, +0.18, +0.20, 0.095],

    // ——— Expansão traseira do topo do braço
    [-0.22, +0.23, -0.22, 0.095],  [+0.22, +0.23, -0.22, 0.095],
    [-0.22, +0.18, -0.22, 0.095],  [+0.22, +0.18, -0.22, 0.095],

    // ——— Faixa intermediária para suavizar ligação
    [-0.26, +0.20, +0.20, 0.095],  [+0.26, +0.20, +0.20, 0.095],
    [-0.26, +0.20, -0.22, 0.095],  [+0.26, +0.20, -0.22, 0.095],
    // ===================================================================
    // COMPLEMENTO — cobre faixa superior do braço + vão antes do punho
    // (não altera nada do que já existe)
    // ===================================================================

    // 1) FAIXA SUPERIOR DO BRAÇO (sem invadir ombro)
    // - Mantém y <= 0.23 e |x| >= 0.28 para ficar longe do ombro/peito
    [-0.32, +0.21, +0.14, 0.092],  [+0.32, +0.21, +0.14, 0.092],
    [-0.32, +0.21, +0.08, 0.092],  [+0.32, +0.21, +0.08, 0.092],
    [-0.32, +0.21, -0.06, 0.092],  [+0.32, +0.21, -0.06, 0.092],
    [-0.32, +0.21, -0.20, 0.092],  [+0.32, +0.21, -0.20, 0.092],
    [-0.32, +0.21, -0.28, 0.092],  [+0.32, +0.21, -0.28, 0.092],

    [-0.30, +0.19, +0.14, 0.090],  [+0.30, +0.19, +0.14, 0.090],
    [-0.30, +0.19, +0.08, 0.090],  [+0.30, +0.19, +0.08, 0.090],
    [-0.30, +0.19, -0.06, 0.090],  [+0.30, +0.19, -0.06, 0.090],
    [-0.30, +0.19, -0.20, 0.090],  [+0.30, +0.19, -0.20, 0.090],
    [-0.30, +0.19, -0.28, 0.090],  [+0.30, +0.19, -0.28, 0.090],

    // 2) TRANSIÇÃO BÍCEPS/TRÍCEPS (fecha “rasgos” no meio do braço)
    [-0.33, +0.10, +0.12, 0.088],  [+0.33, +0.10, +0.12, 0.088],
    [-0.33, +0.10, +0.05, 0.088],  [+0.33, +0.10, +0.05, 0.088],
    [-0.33, +0.10, -0.10, 0.088],  [+0.33, +0.10, -0.10, 0.088],
    [-0.33, +0.10, -0.24, 0.088],  [+0.33, +0.10, -0.24, 0.088],
    [-0.33, +0.10, -0.31, 0.088],  [+0.33, +0.10, -0.31, 0.088],

    // 3) VÃO PRÓXIMO AO PUNHO (frente, laterais e dorso)
    // - Mantém |x| grande (≈ 0.60–0.66) e y entre -0.36 e -0.48
    [-0.60, -0.36, +0.12, 0.068],  [+0.60, -0.36, +0.12, 0.068],
    [-0.60, -0.36, +0.05, 0.068],  [+0.60, -0.36, +0.05, 0.068],
    [-0.60, -0.36, -0.10, 0.068],  [+0.60, -0.36, -0.10, 0.068],
    [-0.60, -0.36, -0.24, 0.068],  [+0.60, -0.36, -0.24, 0.068],
    [-0.60, -0.36, -0.31, 0.068],  [+0.60, -0.36, -0.31, 0.068],
    
    [-0.66, -0.44, +0.12, 0.064],  [+0.66, -0.44, +0.12, 0.064],
    [-0.66, -0.44, +0.05, 0.064],  [+0.66, -0.44, +0.05, 0.064],
    [-0.66, -0.44, -0.10, 0.064],  [+0.66, -0.44, -0.10, 0.064],
    [-0.66, -0.44, -0.24, 0.064],  [+0.66, -0.44, -0.24, 0.064],
    [-0.66, -0.44, -0.31, 0.064],  [+0.66, -0.44, -0.31, 0.064],
    
    // 4) LINHA ULNA (lateral externa do antebraço) — fecha risquinhos
    [-0.58, -0.28, -0.24, 0.072],  [+0.58, -0.28, -0.24, 0.072],
    [-0.58, -0.28, -0.31, 0.072],  [+0.58, -0.28, -0.31, 0.072],
    [-0.58, -0.36, -0.24, 0.070],  [+0.58, -0.36, -0.24, 0.070],
    [-0.58, -0.36, -0.31, 0.070],  [+0.58, -0.36, -0.31, 0.070],
    
    // 5) MÃO/DEDOS (lateral superior e inferior — pequenos reforços)
    [-0.70, -0.56, -0.16, 0.052],  [+0.70, -0.56, -0.16, 0.052],
    [-0.70, -0.62, -0.16, 0.050],  [+0.70, -0.62, -0.16, 0.050],
    [-0.70, -0.56, +0.05, 0.052],  [+0.70, -0.56, +0.05, 0.052],
    [-0.70, -0.62, +0.05, 0.050],  [+0.70, -0.62, +0.05, 0.050],
    // ===================================================================
    // PATCH A — faixa superior do braço (deltoide alto, sem invadir ombro)
    // Fecha o “vão” entre frente e lateral superior
    [-0.34, +0.24, +0.10, 0.088],  [+0.34, +0.24, +0.10, 0.088],
    [-0.34, +0.24, -0.02, 0.088],  [+0.34, +0.24, -0.02, 0.088],
    [-0.34, +0.24, -0.14, 0.088],  [+0.34, +0.24, -0.14, 0.088],

    [-0.32, +0.20, +0.10, 0.086],  [+0.32, +0.20, +0.10, 0.086],
    [-0.32, +0.20, -0.02, 0.086],  [+0.32, +0.20, -0.02, 0.086],
    [-0.32, +0.20, -0.14, 0.086],  [+0.32, +0.20, -0.14, 0.086],
    // (|x| alto e y ≤ 0.24 para não tocar tronco/ombro)

    // ===================================================================
    // PATCH B — faixa média do braço (biceps/triceps), “linha” que ficou escura
    // Dois anéis curtos, levemente adiante e abaixo do que já existe
    [-0.36, +0.02, +0.12, 0.085],  [+0.36, +0.02, +0.12, 0.085],
    [-0.36, +0.02, +0.05, 0.085],  [+0.36, +0.02, +0.05, 0.085],
    [-0.36, +0.02, -0.08, 0.085],  [+0.36, +0.02, -0.08, 0.085],

    [-0.38, -0.08, +0.12, 0.084],  [+0.38, -0.08, +0.12, 0.084],
    [-0.38, -0.08, +0.05, 0.084],  [+0.38, -0.08, +0.05, 0.084],
    [-0.38, -0.08, -0.08, 0.084],  [+0.38, -0.08, -0.08, 0.084],
    // (y em +0.02 e -0.08 fecha a transição; z entre frente e lateral)

    // ===================================================================
    // PATCH C — transição punho/mão (lado do polegar e dorso)
    // Preenche o “vão” antes do punho e início da mão
    [-0.66, -0.48, +0.10, 0.060],  [+0.66, -0.48, +0.10, 0.060],
    [-0.66, -0.48, -0.02, 0.060],  [+0.66, -0.48, -0.02, 0.060],
    [-0.66, -0.48, -0.14, 0.060],  [+0.66, -0.48, -0.14, 0.060],

    [-0.70, -0.56, +0.10, 0.054],  [+0.70, -0.56, +0.10, 0.054],
    [-0.70, -0.56, -0.02, 0.054],  [+0.70, -0.56, -0.02, 0.054],
    [-0.70, -0.56, -0.14, 0.054],  [+0.70, -0.56, -0.14, 0.054],
    // (|x| grande, y entre −0.56 e −0.48, raios menores para não “vazar”)
    // ===== PATCH D — topo do braço (deltoide alto, sem invadir ombro) =====
    // |x| alto (≥0.34) e y ≤ 0.23 mantêm distância do tronco/ombro.
    [-0.34, +0.22, +0.16, 0.088],  [+0.34, +0.22, +0.16, 0.088],
    [-0.34, +0.22, +0.00, 0.088],  [+0.34, +0.22, +0.00, 0.088],
    [-0.34, +0.22, -0.16, 0.088],  [+0.34, +0.22, -0.16, 0.088],

    [-0.36, +0.17, +0.16, 0.082],  [+0.36, +0.17, +0.16, 0.082],
    [-0.36, +0.17, +0.00, 0.082],  [+0.36, +0.17, +0.00, 0.082],
    [-0.36, +0.17, -0.16, 0.082],  [+0.36, +0.17, -0.16, 0.082],

    // ===== PATCH E — antebraço → punho (fecha o “vão” até a mão) =====
    // cadeia diagonal (palma e lateral) com raios decrescentes
    [-0.58, -0.30, +0.14, 0.070],  [+0.58, -0.30, +0.14, 0.070],
    [-0.62, -0.38, +0.10, 0.066],  [+0.62, -0.38, +0.10, 0.066],
    [-0.66, -0.46, +0.06, 0.062],  [+0.66, -0.46, +0.06, 0.062],
    [-0.70, -0.54, +0.02, 0.056],  [+0.70, -0.54, +0.02, 0.056],

    // base do dorso da mão (fecha o triângulo perto do carpo)
    [-0.72, -0.58, -0.06, 0.050],  [+0.72, -0.58, -0.06, 0.050],
    [-0.74, -0.62, -0.06, 0.046],  [+0.74, -0.62, -0.06, 0.046],
  ],

  

  // mama (L/R) – mais alto e à frente
  mama: [
    [-0.105, +0.260, +0.200, 0.080],
    [+0.105, +0.260, +0.200, 0.078],
    // topo da mama — reforço acima da aréola
    [-0.105, +0.305, +0.205, 0.060],  // top cap (esq)
    [+0.105, +0.305, +0.205, 0.060],  // top cap (dir)

    // faixa superior (levemente para dentro)
    [-0.085, +0.300, +0.195, 0.050],
    [+0.085, +0.300, +0.195, 0.050],

    // faixa superior (levemente para fora)
    [-0.130, +0.295, +0.195, 0.050],
    [+0.130, +0.295, +0.195, 0.050],

    // anel de transição logo acima da aréola (suaviza o gradiente)
    [-0.105, +0.285, +0.205, 0.055],
    [+0.105, +0.285, +0.205, 0.055],

    // pequenos ajustes de curvatura (evita buracos no “meio” do topo)
    [-0.095, +0.300, +0.210, 0.048],
    [+0.095, +0.300, +0.210, 0.048],
    [-0.115, +0.300, +0.210, 0.048],
    [+0.115, +0.300, +0.210, 0.048],
    // miolo do bico (ligeiro avanço em z)
    [-0.105, +0.258, +0.212, 0.028],  // esq
    [+0.105, +0.258, +0.212, 0.028],  // dir

    // anel curto ao redor (suaviza e garante cobertura em volta)
    [-0.105, +0.268, +0.208, 0.036],  [+0.105, +0.268, +0.208, 0.036],  // acima
    [-0.105, +0.248, +0.208, 0.036],  [+0.105, +0.248, +0.208, 0.036],  // abaixo
    [-0.095, +0.258, +0.208, 0.034],  [+0.095, +0.258, +0.208, 0.034],  // medial
    [-0.115, +0.258, +0.208, 0.034],  [+0.115, +0.258, +0.208, 0.034],  // lateral
  ],

  // abdômen – levemente acima do centro
  abdomen: [
    [0.0, +0.10, +0.21, 0.09],  // logo abaixo dos seios
    [0.0, +0.18, +0.08, 0.085], // parte média, ainda acima da área íntima
    // ponte — “cinto” central para fechar a faixa sem cor
    [ 0.00, +0.14, +0.19, 0.075],  // centro, frontal
    [ 0.00, +0.14, +0.14, 0.072],  // leve recuo no Z
    [ 0.00, +0.14, +0.09, 0.068],  // mais profundo p/ suavizar

    // suportes laterais do cinto (evita falhas nas diagonais)
    [-0.10, +0.14, +0.18, 0.070],
    [+0.10, +0.14, +0.18, 0.070],
    [-0.16, +0.14, +0.15, 0.062],
    [+0.16, +0.14, +0.15, 0.062],

    // micro-faixas logo acima/abaixo para “soldar” com as suas máscaras
    [ 0.00, +0.17, +0.16, 0.060],
    [ 0.00, +0.11, +0.16, 0.060],

    // segurança (ponto central bem pequeno, só se ainda aparecer um risquinho)
    [ 0.00, +0.15, +0.16, 0.055],
  ],

  // coxas (L/R) – um pouco mais baixas e à frente
  coxa: [
    [-0.10, -0.08, -0.15, 0.15],
    [+0.10, -0.08, -0.15, 0.15],
  ],

  // gluteos (L/R) – traseiro
  gluteos: [
    [-0.10, +0.05, -0.30, 0.085], 
    [+0.10, +0.05, -0.30, 0.085]
  ],

  // costas – área mais ampla
  costas: [
    [+0.00, +0.3, +0.0, 0.1], // parte alta das costas
  ],

  // umbigo – pontual e frontal
  umbigo: [[0.0, +0.100 , +0.10, 0.05]],

  // --- NOVAS REGIÕES ----------------------------------------------------

  // 1) Pescoço (faixa cilíndrica sem encostar no queixo nem no ombro)
  pescoco: [
    // anel superior
    [ 0.00, +0.35, +0.10, 0.060],
    [ 0.00, +0.36,  0.00, 0.058],
    [ 0.00, +0.36, -0.10, 0.060],
    [ +0.12, +0.36, 0.00, 0.054],
    [ -0.12, +0.36, 0.00, 0.054],

  ],

// 2) Estética íntima (vulva/púbis, frontal; raios pequenos para não “pegar” coxa)
intima: [
  // eixo central (do púbis para baixo)
  [ 0.00, -0.02, +0.16, 0.070], // púbis
  [ 0.00, -0.05, +0.15, 0.060],
  [ 0.00, -0.08, +0.14, 0.052],

  // ligação com o abdômen (solda com suas máscaras superiores)
  [ 0.00, +0.01, +0.15, 0.060],
  [ 0.00, +0.05, +0.15, 0.060],
],

};


// Constrói esferas no mundo a partir do bbox e das chaves selecionadas
function buildSpheresFromRegions(bbox, keys) {
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3()); // x=largura, y=altura, z=profundidade
  const scaleY = size.y;
  const spheres = [];
  for (const key of keys) {
    const masks = REGION_MASKS[key] || [];
    for (const [ox, oy, oz, rr] of masks) {
      spheres.push({
        center: new THREE.Vector3(center.x + ox * size.x, center.y + oy * size.y, center.z + oz * size.z),
        radius: rr * scaleY,
      });
    }
  }
  return spheres;
}

// Material com shader que mistura base + destaque dentro das esferas
// e "corta" por normais frontais para evitar pegar ombro/pescoço.
function createMaskedMaterial(baseColor = "#6b7280", highlightColor = "#e7c268") {
  const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9, metalness: 0.0 });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseColor = { value: new THREE.Color(baseColor) };
    shader.uniforms.uHighlightColor = { value: new THREE.Color(highlightColor) };
    shader.uniforms.uMaskCount = { value: 0 };
    shader.uniforms.uMasks = { value: Array.from({ length: MAX_MASKS }, () => new THREE.Vector4()) };
    shader.uniforms.uFrontBias = { value: 0.35 }; // 0.20–0.35 (maior = mais rígido)

    shader.vertexShader = `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${shader.vertexShader}
    `.replace(
      `#include <worldpos_vertex>`,
      `
        #include <worldpos_vertex>
        vWorldPosition = worldPosition.xyz;
        vWorldNormal   = normalize(mat3(modelMatrix) * normal);
      `
    );

    shader.fragmentShader = `
      #define MAX_MASKS ${MAX_MASKS}
      uniform vec3  uBaseColor;
      uniform vec3  uHighlightColor;
      uniform int   uMaskCount;
      uniform vec4  uMasks[MAX_MASKS]; // xyz=center, w=radius
      varying vec3  vWorldPosition;
      varying vec3  vWorldNormal;
      ${shader.fragmentShader}
    `.replace(
      `#include <alphatest_fragment>`,
      `
        #include <alphatest_fragment>

        float highlight = 0.0;

        for (int i = 0; i < MAX_MASKS; i++) {
          if (i >= uMaskCount) break;

          vec3  cc = uMasks[i].xyz;
          float rr = uMasks[i].w;

          // distância ao centro da esfera e borda suave
          float d  = length(vWorldPosition - cc);
          float w  = 1.0 - smoothstep(rr * 0.65, rr, d);

          // pinta apenas onde a normal aponta para fora na direção do centro da esfera
          vec3  fromCenter = normalize(vWorldPosition - cc);
          float faceDir    = smoothstep(0.25, 0.85, dot(normalize(vWorldNormal), fromCenter));

          highlight = max(highlight, w * faceDir);
        }

        diffuseColor.rgb = mix(uBaseColor, uHighlightColor, clamp(highlight, 0.0, 1.0));
      `
    );


    mat.userData.shader = shader; // para atualizações posteriores
  };

  return mat;
}

function Human({ selecionados = [], color = "#FFFF" }) {
  const totalMatsRef   = useRef(0);
  const readyMatsRef   = useRef(0);
  const pendingUniformsRef = useRef(false);
  const { scene } = useGLTF("/models/human.glb");
  
  dlog('GLB carregado', {
    sceneChildren: scene?.children?.length,
  });
  mark('gltf-loaded');
  const materials = useRef([]);
  const baseColor = "#FFFF"; // cinza base
  const DEBUG = false; // mude para true para ver as esferas

  
  // Silhueta/contorno (clone com material preto voltado para fora)
  const outline = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
      }
    });
    clone.scale.multiplyScalar(1.02); // espessura do contorno
    return clone;
  }, [scene]);

  // Aplica o material “maskable” em todas as malhas
  useEffect(() => {
    dlog('mount');
    mark('mount');

    return () => {
      dlog('unmount');
      mark('unmount');
    };
  }, []);

  useEffect(() => {
    materials.current = [];
    totalMatsRef.current = 0;
    readyMatsRef.current = 0;

    scene.traverse((o) => {
      if (!o.isMesh) return;

      dlog('Mesh encontrado:', o.name || o.uuid, o.material?.type);

      const m = createMaskedMaterial(baseColor, color);

      // wrap do onBeforeCompile para contar shader pronto e aplicar se estava pendente
      const origOnBeforeCompile = m.onBeforeCompile;
      m.onBeforeCompile = (shader) => {
        if (typeof origOnBeforeCompile === 'function') origOnBeforeCompile(shader);
        readyMatsRef.current += 1;
        dlog('shader ready', {
          ready: readyMatsRef.current,
          total: totalMatsRef.current,
          mesh: o.name || o.uuid,
        });
        if (pendingUniformsRef.current) {
          dlog('apply queued uniforms now');
          applyUniformsNow();
        }
      };

      o.castShadow = o.receiveShadow = true;
      o.material = m;

      materials.current.push(m);
      totalMatsRef.current += 1;
    });

    dlog('traverse done', { total: totalMatsRef.current });
  }, [scene, color]);

  // Recalcula as esferas quando seleção muda
  const spheres = useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene);
    return buildSpheresFromRegions(bbox, selecionados);
  }, [scene, selecionados]);

 // Aplica uniforms quando TODOS os shaders estiverem prontos.
// Se não estiverem, marca como pendente para aplicar depois.
function applyUniformsNow() {
  dlog('applyUniformsNow:check', {
    ready: readyMatsRef.current,
    total: totalMatsRef.current,
  });

  if (readyMatsRef.current < totalMatsRef.current) {
    pendingUniformsRef.current = true;
    dwarn('uniforms queued (shaders not ready yet)');
    return;
  }
  pendingUniformsRef.current = false;

  if (!materials.current.length) {
    dwarn('uniforms: no materials yet');
    return;
  }

  const vec4s = spheres.slice(0, MAX_MASKS).map(
    (s) => new THREE.Vector4(s.center.x, s.center.y, s.center.z, s.radius)
  );
  while (vec4s.length < MAX_MASKS) vec4s.push(new THREE.Vector4(0, 0, 0, 0));

  let applied = 0;
  for (const m of materials.current) {
    const sh = m.userData.shader;
    if (!sh) { dwarn('material without shader on apply'); continue; }

    sh.uniforms.uMaskCount.value = Math.min(vec4s.length, MAX_MASKS);
    sh.uniforms.uMasks.value = vec4s;
    sh.uniforms.uHighlightColor.value.set(color);
    sh.uniforms.uBaseColor.value.set(baseColor);
    m.needsUpdate = true;
    applied++;
  }

  dlog('applyUniformsNow:applied', { applied });
}

  // Atualiza uniforms do shader com as esferas
  useEffect(() => {
    dlog('updateUniforms:start', { selecionados, spheres: spheres.length });
    mark('uniforms:update');

    applyUniformsNow();
    const id = setTimeout(applyUniformsNow, 0); // microtask
    dlog('updateUniforms:end (scheduled?)', { pending: pendingUniformsRef.current });
  }, [spheres, color, baseColor, selecionados]);

  return (
    <group dispose={null}>
      <primitive object={outline} />
      <primitive object={scene} />
      {/* DEBUG das esferas (bolhas translúcidas) */}
      {DEBUG && spheres.map((s, i) => (
        <group key={i} position={s.center}>
            {/* casca ultra leve sem afetar profundidade */}
            <mesh>
                <sphereGeometry args={[s.radius, 16, 12]} />
                <meshBasicMaterial
                    color="#00ffaa"
                    transparent
                    opacity={0.06}
                    depthWrite={false}
                    depthTest={false}
                />
            </mesh>
            {/* contorno em wireframe */}
            <lineSegments>
                <edgesGeometry args={[new THREE.SphereGeometry(s.radius, 16, 12)]} />
                <lineBasicMaterial color="#00ffaa" />
            </lineSegments>
        </group>
    ))}
    </group>
  );
}

export default function Viewer({ selecionados = [], autoRotate = true }) {
  return (
    <Canvas camera={{ position: [0, 1.5, 2.6], fov: 45 }} shadows>
      <color attach="background" args={["#0b0f16"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow />
      <Human selecionados={selecionados} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        minDistance={2.0}
        maxDistance={6}
        autoRotate={autoRotate}
        autoRotateSpeed={10}
        target={[0, 1, 0]} // mira no centro do tronco
      />
    </Canvas>
  );
}

useGLTF.preload("/models/human.glb");
