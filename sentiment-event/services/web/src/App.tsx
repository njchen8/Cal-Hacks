import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface DashboardState {
  event: {
    id: string;
    name: string;
    keywords: string[];
  };
  state: {
    volume: number;
    avgScore: number;
    posShare: number;
    negShare: number;
    topTopics: string[];
    lastUpdatedISO?: string;
    trendHistory: Array<{
      tsISO: string;
      volume: number;
      avgScore: number;
      posShare: number;
      negShare: number;
    }>;
  };
  triggers: Array<{
    id: string;
    ruleId: string;
    agentName: string;
    message: string;
    triggeredAtISO: string;
    action?: string | null;
  }>;
}

const fetchState = async () => {
  const response = await axios.get<DashboardState>("/api/state");
  return response.data;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "topics" | "agents">("overview");
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-state"],
    queryFn: fetchState,
    refetchInterval: 15_000
  });

  const trendSparkline = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.state.trendHistory
      .slice(-20)
      .map((point: DashboardState["state"]["trendHistory"][number]) => point.avgScore);
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-200">
        Loading dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-200">
        Failed to load data.
        <button
          className="px-4 py-2 rounded bg-emerald-500/20 border border-emerald-500"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{data.event.name}</h1>
            <p className="text-sm text-slate-400">Keywords: {data.event.keywords.join(", ")}</p>
          </div>
          <div className="text-sm text-slate-400">
            Updated {data.state.lastUpdatedISO ? new Date(data.state.lastUpdatedISO).toLocaleTimeString() : "never"}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <div className="flex gap-2">
          <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <TabButton label="Topics" active={activeTab === "topics"} onClick={() => setActiveTab("topics")} />
          <TabButton label="Agents" active={activeTab === "agents"} onClick={() => setActiveTab("agents")} />
          <button
            className="ml-auto px-3 py-2 text-sm border border-slate-700 rounded bg-slate-900 hover:bg-slate-800"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </button>
        </div>

        {activeTab === "overview" && <OverviewTab data={data} trendSparkline={trendSparkline} />}
        {activeTab === "topics" && <TopicsTab topics={data.state.topTopics} history={data.state.trendHistory} />}
        {activeTab === "agents" && <AgentsTab triggers={data.triggers} />}
      </main>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const TabButton = ({ label, active, onClick }: TabButtonProps) => (
  <button
    className={`px-3 py-2 text-sm rounded border ${
      active
        ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
        : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
    }`}
    onClick={onClick}
  >
    {label}
  </button>
);

interface OverviewTabProps {
  data: DashboardState;
  trendSparkline: number[];
}

const OverviewTab = ({ data, trendSparkline }: OverviewTabProps) => (
  <section className="grid gap-4 md:grid-cols-3">
    <div className="col-span-1 rounded border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm text-slate-400">Average Sentiment</h2>
      <p className="mt-2 text-3xl font-semibold text-emerald-300">{data.state.avgScore.toFixed(2)}</p>
      <SentimentGauge value={data.state.avgScore} />
    </div>
    <div className="col-span-1 rounded border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm text-slate-400">Volume (posts)</h2>
      <p className="mt-2 text-3xl font-semibold">{data.state.volume}</p>
      <p className="text-xs text-slate-500 mt-1">Positive: {formatPercent(data.state.posShare)} · Negative: {formatPercent(data.state.negShare)}</p>
    </div>
    <div className="col-span-1 rounded border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm text-slate-400">Trend</h2>
      <Sparkline values={trendSparkline} />
    </div>
  </section>
);

interface TopicsTabProps {
  topics: string[];
  history: DashboardState["state"]["trendHistory"];
}

const TopicsTab = ({ topics, history }: TopicsTabProps) => (
  <section className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {topics.length === 0 && <span className="text-slate-500">No topics detected yet.</span>}
      {topics.map((topic) => (
        <span key={topic} className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-sm">
          {topic}
        </span>
      ))}
    </div>
    <div className="rounded border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-sm text-slate-400 mb-2">Recent Trend Points</h3>
      <div className="overflow-x-auto text-sm">
        <table className="min-w-full text-left">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Avg Score</th>
              <th className="py-2 pr-4">Volume</th>
              <th className="py-2 pr-4">Pos Share</th>
              <th className="py-2 pr-4">Neg Share</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(-15).map((point) => (
              <tr key={point.tsISO} className="border-t border-slate-800">
                <td className="py-2 pr-4">{new Date(point.tsISO).toLocaleTimeString()}</td>
                <td className="py-2 pr-4 text-emerald-300">{point.avgScore.toFixed(2)}</td>
                <td className="py-2 pr-4">{point.volume}</td>
                <td className="py-2 pr-4">{formatPercent(point.posShare)}</td>
                <td className="py-2 pr-4">{formatPercent(point.negShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

interface AgentsTabProps {
  triggers: DashboardState["triggers"];
}

const AgentsTab = ({ triggers }: AgentsTabProps) => (
  <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-4">
    <h2 className="text-sm text-slate-400">Recent Agent Triggers</h2>
    <div className="space-y-3">
      {triggers.length === 0 && <p className="text-slate-500 text-sm">No triggers yet.</p>}
      {triggers.map((trigger) => (
        <div key={trigger.id} className="border border-slate-800 rounded p-3 bg-slate-950/50">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-emerald-300">{trigger.agentName}</span>
            <span className="text-slate-500">{new Date(trigger.triggeredAtISO).toLocaleTimeString()}</span>
          </div>
          <p className="mt-2 text-sm text-slate-200">{trigger.message}</p>
          {trigger.action && <p className="text-xs text-slate-500 mt-1">Action: {trigger.action}</p>}
        </div>
      ))}
    </div>
  </section>
);

interface SentimentGaugeProps {
  value: number;
}

const SentimentGauge = ({ value }: SentimentGaugeProps) => {
  const percentage = ((value + 1) / 2) * 100;
  return (
    <div className="mt-3 h-3 rounded-full bg-slate-800">
      <div
        className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

interface SparklineProps {
  values: number[];
}

const Sparkline = ({ values }: SparklineProps) => (
  <div className="mt-3 h-24 flex items-end gap-[2px]">
    {values.map((value, index) => (
      <div
        key={`${value}-${index}`}
        className="w-2 flex-1 rounded-t bg-emerald-400/70"
        style={{ height: `${((value + 1) / 2) * 100}%` }}
      />
    ))}
    {values.length === 0 && <p className="text-sm text-slate-500">Awaiting data…</p>}
  </div>
);
