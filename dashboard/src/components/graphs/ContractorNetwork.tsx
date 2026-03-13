import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { NetworkNode, NetworkLink } from "../../types/api";
import { formatDollars } from "../../utils/format";

interface NetworkProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  loading?: boolean;
  onNodeSelect?: (node: NetworkNode) => void;
}

const GROUP_COLORS: Record<string, string> = {
  Agency: "#f59e0b",
  "AI and Machine Learning": "#8b5cf6",
  "Cyber Security": "#ef4444",
  "Electronic Warfare": "#06b6d4",
  "Autonomous Systems": "#22c55e",
  C4ISR: "#3b82f6",
  "Space Systems": "#a855f7",
  "Missile Defense": "#f97316",
  Logistics: "#9ca3af",
  Hypersonics: "#f43f5e",
  "Training and Simulation": "#eab308",
  "Directed Energy": "#ec4899",
  "Quantum Technology": "#6366f1",
  Biotechnology: "#10b981",
  Other: "#6b7280",
};

// D3 node type (extends NetworkNode with sim coords)
interface SimNode extends NetworkNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export default function ContractorNetwork({
  nodes,
  links,
  loading,
  onNodeSelect,
}: NetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 520;

    const g = svg.append("g");

    // Zoom
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 5])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const maxVal = Math.max(...nodes.map((n) => n.value), 1);
    const sizeScale = d3.scaleSqrt().domain([0, maxVal]).range([5, 28]);
    const labelThreshold = 8; // only show persistent labels for nodes with radius > this

    const simNodes = nodes.map((n) => ({ ...n })) as SimNode[];
    const simLinks = links.map((l) => ({ ...l }));

    const simulation = d3
      .forceSimulation(simNodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(simLinks as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
          .id((d: any) => d.id)
          .distance(90)
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => sizeScale(d.value) + 5)
      );

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#374151")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => Math.max(0.5, Math.sqrt(d.value / 1e6)));

    // Nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (d) => sizeScale(d.value))
      .attr("fill", (d) => GROUP_COLORS[d.group] || GROUP_COLORS.Other)
      .attr("stroke", "#0a0e1a")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    // Labels — only for larger nodes
    const label = g
      .append("g")
      .selectAll("text")
      .data(simNodes.filter((d) => sizeScale(d.value) > labelThreshold))
      .join("text")
      .text((d) =>
        d.label.length > 22 ? d.label.slice(0, 20) + "\u2026" : d.label
      )
      .attr("font-size", 9)
      .attr("fill", "#d1d5db")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => sizeScale(d.value) + 12)
      .attr("pointer-events", "none");

    // Tooltip div
    const tooltipEl = d3
      .select(containerRef.current)
      .append("div")
      .attr(
        "class",
        "absolute hidden bg-navy-800 border border-gray-700/50 rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none z-50"
      )
      .style("max-width", "220px");

    node
      .on("mouseover", function (event, d) {
        tooltipEl
          .classed("hidden", false)
          .html(
            `<div class="font-medium text-white">${d.label}</div>` +
              `<div class="text-gray-400 mt-0.5">${d.type === "agency" ? "Agency" : d.group}</div>` +
              `<div class="text-teal-400 font-medium mt-1">${formatDollars(d.value)}</div>`
          );

        const containerRect = containerRef.current!.getBoundingClientRect();
        tooltipEl
          .style("left", `${event.clientX - containerRect.left + 12}px`)
          .style("top", `${event.clientY - containerRect.top - 10}px`);
      })
      .on("mousemove", function (event) {
        const containerRect = containerRef.current!.getBoundingClientRect();
        tooltipEl
          .style("left", `${event.clientX - containerRect.left + 12}px`)
          .style("top", `${event.clientY - containerRect.top - 10}px`);
      })
      .on("mouseout", function () {
        tooltipEl.classed("hidden", true);
      });

    // Click-to-focus: highlight connections
    node.on("click", function (event, d) {
      event.stopPropagation();

      const connectedIds = new Set<string>();
      connectedIds.add(d.id);
      simLinks.forEach((l) => {
        const sId = typeof l.source === "object" ? (l.source as any).id : l.source;
        const tId = typeof l.target === "object" ? (l.target as any).id : l.target;
        if (sId === d.id) connectedIds.add(tId);
        if (tId === d.id) connectedIds.add(sId);
      });

      node.attr("opacity", (n) => (connectedIds.has(n.id) ? 1 : 0.08));
      link.attr("opacity", (l) => {
        const sId = typeof l.source === "object" ? (l.source as any).id : l.source;
        const tId = typeof l.target === "object" ? (l.target as any).id : l.target;
        return connectedIds.has(sId) && connectedIds.has(tId) ? 0.7 : 0.03;
      });
      label.attr("opacity", (n) => (connectedIds.has(n.id) ? 1 : 0.08));

      onNodeSelect?.(d);
    });

    // Click background to reset
    svg.on("click", function () {
      node.attr("opacity", 1);
      link.attr("opacity", 0.4);
      label.attr("opacity", 1);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => {
      simulation.stop();
      tooltipEl.remove();
    };
  }, [nodes, links, onNodeSelect]);

  if (loading) {
    return <div className="skeleton h-[520px] w-full rounded-xl" />;
  }

  // Collect unique groups for legend
  const groups = [...new Set(nodes.map((n) => n.group))].sort((a, b) =>
    a === "Agency" ? -1 : b === "Agency" ? 1 : a.localeCompare(b)
  );

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Contractor Network
      </h3>
      {nodes.length === 0 ? (
        <p className="text-gray-500 text-sm h-[520px] flex items-center justify-center">
          No network data available. Load data into Fuseki first.
        </p>
      ) : (
        <>
          <div ref={containerRef} className="relative">
            <svg
              ref={svgRef}
              width="100%"
              height={520}
              className="bg-navy-800/50 rounded-lg"
            />
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {groups.map((group) => (
              <div
                key={group}
                className="flex items-center gap-1.5 text-[11px] text-gray-400"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      GROUP_COLORS[group] || GROUP_COLORS.Other,
                  }}
                />
                {group}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
