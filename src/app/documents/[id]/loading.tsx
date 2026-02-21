import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentDetailLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-8 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Skeleton className="md:col-span-4 h-64" />
        <Skeleton className="md:col-span-2 h-48" />
        <Skeleton className="md:col-span-3 h-48" />
        <Skeleton className="md:col-span-3 h-96" />
      </div>
    </div>
  );
}
