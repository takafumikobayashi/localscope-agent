import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Skeleton className="md:col-span-6 h-64" />
        <Skeleton className="md:col-span-3 h-80" />
        <Skeleton className="md:col-span-3 h-80" />
      </div>
    </div>
  );
}
