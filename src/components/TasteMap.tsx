"use client";

import { useEffect, useRef } from "react";
import { Map as MlMap, Marker, Popup, NavigationControl, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City } from "@/lib/cities";
import type { Entity, TastePlan } from "@/lib/types";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

interface Props {
  city: City;
  plan?: TastePlan;
  /** entity ids to emphasise (e.g. the selected day) */
  focusIds?: string[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function popupHtml(e: Entity, label?: string) {
  return `<div style="max-width:220px">
    ${label ? `<div style="font-size:11px;color:#8b8274;text-transform:uppercase;letter-spacing:.06em">${esc(label)}</div>` : ""}
    <div style="font-weight:600;font-size:14px;margin:2px 0">${esc(e.name)}</div>
    ${e.neighbourhood ? `<div style="font-size:12px;color:#5b544a">${esc(e.neighbourhood)}</div>` : ""}
    ${e.affinity !== undefined ? `<div style="font-size:12px;color:#d4532a;margin-top:4px">${Math.round(e.affinity * 100)}% taste affinity</div>` : ""}
  </div>`;
}

export default function TasteMap({ city, plan, focusIds, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, { m: Marker; node: HTMLElement }>>(new Map());
  const ready = useRef(false);
  const queue = useRef<(() => void)[]>([]);
  const whenReady = (fn: () => void) => { if (ready.current) fn(); else queue.current.push(fn); };

  // init
  useEffect(() => {
    if (!el.current) return;
    const m = new MlMap({
      container: el.current,
      style: STYLE,
      center: [city.lon, city.lat],
      zoom: city.zoom,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      ready.current = true;
      m.addSource("hoods", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "hoods-fill", type: "circle", source: "hoods", paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["*", ["get", "r"], 0.35], 14, ["*", ["get", "r"], 2.6]],
        "circle-color": "#d4532a",
        "circle-opacity": ["*", ["get", "w"], 0.16],
        "circle-stroke-color": "#d4532a",
        "circle-stroke-opacity": ["*", ["get", "w"], 0.5],
        "circle-stroke-width": 1,
      } });
      m.addLayer({ id: "hoods-label", type: "symbol", source: "hoods", layout: {
        "text-field": ["get", "label"], "text-size": 12, "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-offset": [0, 0], "text-allow-overlap": false,
      }, paint: { "text-color": "#9a3a1b", "text-halo-color": "#fffdf8", "text-halo-width": 1.5 } });
      m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#1f6b66", "line-width": 3, "line-dasharray": [1.5, 1.5], "line-opacity": 0.8 } });
      queue.current.splice(0).forEach((fn) => fn());
    });
    map.current = m;
    const current = markers.current;
    return () => { current.forEach(({ m: mk }) => mk.remove()); current.clear(); m.remove(); map.current = null; ready.current = false; };
  }, [city]);

  // plan layers + markers
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      markers.current.forEach(({ m: mk }) => mk.remove());
      markers.current.clear();
      const hoods = (m.getSource("hoods") as unknown as { setData: (d: unknown) => void } | undefined);
      if (!plan) { hoods?.setData({ type: "FeatureCollection", features: [] }); return; }
      hoods?.setData({
        type: "FeatureCollection",
        features: plan.neighbourhoods.slice(0, 4).map((n, i) => ({
          type: "Feature", geometry: { type: "Point", coordinates: [n.lon, n.lat] },
          properties: { r: 60 - i * 8, w: n.score / 100, label: `${i + 1}. ${n.name}` },
        })),
      });
      const bounds = new LngLatBounds();
      const add = (e: Entity, cls: string, text: string, label?: string) => {
        if (e.lat === undefined || e.lon === undefined || markers.current.has(e.id)) return;
        const node = document.createElement("button");
        node.className = `tb-pin ${cls}`;
        node.textContent = text;
        node.setAttribute("aria-label", e.name);
        node.addEventListener("click", () => onSelect?.(e.id));
        const mk = new Marker({ element: node }).setLngLat([e.lon, e.lat])
          .setPopup(new Popup({ offset: 16, closeButton: false }).setHTML(popupHtml(e, label))).addTo(m);
        markers.current.set(e.id, { m: mk, node });
        bounds.extend([e.lon, e.lat]);
      };
      plan.matches.forEach((mt, i) => add(mt.target, "", String(i + 1), `now · like ${mt.source.name}`));
      plan.week.forEach((d) => d.items.forEach((it) => add(it.entity, "extra", "", `${d.day} ${it.time}`)));
      plan.extras.forEach((e) => add(e, "extra", "", "also for you"));
      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 900 });
    };
    whenReady(draw);
  }, [plan, onSelect]);

  // focus (selected day) + route
  useEffect(() => {
    const m = map.current;
    if (!m || !plan) return;
    const apply = () => {
      const focus = new Set(focusIds ?? []);
      markers.current.forEach(({ node }, id) => {
        node.classList.toggle("dim", focus.size > 0 && !focus.has(id));
        node.classList.toggle("on", id === selectedId || focus.has(id));
      });
      const pts = (focusIds ?? []).map((id) => markers.current.get(id)?.m.getLngLat()).filter(Boolean) as { lng: number; lat: number }[];
      const route = m.getSource("route") as unknown as { setData: (d: unknown) => void } | undefined;
      route?.setData({ type: "FeatureCollection", features: pts.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map((p) => [p.lng, p.lat]) } }] : [] });
      if (pts.length) {
        const b = new LngLatBounds();
        pts.forEach((p) => b.extend([p.lng, p.lat]));
        m.fitBounds(b, { padding: 90, maxZoom: 14.5, duration: 800 });
      }
      if (selectedId) {
        const hit = markers.current.get(selectedId);
        if (hit) { m.flyTo({ center: hit.m.getLngLat(), zoom: Math.max(m.getZoom(), 14), duration: 700 }); if (!hit.m.getPopup()?.isOpen()) hit.m.togglePopup(); }
      }
    };
    whenReady(apply);
  }, [focusIds, selectedId, plan]);

  return <div ref={el} className="h-full w-full" role="region" aria-label={`Map of ${city.name}`} />;
}
