export default function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gradient-to-r from-slate-800 via-slate-700/60 to-slate-800 ${className}`}
    />
  );
}
