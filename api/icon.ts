import type { IncomingMessage, ServerResponse } from "node:http";

const SVG = `<svg width="222" height="222" viewBox="0 0 222 222" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M170.83 0H50.48C22.6007 0 0 22.6008 0 50.4801V170.83C0 198.709 22.6007 221.31 50.48 221.31H170.83C198.709 221.31 221.31 198.709 221.31 170.83V50.4801C221.31 22.6008 198.709 0 170.83 0Z" fill="black"/>
<path d="M151.42 147.51L195.66 103.74L151.42 59.9202" fill="#00CF94"/>
<path d="M70.6 59.92V147.51H114.84V103.74H92.82" fill="#00DEB2"/>
<path d="M114.84 103.74C114.84 116.006 104.906 125.94 92.6401 125.94C80.3741 125.94 70.4401 116.006 70.4401 103.74C70.4401 91.4741 80.3741 81.5401 92.6401 81.5401C104.906 81.5401 114.84 91.4741 114.84 103.74Z" fill="black"/>
</svg>`;

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(SVG);
}
