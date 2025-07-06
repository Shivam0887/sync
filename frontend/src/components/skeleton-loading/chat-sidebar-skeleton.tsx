import { Skeleton } from "@/components/ui/skeleton";

const ChatSidebarSkeleton = () => {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <button className="flex items-center p-2 w-full rounded-lg">
            <div className="relative">
              <Skeleton className="size-10 rounded-full" />
            </div>
            <div className="ml-3 text-left flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="w-[50%] h-5" />
                <Skeleton className="w-14 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="w-full h-3" />
              </div>
            </div>
          </button>
        </li>
      ))}
    </>
  );
};

export default ChatSidebarSkeleton;
