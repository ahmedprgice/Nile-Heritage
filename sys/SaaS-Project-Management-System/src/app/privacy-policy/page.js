import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
        <div className="mb-10">
          <Link href="/" className="text-xs uppercase tracking-[0.3em] text-indigo-300">
            Nexora
          </Link>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">
            This Privacy Policy explains how Nexora collects, uses, and protects information
            when you use our platform. If you have questions, contact us at
            <span className="text-indigo-300"> support@nexora.app</span>.
          </p>
          <p className="mt-2 text-xs text-gray-500">Last updated: April 8, 2026</p>
        </div>

        <div className="space-y-8 text-sm text-gray-300 sm:text-base">
          <section className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-6">
            <h2 className="text-lg font-semibold text-white">Information We Collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Account details such as name, email, company name, and role.</li>
              <li>Workspace and board content you create (tasks, notes, files metadata).</li>
              <li>Usage information such as logins, feature usage, and system activity.</li>
              <li>Payment references or proof submitted for manual billing.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-6">
            <h2 className="text-lg font-semibold text-white">How We Use Your Data</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>To provide and maintain the Nexora platform.</li>
              <li>To secure accounts, manage access, and enforce permissions.</li>
              <li>To communicate important updates, notifications, and billing status.</li>
              <li>To improve product performance and team collaboration.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-6">
            <h2 className="text-lg font-semibold text-white">Sharing & Access</h2>
            <p className="mt-3">
              Workspace data is visible only to members with permission. Private boards and notes
              are restricted to invited users. We do not sell your data or share it with third
              parties for advertising.
            </p>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-6">
            <h2 className="text-lg font-semibold text-white">Security</h2>
            <p className="mt-3">
              We apply reasonable safeguards to protect your information, including access controls,
              encryption in transit, and audit logs. No system is 100% secure, and you should use
              strong passwords and protect your login credentials.
            </p>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-6">
            <h2 className="text-lg font-semibold text-white">Data Retention</h2>
            <p className="mt-3">
              We retain data while your account is active. You may request deletion of your data
              at any time by contacting support. Some records may remain for legal or audit purposes.
            </p>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-6">
            <h2 className="text-lg font-semibold text-white">Your Rights</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Access, update, or correct your account information.</li>
              <li>Request deletion or export of your data.</li>
              <li>Manage notifications and visibility preferences.</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
