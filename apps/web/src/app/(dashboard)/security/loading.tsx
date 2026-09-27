import { SecuritySkeleton } from "@/features/security/security-report";
export default function Loading() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Security</h1>
      <SecuritySkeleton />
    </div>
  );
}
