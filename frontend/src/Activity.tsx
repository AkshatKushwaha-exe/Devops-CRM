import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState, Loading } from "./components";
import { useResource } from "./hooks";
import { ActivityList } from "./Overview";
import type { Activity as ActivityRecord } from "./types";

export default function Activity({ version }: { version: number }) {
  const [page, setPage] = useState(0);
  const { data, loading, error, retry } = useResource<ActivityRecord[]>(
    `/activities?limit=25&offset=${page * 25}`,
    version,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE STORY SO FAR</div>
          <h1>
            Every interaction counts<span>.</span>
          </h1>
          <p>A running history of changes across your workspace.</p>
        </div>
      </div>
      <section className="panel activity-page">
        <div className="panel-heading">
          <div>
            <h2>Workspace activity</h2>
            <p>
              Contact updates, new opportunities, and progress through your
              pipeline.
            </p>
          </div>
        </div>
        {error ? (
          <ErrorState message={error} retry={retry} />
        ) : loading ? (
          <Loading />
        ) : (
          <ActivityList items={data || []} />
        )}
        <div className="pagination">
          <span>Page {page + 1}</span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous activity page"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Next activity page"
              disabled={(data?.length || 0) < 25}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
