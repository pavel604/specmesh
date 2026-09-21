import * as vscode from "vscode";
import { DocNode } from "../model/types";
import { buildGraphModel, GraphModel, GraphNode } from "./graphModel";
import { docIconKind } from "./docIcon";

const NODE_RADIUS = 16;
const CANVAS_MARGIN = 60;
const LABEL_WIDTH = 72;
const LABEL_HEIGHT = 14;

// mirrors the tree's icon distinction (instructions/skill vs. plain docs) via color instead of a codicon,
// since the webview renders plain inline SVG rather than the codicon font.
const COLOR_VARS: Record<ReturnType<typeof docIconKind>, string> = {
  instructions: "var(--vscode-charts-orange)",
  skill: "var(--vscode-charts-purple)",
  doc: "var(--vscode-charts-blue)",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderNode(node: GraphNode): string {
  const color = COLOR_VARS[docIconKind(node.type, node.fileName)];
  const letter = escapeHtml(node.fileName.charAt(0).toUpperCase());
  const strokeDasharray = node.stray ? ' stroke-dasharray="3,2"' : "";
  return `<g class="doc-node" tabindex="0" role="button" data-path="${escapeHtml(node.absolutePath)}" data-title="${escapeHtml(node.title)}" data-relpath="${escapeHtml(node.relativePath)}" aria-label="${escapeHtml(node.title)}">
    <circle cx="${node.x}" cy="${node.y}" r="${NODE_RADIUS}" fill="${color}" stroke="var(--vscode-focusBorder)"${strokeDasharray} />
    <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" font-size="11" fill="var(--vscode-editor-background)">${letter}</text>
    <foreignObject x="${node.x - LABEL_WIDTH / 2}" y="${node.y + NODE_RADIUS + 4}" width="${LABEL_WIDTH}" height="${LABEL_HEIGHT}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="doc-label">${escapeHtml(node.fileName)}</div>
    </foreignObject>
  </g>`;
}

function renderGraphHtml(model: GraphModel): string {
  if (model.nodes.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family: var(--vscode-font-family); color: var(--vscode-descriptionForeground); padding: 12px;">No tracked docs found.</body></html>`;
  }

  const minX = Math.min(...model.nodes.map((n) => n.x)) - CANVAS_MARGIN;
  const minY = Math.min(...model.nodes.map((n) => n.y)) - CANVAS_MARGIN;
  const maxX = Math.max(...model.nodes.map((n) => n.x)) + CANVAS_MARGIN;
  const maxY = Math.max(...model.nodes.map((n) => n.y)) + CANVAS_MARGIN;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const edgesSvg = model.edges
    .map((edge) => {
      const source = byId.get(edge.sourceId);
      const target = byId.get(edge.targetId);
      if (!source || !target) {
        return "";
      }
      const nesting = edge.kind === "nesting";
      const strokeWidth = nesting ? 1 : 1.5;
      const dashArray = nesting ? ' stroke-dasharray="2,3"' : "";
      return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="var(--vscode-editorWidget-border)" stroke-width="${strokeWidth}"${dashArray} marker-end="url(#arrow)" />`;
    })
    .join("\n");

  const strays = model.nodes.filter((n) => n.stray);
  const strayDivider =
    strays.length > 0 && strays.length < model.nodes.length
      ? (() => {
          const dividerY = Math.min(...strays.map((n) => n.y)) - NODE_RADIUS - 24;
          return `<line x1="${minX}" y1="${dividerY}" x2="${maxX}" y2="${dividerY}" stroke="var(--vscode-editorWidget-border)" stroke-dasharray="4,4" />
    <text x="${minX + 8}" y="${dividerY - 6}" font-size="11" fill="var(--vscode-descriptionForeground)">Unlinked</text>`;
        })()
      : "";

  const nodesSvg = model.nodes.map(renderNode).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
  #viewport-container { position: fixed; inset: 0; overflow: hidden; cursor: grab; }
  #viewport-container.panning { cursor: grabbing; }
  #canvas { width: 100%; height: 100%; display: block; }
  .doc-node { cursor: pointer; }
  .doc-node:focus circle { stroke-width: 2.5; }
  .doc-label {
    font-size: 10px; font-family: var(--vscode-font-family); color: var(--vscode-foreground);
    text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;
  }
  #zoom-controls { position: fixed; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 10; }
  #zoom-controls button {
    width: 24px; height: 24px; padding: 0; border: none; border-radius: 3px; cursor: pointer;
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
  }
  #zoom-controls button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  #tooltip {
    --tooltip-bg: color-mix(in srgb, var(--vscode-editorHoverWidget-background) 90%, transparent);
    position: fixed; z-index: 20; opacity: 0; pointer-events: none; transition: opacity 0.1s ease;
    max-width: 220px; padding: 4px 8px; border-radius: 4px; font-family: var(--vscode-font-family);
    background: var(--tooltip-bg);
    border: 1px solid var(--vscode-editorHoverWidget-border);
    transform: translate(-50%, -100%) translateY(-10px);
  }
  #tooltip.visible { opacity: 1; }
  #tooltip::after {
    content: ""; position: absolute; left: 50%; bottom: -5px; transform: translateX(-50%);
    border-width: 5px 5px 0 5px; border-style: solid; border-color: var(--tooltip-bg) transparent transparent transparent;
  }
  #tooltip-title {
    font-size: 12px; font-weight: 600;
    color: color-mix(in srgb, var(--vscode-editorHoverWidget-foreground) 95%, transparent);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  #tooltip-path {
    font-size: 11px; margin-top: 2px;
    color: color-mix(in srgb, var(--vscode-editorHoverWidget-foreground) 65%, transparent);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
</style>
</head>
<body>
  <div id="viewport-container">
    <svg id="canvas" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vscode-editorWidget-border)" />
        </marker>
      </defs>
      <g id="viewport">
        ${strayDivider}
        ${edgesSvg}
        ${nodesSvg}
      </g>
    </svg>
  </div>
  <div id="zoom-controls">
    <button id="zoom-in" title="Zoom in">+</button>
    <button id="zoom-out" title="Zoom out">&minus;</button>
    <button id="zoom-reset" title="Reset view">&#8634;</button>
  </div>
  <div id="tooltip">
    <div id="tooltip-title"></div>
    <div id="tooltip-path"></div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const container = document.getElementById("viewport-container");
    const viewport = document.getElementById("viewport");
    const tooltip = document.getElementById("tooltip");
    const tooltipTitle = document.getElementById("tooltip-title");
    const tooltipPath = document.getElementById("tooltip-path");
    const content = { minX: ${minX}, minY: ${minY}, width: ${contentWidth}, height: ${contentHeight} };

    let scale = 1;
    let x = 0;
    let y = 0;

    function applyTransform() {
      viewport.setAttribute("transform", "translate(" + x + " " + y + ") scale(" + scale + ")");
    }

    function fitToView() {
      const rect = container.getBoundingClientRect();
      scale = Math.min(rect.width / content.width, rect.height / content.height, 1.5);
      x = rect.width / 2 - (content.minX + content.width / 2) * scale;
      y = rect.height / 2 - (content.minY + content.height / 2) * scale;
      applyTransform();
    }

    function zoomBy(factor, clientX, clientY) {
      const rect = container.getBoundingClientRect();
      const px = clientX !== undefined ? clientX - rect.left : rect.width / 2;
      const py = clientY !== undefined ? clientY - rect.top : rect.height / 2;
      const newScale = Math.min(Math.max(scale * factor, 0.2), 4);
      x = px - ((px - x) * newScale) / scale;
      y = py - ((py - y) * newScale) / scale;
      scale = newScale;
      applyTransform();
    }

    container.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
    }, { passive: false });

    document.getElementById("zoom-in").addEventListener("click", () => zoomBy(1.2));
    document.getElementById("zoom-out").addEventListener("click", () => zoomBy(1 / 1.2));
    document.getElementById("zoom-reset").addEventListener("click", fitToView);

    let panning = false;
    let panStart = { x: 0, y: 0, viewX: 0, viewY: 0 };
    container.addEventListener("mousedown", (e) => {
      if (e.target.closest(".doc-node")) {
        return;
      }
      panning = true;
      container.classList.add("panning");
      panStart = { x: e.clientX, y: e.clientY, viewX: x, viewY: y };
    });
    window.addEventListener("mousemove", (e) => {
      if (!panning) {
        return;
      }
      x = panStart.viewX + (e.clientX - panStart.x);
      y = panStart.viewY + (e.clientY - panStart.y);
      applyTransform();
    });
    window.addEventListener("mouseup", () => {
      panning = false;
      container.classList.remove("panning");
    });

    const open = (el) => vscode.postMessage({ type: "openDoc", absolutePath: el.dataset.path });
    document.querySelectorAll(".doc-node").forEach((el) => {
      el.addEventListener("click", () => open(el));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(el);
        }
      });
      el.addEventListener("mouseenter", () => {
        tooltipTitle.textContent = el.dataset.title;
        tooltipPath.textContent = el.dataset.relpath;
        const rect = el.querySelector("circle").getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width / 2) + "px";
        tooltip.style.top = rect.top + "px";
        tooltip.classList.add("visible");
      });
      el.addEventListener("mouseleave", () => {
        tooltip.classList.remove("visible");
      });
    });

    window.addEventListener("resize", fitToView);
    fitToView();
  </script>
</body>
</html>`;
}

export class GraphViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private nodes: DocNode[] = [];

  update(nodes: DocNode[]): void {
    this.nodes = nodes;
    this.render();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: { type: string; absolutePath?: string }) => {
      if (message.type === "openDoc" && message.absolutePath) {
        void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(message.absolutePath));
      }
    });
    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = renderGraphHtml(buildGraphModel(this.nodes));
  }
}
