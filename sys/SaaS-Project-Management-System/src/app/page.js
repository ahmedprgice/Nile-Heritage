import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  FileText,
  Kanban,
  LayoutDashboard,
  MessageCircle,
  Rows3,
  ShieldCheck,
  Users,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Dashboard overview",
    description: "See your workspace activity, tasks, boards, and recent updates from one focused place.",
  },
  {
    icon: Kanban,
    title: "Workspace boards",
    description: "Create boards with groups, item rows, dynamic columns, statuses, timelines, and file cells.",
  },
  {
    icon: CheckCircle2,
    title: "Task management",
    description: "Track Todo, In Progress, and Done work in Kanban or list view with filters and drag updates.",
  },
  {
    icon: FileText,
    title: "Notes",
    description: "Keep project notes and supporting context close to the work your team is managing.",
  },
  {
    icon: MessageCircle,
    title: "Team chat",
    description: "Use built-in chat channels and conversations to keep collaboration in the same system.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Stay aware of important updates through the dashboard notification area.",
  },
];

const boardColumns = ["Status labels", "People", "Date", "Timeline", "Files", "Numbers"];

const workflow = [
  "Create a workspace for a team or project.",
  "Add boards, groups, and item rows.",
  "Track work with statuses, timelines, assignees, and files.",
  "Manage tasks in Kanban or list view.",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <nav className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        <Link href="/" className="text-xl font-bold tracking-[0.22em]">
          NEXORA
        </Link>

        <div className="flex items-center gap-2 pr-16 text-sm sm:gap-3 sm:pr-16">
          <a href="#features" className="hidden text-gray-300 transition hover:text-white lg:inline">
            Features
          </a>
          <a href="#workflow" className="hidden text-gray-300 transition hover:text-white lg:inline">
            Workflow
          </a>
          <Link
            href="/auth"
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 sm:px-4"
          >
            Login
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pt-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200">
            <ShieldCheck size={16} />
            Project management for real team workflows
          </div>

          <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Plan, organize, and track your team’s work in one place.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
            Nexora helps teams manage workspaces, boards, tasks, notes, chat, files, timelines, and notifications without switching between disconnected tools.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth"
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-center font-medium shadow-xl shadow-indigo-600/20 transition hover:opacity-90"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="rounded-xl border border-gray-700 bg-white/5 px-6 py-3 text-center font-medium text-gray-200 transition hover:border-indigo-400 hover:bg-indigo-500/10"
            >
              Explore features
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-500/20 bg-[#0f172a]/80 p-4 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Board preview</p>
                <h2 className="mt-1 text-xl font-semibold">Product Launch</h2>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                Active
              </span>
            </div>

            <div className="space-y-3">
              {["Research", "Build", "Review"].map((item, index) => (
                <div key={item} className="grid gap-2 rounded-xl border border-gray-800 bg-[#0f172a] p-3 text-sm sm:grid-cols-[1.2fr_0.8fr_0.8fr]">
                  <div className="flex min-w-0 items-center gap-2">
                    <Rows3 size={14} className="text-indigo-300" />
                    <span className="truncate">{item}</span>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-center text-xs ${index === 2 ? "bg-emerald-500/20 text-emerald-300" : index === 1 ? "bg-amber-500/20 text-amber-300" : "bg-slate-500/20 text-slate-300"}`}>
                    {index === 2 ? "Done" : index === 1 ? "In Progress" : "Todo"}
                  </span>
                  <span className="rounded-lg bg-indigo-500/10 px-2 py-1 text-center text-xs text-indigo-200">
                    Week {index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">What the system can do</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Built for everyday project management</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-6 transition hover:border-indigo-500/50 hover:bg-[#152033]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="relative z-10 mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-2 lg:px-10">
        <div className="rounded-3xl border border-gray-800 bg-[#111827]/80 p-8">
          <CalendarDays className="mb-5 text-indigo-300" size={32} />
          <h2 className="text-3xl font-bold">Boards support the columns teams actually use.</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {boardColumns.map((column) => (
              <span key={column} className="rounded-full border border-gray-700 bg-[#0f172a] px-4 py-2 text-sm text-gray-200">
                {column}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-800 bg-[#111827]/80 p-8">
          <Users className="mb-5 text-indigo-300" size={32} />
          <h2 className="text-3xl font-bold">A simple flow from workspace to completed work.</h2>
          <div className="mt-6 space-y-4">
            {workflow.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-2xl border border-gray-800 bg-[#0f172a] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold">
                  {index + 1}
                </span>
                <p className="text-gray-300">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Ready to manage your next project?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-gray-400">
          Start with a workspace, create a board, add tasks, and keep your team aligned from planning to delivery.
        </p>
        <Link
          href="/auth"
          className="mt-8 inline-flex rounded-xl bg-indigo-600 px-7 py-3 font-medium shadow-xl shadow-indigo-600/20 transition hover:bg-indigo-500"
        >
          Open Nexora
        </Link>
      </section>

      <footer className="relative z-10 border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Nexora. Built for team project management.
        <Link href="/privacy-policy" className="ml-2 text-indigo-300 hover:text-white">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
