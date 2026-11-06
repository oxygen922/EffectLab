import type { Metadata } from "next";
import { loadTemplates } from "@/lib/catalog";
import { loadRecipes } from "@/lib/recipes";

export const metadata: Metadata = { title: "Generation library · EffectLab" };

export default function RecipesPage() {
  const file = loadRecipes();
  const templates = loadTemplates();
  const entries = templates
    .map((template) => file.recipes[template.slug])
    .filter((recipe) => recipe);

  const direct = entries.filter((recipe) => recipe.pipeline === "direct").length;
  const storyboard = entries.length - direct;
  const curated = entries.filter((recipe) => recipe.source === "curated").length;

  return (
    <main className="wrap">
      <section className="hero slim">
        <div>
          <p className="kicker">Generation library</p>
          <h1>How each template is made</h1>
          <p className="lede">
            The toolbox below is every model the lab can call, all routed through one cheap-token
            gateway. Each template runs one of two pipelines — a direct pass from your photo, or a
            storyboard chain that builds a reference frame first. A template&apos;s exact recipe sits
            on its own page under &ldquo;How it&apos;s made&rdquo;; the raw data is also available at{" "}
            <code>/api/recipes</code>.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <b>{entries.length}</b>
            <span>recipes</span>
          </div>
          <div className="stat">
            <b>{direct}</b>
            <span>direct pass</span>
          </div>
          <div className="stat">
            <b>{storyboard}</b>
            <span>storyboard</span>
          </div>
          <div className="stat">
            <b>{curated}</b>
            <span>curated</span>
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Toolbox</h2>
          <span className="muted">models the lab can call, all through one cheap-token gateway</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Tool id</th>
                <th>Kind</th>
                <th>Route</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(file.tools).map(([id, tool]) => (
                <tr key={id}>
                  <td>{tool.name}</td>
                  <td>
                    <code>{id}</code>
                  </td>
                  <td>
                    <span className="tag hot">{tool.kind}</span>
                  </td>
                  <td>{tool.provider ? <span className="tag">{tool.provider}</span> : "—"}</td>
                  <td className="muted">{tool.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
