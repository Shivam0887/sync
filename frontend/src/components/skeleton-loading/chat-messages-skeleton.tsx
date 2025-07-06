import { Skeleton } from "../ui/skeleton";

const ChatMessagesSkeleton = () => {
  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="w-[70%] self-end space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={`msg1-${i}`} className="w-full h-14 rounded-2xl" />
        ))}
      </div>

      <div className="w-[60%] self-start space-y-4">
        <div className="flex w-full gap-2">
          <div>
            <Skeleton className="size-10 rounded-full" />
          </div>
          <div className="w-full space-y-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="w-full h-14 rounded-2xl" />
            <Skeleton className="w-full h-14 rounded-2xl" />
            <Skeleton className="w-full h-14 rounded-2xl" />
          </div>
        </div>
      </div>

      <div className="w-[70%] self-end space-y-4">
        {Array.from({ length: 1 }).map((_, i) => (
          <Skeleton key={`msg1-${i}`} className="w-full h-14 rounded-2xl" />
        ))}
      </div>

      <div className="w-[60%] self-start space-y-4">
        <div className="flex w-full gap-2">
          <div>
            <Skeleton className="size-10 rounded-full" />
          </div>
          <div className="w-full space-y-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="w-full h-14 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessagesSkeleton;
