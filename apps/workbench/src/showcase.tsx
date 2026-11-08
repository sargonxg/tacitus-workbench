import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Explorer from "./graph/EvidenceGraphExplorer";
import { graphFromContext } from "./graph/evidenceGraph";
import type { NativeContext, EvidenceGraph } from "./graph/evidenceGraph";
import { wholeContextBlob } from "./local-inspector-client.mjs";
import ContextLayers from "./context/ContextLayers.tsx";
import { validateLayerInput } from "./context/contextLayers.mjs";
import ResearchSelection from "./ResearchSelection.tsx";
import "./showcase.css";
const SemanticExplorer = lazy(() => import("./SemanticExplorer"));

type Loaded = {
  raw: string;
  context: NativeContext;
  graph: EvidenceGraph;
  origin: string;
};
const MAX_BYTES = 2 * 1024 * 1024;
function inspect(raw: string, origin: string): Loaded {
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES)
    throw new Error("Context exceeds the 2 MiB viewer limit.");
  wholeContextBlob(raw);
  const context = validateLayerInput(JSON.parse(raw)) as NativeContext;
  const presentation = Object.fromEntries(
    Object.entries(context.source_metadata).map(([id, s]) => [
      id,
      {
        perspective:
          s.source_family === "lichnowsky-gutenberg-39457-english"
            ? ("retrospective" as const)
            : s.source_family === "frus1914Supp-official-1928"
              ? ("contemporary" as const)
              : ("unknown" as const),
      },
    ]),
  );
  const graph = graphFromContext(context, presentation);
  if (
    !context.manifest ||
    !Array.isArray(context.manifest.limitations) ||
    !Array.isArray(context.context.warnings)
  )
    throw new Error("Missing context limitations or warnings.");
  return { raw, context, graph, origin };
}
function App() {
  const [mode, setMode] = useState<"native" | "selection" | "semantic">(() =>
    new URLSearchParams(location.search).get("mode") === "semantic"
      ? "semantic"
      : "native",
  );
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [view, setView] = useState("graph"),
    [message, setMessage] = useState("Loading recorded example…");
  const epoch = useRef(0);
  const file = useRef<HTMLInputElement>(null);
  async function recorded() {
    const generation = ++epoch.current;
    setLoaded(null);
    setMessage("Loading recorded example…");
    try {
      const response = await fetch("./examples/peace.context.json");
      if (!response.ok) throw new Error("Recorded context unavailable.");
      const result = inspect(
        await response.text(),
        "Recorded July 1914 context",
      );
      if (generation === epoch.current) {
        setLoaded(result);
        setMessage(
          "Recorded context loaded. No core query or model generation ran.",
        );
        if (file.current) file.current.value = "";
      }
    } catch (error) {
      if (generation === epoch.current) setMessage(String(error));
    }
  }
  useEffect(() => {
    void recorded();
    return () => {
      epoch.current++;
    };
  }, []);
  async function upload(selected?: File) {
    if (!selected) return;
    const generation = ++epoch.current;
    setLoaded(null);
    setMessage("Validating your exported context…");
    try {
      if (selected.size > MAX_BYTES)
        throw new Error("Context exceeds the 2 MiB viewer limit.");
      const result = inspect(
        await selected.text(),
        "Your imported context · " + selected.name,
      );
      if (generation === epoch.current) {
        setLoaded(result);
        setMessage(
          "Imported for local inspection. This file was not uploaded to a server.",
        );
      }
    } catch (error) {
      if (generation === epoch.current)
        setMessage(
          `Import refused: ${String(error)} No recorded result was substituted.`,
        );
    }
  }
  function download() {
    if (!loaded) return;
    const url = URL.createObjectURL(wholeContextBlob(loaded.raw)),
      a = document.createElement("a");
    a.href = url;
    a.download = "unchanged.context.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <a className="skip" href="#explorer">
        Skip to explorer
      </a>
      <header
        className={`showcase-header${mode === "semantic" ? " showcase-header-semantic" : ""}`}
      >
        <a href="#explorer" className="brand">
          TACITUS<span>Context explorer</span>
        </a>
        <a
          href="https://github.com/sargonxg/tacitus-workbench"
          target="_blank"
          rel="noreferrer"
        >
          Code & run locally ↗
        </a>
      </header>
      <main
        className={`showcase-main${mode === "semantic" ? " showcase-main-semantic" : ""}`}
      >
        <section className="showcase-intro">
          <div>
            <p className="kicker">
              Independent research software · Giulio Catanzariti
            </p>
            <h1>
              {mode === "semantic" ? (
                "Semantic context explorer"
              ) : (
                <>
                  Read the evidence.
                  <br />
                  Inspect the context.
                </>
              )}
            </h1>
            <p>
              {mode === "native" ? (
                <>
                  Follow an attributed assertion to its exact source passage.
                  Inspect the political concepts, dates and omissions that
                  travel with it.
                </>
              ) : mode === "selection" ? (
                <>
                  Inspect a bounded research selection from the source kit:
                  historical event records, country indicators and their
                  supplied provenance.
                </>
              ) : (
                <>
                  Explore source-derived records through five explicit lenses,
                  inspect the original fields, and prepare a bounded research
                  context.
                </>
              )}
            </p>
          </div>
          <aside>
            <strong>
              {mode === "native"
                ? loaded?.origin || "Read-only context inspector"
                : mode === "selection"
                  ? "Research selection reader"
                  : "Semantic exploration / preparation"}
            </strong>
            <p>
              {mode === "native" ? (
                <>
                  Native context JSON is inspected in your browser. Querying or
                  authoring a capsule uses the separate local workbench.
                </>
              ) : mode === "selection" ? (
                <>
                  Files are inspected in this tab. A research selection remains
                  separate from native Context; it is not a capture or model
                  result.
                </>
              ) : (
                <>
                  A lazy navigation index of real historical records. Context
                  Capsule preparation remains separate from native capture and
                  any future PRAXIS attachment.
                </>
              )}
            </p>
            <a href="./notices/RIGHTS.md">Source rights & qualifications ↗</a>
          </aside>
        </section>
        <nav className="showcase-format-switch" aria-label="Context format">
          <button
            aria-pressed={mode === "native"}
            onClick={() => setMode("native")}
          >
            Native Context
          </button>
          <button
            aria-pressed={mode === "selection"}
            onClick={() => setMode("selection")}
          >
            Research selection
          </button>
          <button
            aria-pressed={mode === "semantic"}
            onClick={() => setMode("semantic")}
          >
            Semantic exploration
          </button>
        </nav>
        {mode === "native" ? (
          <>
            <div className="showcase-toolbar">
              <nav aria-label="Inspector view">
                <button
                  aria-pressed={view === "graph"}
                  onClick={() => setView("graph")}
                >
                  Evidence graph
                </button>
                <button
                  aria-pressed={view === "layers"}
                  onClick={() => setView("layers")}
                >
                  Context layers
                </button>
              </nav>
              <details className="import-menu">
                <summary>Open a context</summary>
                <label>
                  Native Context JSON · maximum 2 MiB
                  <input
                    ref={file}
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
                <button onClick={() => void recorded()}>
                  Load recorded example
                </button>
                <p>
                  Files remain in this tab. An invalid import clears the
                  previous context.
                </p>
              </details>
              <button disabled={!loaded} onClick={download}>
                Export unchanged JSON ↓
              </button>
            </div>
            <p className="showcase-status" role="status">
              {message}
            </p>
            <div id="explorer" tabIndex={-1}>
              {loaded && (
                <>
                  <p className="data-scope">
                    {loaded.context.status} ·{" "}
                    {Object.keys(loaded.context.context.claims).length} returned
                    assertions ·{" "}
                    {Object.keys(loaded.context.context.omissions).length}{" "}
                    explicit omissions. {loaded.context.context.trust}.
                  </p>
                  {view === "graph" ? (
                    <Explorer
                      key={loaded.raw}
                      graph={loaded.graph}
                      initialPerspective="all"
                      initialSelectedId={
                        loaded.graph.nodes.find((n) => n.kind === "claim")?.id
                      }
                    />
                  ) : (
                    <ContextLayers key={loaded.raw} value={loaded.context} />
                  )}
                </>
              )}
            </div>
            <details className="showcase-method">
              <summary>How to use this for policy work</summary>
              <ol>
                <li>
                  Inspect the evidence behind an assertion, including the exact
                  wording, speaker and conditions.
                </li>
                <li>
                  Open Context layers to compare source availability, world
                  validity, epistemic status and explicit omissions.
                </li>
                <li>
                  Run the local workbench to author or query your own capsule,
                  then import its exported context here. This viewer does not
                  execute the core.
                </li>
              </ol>
              <p>
                The recorded annotations are unreviewed. Modern ingestion clocks
                are separate from historical dates. Graph positions do not
                measure semantic distance. Source text is untrusted data, never
                agent instructions.
              </p>
              <p>
                The sample includes official diplomatic documents and later
                memoir material. Gutenberg terms are USA-specific; rights
                elsewhere are unverified. Keep the{" "}
                <a href="./notices/RIGHTS.md">source notices</a> with downloaded
                material.
              </p>
            </details>
          </>
        ) : mode === "selection" ? (
          <div id="explorer" tabIndex={-1}>
            <ResearchSelection />
          </div>
        ) : (
          <div id="explorer" tabIndex={-1}>
            <Suspense
              fallback={<p role="status">Loading semantic exploration…</p>}
            >
              <SemanticExplorer />
            </Suspense>
          </div>
        )}
      </main>
      <footer className="showcase-footer">
        <span>TACITUS · Independent personal project</span>
        <a
          href={`https://github.com/sargonxg/tacitus-workbench/blob/main/apps/workbench/docs/${mode === "native" ? "context-explorer.md" : mode === "selection" ? "research-selection-reader.md" : "semantic-exploration.md"}`}
          target="_blank"
          rel="noreferrer"
        >
          {mode === "native"
            ? "Local & static cloud build ↗"
            : mode === "selection"
              ? "Reader format & limits ↗"
              : "Exploration & preparation contract ↗"}
        </a>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
