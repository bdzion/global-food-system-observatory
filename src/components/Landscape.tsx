/* Where this site sits among the others.
 *
 * A reader who has to brief a minister needs to know what else to consult and
 * when this site is the wrong tool. Most of these platforms are older, better
 * resourced and more authoritative than this one, and the honest summary is
 * that they answer different questions. Saying so is more useful than
 * implying this site replaces them.
 *
 * Everything here is editorial, not computed, and it is written down rather
 * than fetched so that it can be read and corrected. Each entry links to the
 * platform so a reader can check the characterization. */

interface Platform {
  name: string;
  url: string;
  run_by: string;
  answers: string;
  cadence: string;
  limit: string;
}

const PLATFORMS: Platform[] = [
  {
    name: "AMIS Market Monitor",
    url: "https://www.amis-outlook.org/",
    run_by: "G20 initiative, hosted at FAO",
    answers:
      "How much wheat, maize, rice and soybean the world has, what it costs, and what governments have just done about it.",
    cadence: "Monthly",
    limit:
      "Published as a PDF, so you cannot ask it a question about one country or run a comparison yourself.",
  },
  {
    name: "FEWS NET",
    url: "https://fews.net/",
    run_by: "United States government",
    answers:
      "Where people are expected to go hungry over the next six to nine months, country by country, at sub-national detail.",
    cadence: "Continuous, by country",
    limit:
      "The most forward-looking of these, but funding-dependent: reporting was suspended for six months in 2025 and some countries have been switched on and off since.",
  },
  {
    name: "IPC",
    url: "https://www.ipcinfo.org/",
    run_by: "Partnership of UN agencies, NGOs and governments",
    answers:
      "How severe hunger is right now in a given place, on a common five-phase scale that governments have agreed to use.",
    cadence: "Per analysis round",
    limit:
      "Covers countries under analysis, which are mostly those already in crisis. It is a verdict on conditions, not a warning about trade.",
  },
  {
    name: "GEOGLAM Crop Monitor",
    url: "https://cropmonitor.org/",
    run_by: "Group on Earth Observations",
    answers:
      "How crops currently look in each growing region, from satellite and ground reporting.",
    cadence: "Monthly",
    limit:
      "Reports condition, not tonnes. A crop in poor condition may still recover.",
  },
  {
    name: "Food Systems Dashboard",
    url: "https://www.foodsystemsdashboard.org/",
    run_by: "GAIN and Johns Hopkins University",
    answers:
      "How a country's whole food system is structured, across more than 300 indicators for most countries.",
    cadence: "As underlying data are revised",
    limit:
      "Built to describe and compare, not to track an unfolding disruption.",
  },
];

export function Landscape() {
  return (
    <section className="visual-panel">
      <h2>What else to look at, and when this site is the wrong tool</h2>
      <p>
        Several organizations publish food-system monitoring, and most of them
        are older and better resourced than this site. They answer different
        questions. If you need any of the things in the last column below, go
        to the platform that provides it.
      </p>

      <div className="commodity-table" tabIndex={0}>
        <table>
          <caption className="sr-only">
            Comparable food-system monitoring platforms, what each answers, how
            often it publishes, and its main limitation.
          </caption>
          <thead>
            <tr>
              <th scope="col">Platform</th>
              <th scope="col">What it answers</th>
              <th scope="col">How often</th>
              <th scope="col">Where it stops</th>
            </tr>
          </thead>
          <tbody>
            {PLATFORMS.map((p) => (
              <tr key={p.name}>
                <th scope="row">
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.name}
                  </a>
                  <span className="landscape-run">{p.run_by}</span>
                </th>
                <td>{p.answers}</td>
                <td>{p.cadence}</td>
                <td>{p.limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>What this site adds</h3>
      <p>
        Three things, and they are narrow. First, it works out{" "}
        <strong>who depends on whom</strong>: for each country and food, how
        much comes from abroad and how much of that comes from one supplier.
        That is a standing vulnerability, and it is visible before anything has
        gone wrong. Second, it runs the{" "}
        <strong>arithmetic of an interruption</strong>: if a named supplier
        stopped, how long the stocks on hand would last and what would have to
        be replaced. Third, every figure is{" "}
        <strong>reproducible from published sources</strong>, with a checksum
        on each file, so a disputed number can be traced to the row it came
        from.
      </p>
      <p>
        It does not assess hunger, forecast harvests, or tell you what is
        happening in a particular place this week. For those, the platforms
        above are the authorities, and the reports they publish appear on{" "}
        <a href="#/watch">the threats page</a> as they come out.
      </p>
      <p className="figure-note">
        This comparison is our reading of each platform, not theirs. If you
        think we have mischaracterized one, the contact details are at the
        bottom of this page.
      </p>
    </section>
  );
}
