/**
 * Layout for the topic-map graph: 5 areas, each with a handful of topic
 * "petals" arranged around it, plus cross-cluster edges where two topics
 * share case notes.
 *
 * A general-purpose force simulation (mutual repulsion + spring edges) was
 * tried first and repeatedly settled into a ring hugging the canvas edge -
 * with only 1-2 edges per topic (one to its area) and repulsion from all 27
 * other nodes, the whole graph just wants to maximize spread, not cluster.
 * Since the hierarchy here is known upfront (each topic belongs to exactly
 * one area), placing each area's topics deterministically on a small circle
 * around it is both simpler and guaranteed to look organized - physics is
 * only used afterward, lightly, to resolve any local overlaps.
 */
import type { GraphNode } from "./types";

export interface Point {
  x: number;
  y: number;
}

export function nodeRadius(node: GraphNode): number {
  if (node.type === "area") return 28;
  return Math.max(10, Math.min(34, 9 + Math.sqrt(node.count) * 2.4));
}

export function computeLayout(nodes: GraphNode[], width: number, height: number): Map<string, Point> {
  const positions = new Map<string, Point>();
  const home = new Map<string, Point>();

  const areas = nodes.filter((n) => n.type === "area");
  const topicsByArea = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (n.type === "topic" && n.areaCode) {
      const list = topicsByArea.get(n.areaCode) ?? [];
      list.push(n);
      topicsByArea.set(n.areaCode, list);
    }
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const areaRadius = Math.min(width, height) * 0.34;

  areas.forEach((area, i) => {
    const angle = (i / areas.length) * Math.PI * 2 - Math.PI / 2;
    const ax = centerX + Math.cos(angle) * areaRadius;
    const ay = centerY + Math.sin(angle) * areaRadius;
    positions.set(area.id, { x: ax, y: ay });
    home.set(area.id, { x: ax, y: ay });

    const topics = topicsByArea.get(area.areaCode!) ?? [];
    const localRadius = Math.min(155, 60 + topics.length * 15);
    topics.forEach((topic, j) => {
      const topicAngle = (j / Math.max(topics.length, 1)) * Math.PI * 2 + angle;
      const tx = ax + Math.cos(topicAngle) * localRadius;
      const ty = ay + Math.sin(topicAngle) * localRadius;
      positions.set(topic.id, { x: tx, y: ty });
      home.set(topic.id, { x: tx, y: ty });
    });
  });

  // Light overlap-resolution pass: nudge apart any two nodes closer than the
  // sum of their radii, restrained by a spring back to their assigned "home"
  // slot so clusters keep their shape instead of collapsing into a blob.
  const radius = new Map(nodes.map((n) => [n.id, nodeRadius(n)]));
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = positions.get(nodes[i].id)!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = positions.get(nodes[j].id)!;
        const minDist = (radius.get(nodes[i].id) || 10) + (radius.get(nodes[j].id) || 10) + 6;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.5;
          dx = (dx / dist) * push;
          dy = (dy / dist) * push;
          a.x += dx;
          a.y += dy;
          b.x -= dx;
          b.y -= dy;
        }
      }
    }
    for (const n of nodes) {
      const p = positions.get(n.id)!;
      const h = home.get(n.id)!;
      p.x += (h.x - p.x) * 0.06;
      p.y += (h.y - p.y) * 0.06;
      p.x = Math.max(40, Math.min(width - 40, p.x));
      p.y = Math.max(40, Math.min(height - 40, p.y));
    }
  }

  return positions;
}
