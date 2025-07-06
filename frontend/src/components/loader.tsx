import { cn } from "@/lib/utils";

const Loader = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center h-full w-full",
        className
      )}
    >
      <div className="animate-spin">
        <div className="size-4 border-2 border-t-0 rounded-full" />
      </div>
    </div>
  );
};

export default Loader;
