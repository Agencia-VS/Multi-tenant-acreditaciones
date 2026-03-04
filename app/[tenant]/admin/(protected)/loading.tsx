/**
 * Admin Protected — Loading Skeleton
 *
 * Shown while the server validates auth + tenant access.
 * Provides visual continuity instead of a blank screen.
 */
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-9 bg-gray-200 rounded-xl" />
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div>
                <div className="h-6 w-48 bg-gray-200 rounded-lg" />
                <div className="h-4 w-36 bg-gray-100 rounded mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-4 bg-gray-100 rounded hidden sm:block" />
              <div className="w-9 h-9 bg-gray-200 rounded-lg" />
              <div className="w-9 h-9 bg-gray-200 rounded-lg" />
              <div className="w-9 h-9 bg-gray-200 rounded-lg" />
            </div>
          </div>
          {/* Tabs skeleton */}
          <div className="flex gap-1 pb-0">
            {[120, 130, 80].map((w, i) => (
              <div key={i} className="h-10 rounded-t-lg bg-gray-100" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex gap-2 items-center">
              <div className="flex-1 h-9 bg-gray-100 rounded-lg max-w-xs" />
              <div className="w-28 h-9 bg-gray-100 rounded-lg" />
              <div className="w-9 h-9 bg-gray-100 rounded-lg" />
            </div>
          </div>
          {/* Table rows */}
          <div className="divide-y divide-gray-50">
            {/* Header */}
            <div className="px-4 py-2.5 flex gap-4 items-center bg-gray-50">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              {[60, 120, 100, 80, 70, 60, 60, 60].map((w, i) => (
                <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: w }} />
              ))}
            </div>
            {/* Rows */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex gap-4 items-center">
                <div className="w-4 h-4 bg-gray-100 rounded" />
                <div className="w-16 h-4 bg-gray-100 rounded" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div>
                    <div className="h-4 w-32 bg-gray-100 rounded" />
                    <div className="h-3 w-24 bg-gray-50 rounded mt-1" />
                  </div>
                </div>
                <div className="w-20 h-4 bg-gray-100 rounded" />
                <div className="w-16 h-5 bg-gray-100 rounded-md" />
                <div className="w-14 h-4 bg-gray-100 rounded" />
                <div className="w-16 h-5 bg-gray-100 rounded-full" />
                <div className="w-12 h-5 bg-gray-100 rounded-full" />
                <div className="flex gap-1">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg" />
                  <div className="w-7 h-7 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
