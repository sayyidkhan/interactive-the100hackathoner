import { DISCOVERIES, JOURNEY_PROGRESS } from "../data/discoveries";

export function renderDevDiscoveries(root: HTMLElement): void {
  root.className = "dev-page";
  root.innerHTML = `
    <main class="dev-shell">
      <header class="dev-header">
        <a href="/">← Back to town</a>
        <div>
          <h1>Discovery QA</h1>
          <p>Review every discovery card without walking the 3D world.</p>
        </div>
        <strong>${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target} · ${DISCOVERIES.length} cards</strong>
      </header>
      <section class="dev-grid">
        ${DISCOVERIES.map(
          (entry) => `
            <article class="dev-card">
              <p>${entry.district}</p>
              <h2>${entry.number ? `#${entry.number.toString().padStart(3, "0")} ` : ""}${entry.title}</h2>
              <dl>
                <dt>Built</dt>
                <dd>${entry.built}</dd>
                <dt>Result</dt>
                <dd>${entry.result}</dd>
                <dt>Lesson</dt>
                <dd>${entry.lesson}</dd>
                <dt>Operator insight</dt>
                <dd>${entry.operatorInsight}</dd>
                <dt>Business angle</dt>
                <dd>${entry.businessAngle}</dd>
                <dt>Next clue</dt>
                <dd>${entry.nextClue}</dd>
              </dl>
            </article>
          `
        ).join("")}
      </section>
    </main>
  `;
}
