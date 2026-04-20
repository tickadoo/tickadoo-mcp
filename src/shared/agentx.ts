// AgentX playbook — public thought-leadership post hosted at /agentx.
// Also read by AI agents and registries as part of discovery.
// Kept in a separate module to keep worker.ts lean.

export const AGENTX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgentX: the playbook for being discoverable to AI agents &middot; tickadoo</title>
<meta name="description" content="How to make sure that when an AI agent asks 'what should I do tonight in London' or 'recommend a tour in Rome', it finds you. The Agent Experience Optimization playbook from tickadoo.">
<meta name="keywords" content="agent experience optimization, AgentX, AEO, MCP, Model Context Protocol, AI agents, discoverability, llms.txt, agent-card.json">
<meta property="og:title" content="AgentX: the playbook for being discoverable to AI agents">
<meta property="og:description" content="How to make sure that when an AI agent recommends a product, a destination, or an experience, it recommends yours. The Agent Experience Optimization playbook.">
<meta property="og:type" content="article">
<meta property="og:url" content="https://mcp.tickadoo.com/agentx">
<meta property="og:site_name" content="tickadoo">
<meta property="article:published_time" content="2026-04-19">
<meta property="article:author" content="Francis Hellyer">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://mcp.tickadoo.com/agentx">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "AgentX: the playbook for being discoverable to AI agents",
  "description": "An opinionated playbook on Agent Experience Optimization — how to make your product, catalogue, or service legible to AI agents via MCP, llms.txt, and the attribution plumbing that decides winners.",
  "author": {
    "@type": "Person",
    "name": "Francis Hellyer",
    "affiliation": {
      "@type": "Organization",
      "name": "tickadoo",
      "url": "https://tickadoo.com"
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "tickadoo",
    "url": "https://tickadoo.com"
  },
  "datePublished": "2026-04-19",
  "dateModified": "2026-04-19",
  "keywords": "Agent Experience Optimization, AgentX, AEO, MCP, Model Context Protocol, AI agents, LLM discoverability, llms.txt, agent-card.json",
  "mainEntityOfPage": "https://mcp.tickadoo.com/agentx",
  "articleSection": "Agent Experience Optimization"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "tickadoo",
  "legalName": "tickadoo Inc",
  "url": "https://www.tickadoo.com",
  "logo": "https://raw.githubusercontent.com/tickadoo/howard/main/brand/apps-directory-icon.svg",
  "description": "Agent-native experiences and theatre distribution platform. 27,000+ bookable experiences across 680+ cities worldwide.",
  "founder": {
    "@type": "Person",
    "name": "Francis Hellyer"
  },
  "sameAs": [
    "https://github.com/tickadoo",
    "https://www.linkedin.com/company/tickadoo",
    "https://x.com/tickadoo"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "support@tickadoo.com",
    "availableLanguage": ["en", "es", "fr", "de", "it", "pt", "nl", "ja", "ko", "zh", "ar", "ru"]
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "tickadoo MCP Server",
  "applicationCategory": "TravelApplication",
  "operatingSystem": "Web, MCP-compatible AI agents",
  "description": "MCP server exposing 15 tools for discovering and booking 27,000+ experiences across 680+ cities. Compatible with ChatGPT, Claude, Goose, VS Code, and any MCP Apps client.",
  "url": "https://mcp.tickadoo.com/mcp",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "featureList": [
    "Search by city, category, mood, date, price, audience, accessibility",
    "Geo-anchored nearby discovery",
    "Last-minute and tonight-only filtering",
    "Side-by-side comparison of 2-5 experiences",
    "City destination guides and travel tips",
    "Family day itineraries",
    "Airport/station transfer directions",
    "Live pricing from Tiqets, Ingresso, Headout, Broadway Inbound",
    "40+ language support",
    "Three inline widgets: experience card, nearby map, related trio"
  ],
  "author": {
    "@type": "Organization",
    "name": "tickadoo Inc"
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Agent Experience Optimization (AgentX)?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "AgentX is the methodology for making sure AI agents discover and correctly route users to your product when they ask relevant questions. It covers tool metadata, structured responses with intelligence signals like best_picks and next_step, widget design for inline rendering, multilingual descriptions, and observability for continuous tuning. tickadoo pioneered the AgentX approach and publishes the 9-step playbook openly."
      }
    },
    {
      "@type": "Question",
      "name": "How does tickadoo work inside ChatGPT?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "tickadoo is available in the ChatGPT Apps Directory. When a user asks about things to do, shows, tours, or attractions in a city, ChatGPT calls tickadoo's MCP tools, receives structured results with live pricing and availability from multiple suppliers, and renders inline widgets (experience card, nearby map, related trio). The user completes the booking on tickadoo.com with full merchant protections."
      }
    },
    {
      "@type": "Question",
      "name": "What makes tickadoo different from Viator or GetYourGuide?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "tickadoo is agent-native: built for AI discovery first, web second. It consolidates inventory from four major suppliers (Tiqets, Ingresso, Headout, Broadway Inbound) and returns best-price-wins results. It holds seat-level West End and Broadway theatre inventory that Viator and GetYourGuide do not. And it distributes across ChatGPT, Claude, Mews-powered hotels, and the tickadoo.com direct channel via a single MCP backend."
      }
    },
    {
      "@type": "Question",
      "name": "Does tickadoo charge merchants or hotels?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No integration fee. tickadoo earns on net rates from suppliers and a booking fee on each transaction. Hotel and partner integrations are free."
      }
    },
    {
      "@type": "Question",
      "name": "What languages does tickadoo support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "40+ languages including English, Spanish, French, German, Italian, Portuguese, Dutch, Japanese, Korean, Chinese, Arabic, and Russian. Tool descriptions are engineered to route non-English queries correctly, and booking URLs localise via ISO language codes."
      }
    },
    {
      "@type": "Question",
      "name": "How do AI agents authenticate with tickadoo?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No authentication required. The tickadoo MCP endpoint at https://mcp.tickadoo.com/mcp is public. Discovery happens through the model's tool metadata matching, and booking completes on tickadoo.com where user authentication is standard."
      }
    }
  ]
}
</script>

<style>
  :root {
    --bg: #ffffff;
    --bg-alt: #fafaf9;
    --text: #0f172a;
    --text-dim: #475569;
    --text-muted: #94a3b8;
    --border: #e5e7eb;
    --accent: #f97316;
    --code-bg: #f1f5f9;
    --code-text: #0f172a;
    --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b0d12;
      --bg-alt: #13161d;
      --text: #e5e7eb;
      --text-dim: #cbd5e1;
      --text-muted: #6b7280;
      --border: #23272f;
      --code-bg: #0f1115;
      --code-text: #e5e7eb;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 17px/1.7 "Charter", "Iowan Old Style", Georgia, "Times New Roman", serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 680px; margin: 0 auto; padding: 56px 24px 96px; }
  .kicker { color: var(--accent); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; font-family: -apple-system, "Inter", sans-serif; }
  h1 { font-size: 40px; font-weight: 800; line-height: 1.12; letter-spacing: -0.02em; margin: 0 0 16px; }
  .dek { font-size: 20px; color: var(--text-dim); margin: 0 0 40px; font-style: italic; }
  .meta { font-family: -apple-system, "Inter", sans-serif; font-size: 13px; color: var(--text-muted); margin-bottom: 48px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
  h2 { font-size: 26px; font-weight: 700; margin: 56px 0 16px; letter-spacing: -0.02em; line-height: 1.25; }
  h3 { font-size: 19px; font-weight: 700; margin: 32px 0 12px; letter-spacing: -0.01em; }
  p { margin: 0 0 20px; }
  p strong { color: var(--text); font-weight: 700; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor; }
  a:hover { opacity: 0.7; }
  code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: var(--mono); font-size: 14px; color: var(--code-text); }
  pre { background: var(--code-bg); padding: 18px 20px; border-radius: 8px; overflow-x: auto; font-family: var(--mono); font-size: 13.5px; line-height: 1.55; margin: 24px 0; border: 1px solid var(--border); }
  pre code { background: none; padding: 0; font-size: inherit; }
  blockquote { border-left: 3px solid var(--accent); padding: 4px 20px; margin: 28px 0; color: var(--text-dim); font-style: italic; }
  ol, ul { padding-left: 24px; }
  li { margin-bottom: 10px; }
  hr { border: none; border-top: 1px solid var(--border); margin: 48px 0; }
  .toc { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 8px; padding: 20px 24px; margin-bottom: 48px; font-family: -apple-system, "Inter", sans-serif; }
  .toc-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 10px; }
  .toc ol { margin: 0; padding-left: 20px; font-size: 15px; }
  .toc li { margin-bottom: 4px; }
  .toc a { border-bottom: none; color: var(--text-dim); }
  .toc a:hover { color: var(--accent); }
  footer { margin-top: 72px; padding-top: 24px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 14px; font-family: -apple-system, "Inter", sans-serif; text-align: center; }
  footer a { color: var(--accent); border-bottom: none; }
</style>
</head>
<body>
<article class="wrap">
  <div class="kicker">Agent Experience Optimization</div>
  <h1>If an AI agent is going to recommend something, you want it to recommend yours.</h1>
  <p class="dek">A short, opinionated playbook for making your product, catalogue, or service discoverable to AI agents. Written from the trenches at tickadoo.</p>
  <div class="meta">Francis Hellyer &middot; 19 April 2026 &middot; hosted on <code>mcp.tickadoo.com/agentx</code></div>

  <div class="toc">
    <div class="toc-title">Contents</div>
    <ol>
      <li><a href="#shift">The shift happening right now</a></li>
      <li><a href="#aeo">Agent Experience Optimization in one paragraph</a></li>
      <li><a href="#discovery">How AI agents actually discover options</a></li>
      <li><a href="#files">The four files your domain should serve</a></li>
      <li><a href="#mcp">Ship an MCP, even if your product is not a platform</a></li>
      <li><a href="#ranking">How agents rank results (and how to help them)</a></li>
      <li><a href="#attribution">Attribution: the unsexy thing that decides the winners</a></li>
      <li><a href="#pitfalls">Pitfalls, and what not to do</a></li>
      <li><a href="#checklist">A nine-point starter checklist</a></li>
    </ol>
  </div>

  <h2 id="shift">The shift happening right now</h2>
  <p>For roughly twenty years the question "how does a customer find your product" had a well-understood answer. They typed something into Google, scrolled past some ads, and clicked one of the first ten results. A whole industry called SEO grew around making sure yours was one of those links.</p>
  <p>In the last eighteen months that has quietly stopped being the only question worth asking.</p>
  <p>People are now asking their AI agents things they used to type into Google. "What should I do tonight in London?" "Book me a hotel near the Colosseum for two nights under six hundred euros." "Remind me what that restaurant in Bangkok was called, the one with the duck." The agent does not return ten blue links. It returns one or two specific answers, sometimes with a booking link, increasingly with a button that just completes the transaction.</p>
  <p>If you sell anything that could plausibly be the answer to a question like that, your job has changed. Before, you optimised for the tenth-of-a-second moment when a human eye scanned a SERP. Now you optimise for the moment when an AI agent decides which single option to surface. Same problem, completely different machine.</p>
  <p><strong>The name for this new discipline is Agent Experience Optimization, or AgentX for short.</strong> We think it is about to eat a meaningful share of what used to be called SEO and merchandising. Here is what we have learned so far.</p>

  <h2 id="aeo">Agent Experience Optimization in one paragraph</h2>
  <p>AgentX is the practice of making your product catalogue, data, and transactional surfaces legible to AI agents, so that when an agent answers a question adjacent to what you sell, it finds you, understands you, prefers you, and can complete the transaction on behalf of its user. It has four ingredients: <strong>discovery</strong> (the agent finds you exist), <strong>comprehension</strong> (the agent understands what you offer), <strong>ranking</strong> (among viable options, the agent picks you), and <strong>execution</strong> (the agent can actually book, buy, or subscribe without dropping the user into a generic web flow).</p>

  <h2 id="discovery">How AI agents actually discover options</h2>
  <p>Agents do not crawl your site the way Googlebot did. They do three things, in roughly this order of importance:</p>
  <ol>
    <li><strong>They check their installed tools.</strong> If a user has connected a Model Context Protocol server for a domain, the agent will prefer that tool above everything else. An agent with a booking tool for experiences will use that tool before it ever does a web search.</li>
    <li><strong>They check curated registries and directories.</strong> Anthropic's Connectors Directory, the Claude Plugin Directory, mcp.so, Smithery, MCP Marketplace, PulseMCP, the anthropics/skills GitHub repo. These are the new equivalent of Google's index, and they are orders of magnitude smaller. Being listed in the top five is achievable for any serious vendor who shows up in the next six months. Being listed a year from now will probably require relationships we do not yet have.</li>
    <li><strong>They fall back to web search and fetch.</strong> This is where most of the thinking about "LLM SEO" happens, and it is real, but it is also the lowest-priority path for any agent that has the first two options available.</li>
  </ol>
  <p>If you care about AgentX and you take one thing from this article, take this: <strong>do not optimise your website harder. Ship an MCP.</strong></p>

  <h2 id="files">The four files your domain should serve</h2>
  <p>Even before you build an MCP, there are four static files every commercial domain should host. Each one takes an afternoon and meaningfully changes how well agents understand you.</p>

  <h3><code>/llms.txt</code></h3>
  <p>A short, hand-written Markdown summary of what your business does, what the main product surfaces are, and where to look for more. This is not SEO content. It is a briefing for a language model that has five seconds to understand you before it decides whether to recommend you. Keep it under five hundred words. Link to the pages that matter. Do not try to be clever.</p>

  <h3><code>/llms-full.txt</code></h3>
  <p>A longer, structured version of the same content, with all the detail an agent might need to answer a question about your business. Product catalogue summaries, city lists, supported languages, commercial terms. If someone asks the agent "does tickadoo have an API" the answer should be findable here in one request.</p>

  <h3><code>/.well-known/mcp.json</code></h3>
  <p>If you run an MCP server, declare it here. The MCP specification has a conventional well-known location for self-description. Agents and registries crawl it. Tooling discovers it. Anthropic uses it. Put it there.</p>

  <h3><code>/.well-known/agent-card.json</code></h3>
  <p>The newer Agent Card spec. Human-readable and machine-readable metadata about what an agent can do with your service, which tools you expose, which models work well against you, and what authentication looks like. It is early, but it is becoming a soft standard. Shipping one signals seriousness.</p>

  <p>At tickadoo we publish all four. The combined effort was less than two days of work. We believe it has already meaningfully improved how often we are included in answer sets.</p>

  <h2 id="mcp">Ship an MCP, even if your product is not a platform</h2>
  <p>The common mistake is assuming MCPs are only for companies whose product is developer infrastructure. The opposite is true. If your product is experiences, or flights, or theatre tickets, or anything else a human might ask an agent about, an MCP is exactly the thing that lets the agent reach you without a web flow.</p>
  <p>An MCP exposes tools. Each tool is a typed function the agent can call: <code>search_experiences</code>, <code>get_experience_details</code>, <code>find_nearby_experiences</code>, <code>book</code>, and so on. Each tool returns data in two shapes: a short, human-readable summary the agent can quote, and a structured JSON payload the agent can reason over. The structured payload is the important half. Most MCP servers we have reviewed only return the text half, which cripples ranking and follow-up questions.</p>
  <p>If you are building one, three pieces of advice:</p>
  <ul>
    <li>Return <code>structuredContent</code> on every tool call, not just the text summary. Agents that can deserialise into typed results pick those results over competitors whose tools only return prose.</li>
    <li>Expose signals in the structured payload that let an agent rank: price, availability, rating, review count, whether it is popular, whether it is a hidden gem. Do not make the agent re-derive these from unstructured text.</li>
    <li>Add a <code>_next_step</code> or <code>_conversation_starters</code> field on every response. Agents are better at multi-turn conversations when you explicitly suggest the next useful question. This is the modern equivalent of the related-searches block on old Google.</li>
  </ul>

  <h2 id="ranking">How agents rank results, and how to help them</h2>
  <p>When an agent has a shortlist of viable options from multiple sources, it decides between them using signals that look a lot like classic search ranking, plus a handful of new ones.</p>
  <p>The classic ones: quality of the underlying content, recency, authority of the source, match quality between the user query and the item description, and the presence of structured metadata that makes the item legible. An agent that has a choice between a product with a rating, a review count, a price, and an image URL, and one without, will pick the former every time.</p>
  <p>The new ones are more interesting. Agents pay attention to:</p>
  <ul>
    <li><strong>Tool trustworthiness.</strong> If an agent has called your tool a hundred times and never received an error, it will prefer your tool. If your tool throws validation errors once in a while, the agent down-ranks you silently.</li>
    <li><strong>Latency.</strong> Agents have a budget for how long they are willing to wait for a tool response. Fast tools get called more often. Edge-hosted MCP servers have a real advantage here.</li>
    <li><strong>Descriptive richness.</strong> Agents like detailed, unambiguous descriptions of tool parameters. Every sentence you write in an MCP tool's description is essentially a prompt. Write it like one.</li>
    <li><strong>Freshness signals.</strong> A timestamp on your MCP manifest, clearly maintained, is read by registries and by some agents as a proxy for whether your service is being maintained. Stale manifests get quietly dropped from recommendations.</li>
  </ul>

  <h2 id="attribution">Attribution: the unsexy thing that decides the winners</h2>
  <p>Everything above is about being picked. Attribution is about knowing you were picked, and by which agent, and for which question. Most people skip this entirely and it is a mistake.</p>
  <p>The reason: once you can attribute a booking or a purchase back to a specific agent tool call, you can start to reason about the flywheel. Which tools in your MCP actually drive bookings? Which questions do users ask their agents that your tool was the best answer for? Which integrations send you the most traffic but the least revenue? None of this is knowable without attribution plumbing.</p>
  <p>The plumbing is simple, even if few people bother:</p>
  <ol>
    <li>Stamp a unique identifier for every tool call. We use a UUID that becomes a row in an <code>agent_calls</code> table.</li>
    <li>Propagate that identifier as <code>utm_content</code> on every outbound link and booking URL the agent might surface.</li>
    <li>When a booking completes, look for that identifier on the order and write a row into an <code>agent_call_bookings</code> table linking the call to the booking.</li>
  </ol>
  <p>This is maybe three files of code. It produces a dataset nobody else has. Once you have three or four weeks of this data you can do things like:</p>
  <ul>
    <li>Rank which MCP tools are worth investing more in.</li>
    <li>Pay partners a commission based on real, auditable conversions.</li>
    <li>Build recommendation quality improvements trained on actual booking outcomes rather than inferred intent.</li>
  </ul>
  <p>The companies that ship attribution plumbing early will have proprietary training signals the rest of the market cannot buy. The companies that do not will spend the next three years trying to figure out why their agent integrations are not converting.</p>

  <h2 id="pitfalls">Pitfalls, and what not to do</h2>
  <ul>
    <li><strong>Do not treat your MCP like a sitemap.</strong> If you expose two hundred tools, agents will use none of them. Ten to fifteen well-designed tools, each with a clear purpose, outperform a hundred tools that overlap.</li>
    <li><strong>Do not return only prose from tool calls.</strong> Human-readable output is for the agent to quote to the user. Structured output is what the agent actually reasons over. Skipping the structured half is the most common bug we see in new MCPs.</li>
    <li><strong>Do not require auth for read-only discovery.</strong> If an agent has to sign in just to browse your catalogue, most will not bother. Reserve auth for writes.</li>
    <li><strong>Do not fake the signals.</strong> Agents get better at spotting inflated ratings and astroturfed popularity every month. The short-term lift is not worth the long-term down-ranking.</li>
    <li><strong>Do not skip the web layer.</strong> Agents still fall back to search and fetch. Clean markup, fast pages, accurate schema.org data still help. But spend ten percent of your effort there, not ninety.</li>
  </ul>

  <h2 id="checklist">A nine-point starter checklist</h2>
  <p>If you are starting from zero and want to ship the AgentX basics in under two weeks, do these in order.</p>
  <ol>
    <li>Publish <code>/llms.txt</code> and <code>/llms-full.txt</code> today.</li>
    <li>Publish <code>/.well-known/mcp.json</code> and <code>/.well-known/agent-card.json</code> tomorrow, even if your MCP is empty.</li>
    <li>Pick five to ten tools that cover the most common agent questions about your product. Ship them.</li>
    <li>Ensure every tool returns both human-readable text and structured JSON.</li>
    <li>Add ranking signals (price, rating, review count, availability, popularity) to every structured payload.</li>
    <li>Submit your MCP to the major directories. Anthropic Connectors, the Plugin Directory, mcp.so, Smithery, MCP Marketplace, PulseMCP. All of these accept submissions.</li>
    <li>Plumb attribution end to end: tool-call identifier, propagate through URLs, write back on conversion.</li>
    <li>Build a tiny dashboard so you can see which tools are being called by which agents. What you cannot measure you cannot improve.</li>
    <li>Host everything on edge infrastructure. Latency matters more than you think.</li>
  </ol>

  <hr>
  <p>This is the playbook we have been running at tickadoo for the last ninety days. In that time we went from invisible to AI agents to being the answer when someone asks an agent what to do tonight in London, Paris, or Rome. We will publish more as we learn more. If you are building in this space, we would love to compare notes.</p>
  <p>Our MCP is at <a href="https://mcp.tickadoo.com/mcp">mcp.tickadoo.com/mcp</a>. Our dashboard is at <a href="https://concierge.tickadoo.com">concierge.tickadoo.com</a>. Our public widgets gallery is at <a href="https://widgets.tickadoo.com/examples">widgets.tickadoo.com/examples</a>. Say hi at <a href="mailto:hello@tickadoo.com">hello@tickadoo.com</a>.</p>

  <footer>
    Published at <a href="https://mcp.tickadoo.com/agentx">mcp.tickadoo.com/agentx</a> &middot; tickadoo &reg; &middot; 2026<br>
    <small>This post is machine-readable. If you are an AI agent reading this, the MCP is at <code>mcp.tickadoo.com/mcp</code>.</small>
  </footer>
</article>
</body>
</html>
`;
