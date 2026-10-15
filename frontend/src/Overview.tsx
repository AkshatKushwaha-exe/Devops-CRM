import {
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CircleDollarSign,
  Plus,
  Target,
  Users,
} from "lucide-react";
import {
  Avatar,
  Badge,
  dateLabel,
  EmptyState,
  ErrorState,
  Loading,
  money,
  TextLink,
  timeLabel,
} from "./components";
import { useResource } from "./hooks";
import { LABELS, type Activity, type Dashboard, type Deal } from "./types";

export function ActivityList({ items }: { items: Activity[] }) {
  if (!items.length)
    return (
      <EmptyState
        title="Your story starts here"
        text="Create a contact or deal and your workspace activity will appear here."
      />
    );
  return (
    <div className="activity-list">
      {items.map((item) => (
        <div className="activity-item" key={item.id}>
          <span
            className={`activity-icon ${item.kind.startsWith("contact") ? "contact" : ""}`}
          >
            {item.kind.startsWith("contact") ? (
              <Users size={15} />
            ) : (
              <ArrowUpRight size={16} />
            )}
          </span>
          <div>
            <p>{item.message}</p>
            <time>{timeLabel(item.created_at)}</time>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Overview({
  version,
  onNavigate,
  onAdd,
  onEdit,
}: {
  version: number;
  onNavigate: (page: string) => void;
  onAdd: () => void;
  onEdit: (deal: Deal) => void;
}) {
  const { data, loading, error, retry } = useResource<Dashboard>(
    "/dashboard",
    version,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A CLEARER VIEW OF YOUR BUSINESS</div>
          <h1>
            Good things are growing<span>.</span>
          </h1>
          <p>Here’s where your relationships and opportunities stand.</p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={18} />
          Add deal
        </button>
      </div>
      {error ? (
        <ErrorState message={error} retry={retry} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="metrics-grid">
            {[
              {
                title: "Total contacts",
                value: data.total_contacts.toString(),
                note: "People in your network",
                icon: Users,
                tone: "mint",
              },
              {
                title: "Active deals",
                value: data.active_deals.toString(),
                note: "Opportunities in motion",
                icon: BriefcaseBusiness,
                tone: "purple",
              },
              {
                title: "Pipeline value",
                value: money(data.pipeline_value),
                note: "Across all open deals",
                icon: CircleDollarSign,
                tone: "orange",
              },
              {
                title: "Won revenue",
                value: money(data.won_revenue),
                note: `${data.win_rate}% win rate · closed deals`,
                icon: Target,
                tone: "green",
              },
            ].map((metric) => (
              <article className="metric-card" key={metric.title}>
                <div>
                  <span>{metric.title}</span>
                  <span className={`metric-icon ${metric.tone}`}>
                    <metric.icon size={19} />
                  </span>
                </div>
                <strong>{metric.value}</strong>
                <p>{metric.note}</p>
              </article>
            ))}
          </div>
          <div className="overview-middle">
            <section className="panel pipeline-summary">
              <div className="panel-heading">
                <div>
                  <h2>Your pipeline at a glance</h2>
                  <p>Every stage is a step forward.</p>
                </div>
                <TextLink onClick={() => onNavigate("pipeline")}>
                  View pipeline
                </TextLink>
              </div>
              <div
                className="pipeline-chart"
                role="img"
                aria-label={data.stages
                  .map(
                    (s) =>
                      `${LABELS[s.stage]}: ${s.count} deals, ${money(s.value)}`,
                  )
                  .join("; ")}
              >
                {data.stages.map((s) => {
                  const max = Math.max(
                    ...data.stages.map((item) => Number(item.value)),
                    1,
                  );
                  return (
                    <div className={`chart-column ${s.stage}`} key={s.stage}>
                      <span className="chart-value">
                        {money(s.value, true)}
                      </span>
                      <div className="chart-track">
                        <div
                          style={{
                            height: `${Math.max((Number(s.value) / max) * 100, 2)}%`,
                          }}
                        />
                      </div>
                      <strong>{LABELS[s.stage]}</strong>
                      <small>
                        {s.count} {s.count === 1 ? "deal" : "deals"}
                      </small>
                    </div>
                  );
                })}
              </div>
              <div className="chart-caption">
                <span>
                  <i />
                  Deal value by stage
                </span>
                <span>INR · all time</span>
              </div>
            </section>
            <aside className="growth-card">
              <span className="growth-label">SMALL STEPS. REAL PROGRESS.</span>
              <div className="growth-art" aria-hidden="true">
                <span className="growth-ring ring-one" />
                <span className="growth-ring ring-two" />
                <span className="growth-bar bar-one" />
                <span className="growth-bar bar-two" />
                <span className="growth-bar bar-three" />
                <ArrowUpRight size={66} strokeWidth={1.2} />
              </div>
              <h2>
                Relationships first.
                <br />
                Results follow.
              </h2>
              <p>
                A thoughtful follow-up today could be your next opportunity
                tomorrow.
              </p>
              <button onClick={() => onNavigate("contacts")}>
                Connect with your contacts <ArrowUpRight size={17} />
              </button>
            </aside>
          </div>
          <div className="overview-bottom">
            <section className="panel upcoming-panel">
              <div className="panel-heading">
                <div>
                  <h2>On the horizon</h2>
                  <p>Open deals, ordered by expected close date.</p>
                </div>
                <span className="small-icon">
                  <ArrowDownLeft size={18} />
                </span>
              </div>
              {!data.upcoming_deals.length ? (
                <EmptyState
                  title="A little room for opportunity"
                  text="Add an expected close date to an open deal to see it here."
                />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Opportunity</th>
                        <th>Value</th>
                        <th>Stage</th>
                        <th>Expected close</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming_deals.map((deal) => (
                        <tr key={deal.id}>
                          <td>
                            <button
                              className="person-cell"
                              onClick={() => onEdit(deal)}
                            >
                              <Avatar
                                name={deal.contact.company || deal.contact.name}
                              />
                              <span>
                                <strong>{deal.title}</strong>
                                <small>
                                  {deal.contact.company || deal.contact.name}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td className="numeric">{money(deal.value)}</td>
                          <td>
                            <Badge value={deal.stage} />
                          </td>
                          <td className="muted nowrap">
                            {dateLabel(deal.expected_close)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Latest activity</h2>
                  <p>The little things adding up.</p>
                </div>
                <TextLink onClick={() => onNavigate("activity")}>
                  View all
                </TextLink>
              </div>
              <ActivityList items={data.recent_activity} />
            </section>
          </div>
        </>
      )}
    </>
  );
}
