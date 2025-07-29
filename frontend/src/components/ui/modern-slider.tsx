import { Slider } from "./slider";
import { cn } from "@/lib/utils";

interface ModernSliderProps extends React.ComponentProps<typeof Slider> {
  dotSize?: "sm" | "md" | "lg";
}

const ModernSlider = ({ dotSize = "md", ...props }: ModernSliderProps) => {
  const rangeLength = (props.max ?? 100) - (props.min ?? 0);
  const indicators = Math.floor(rangeLength / (props.step ?? 1));

  const size =
    dotSize === "sm" ? "size-2" : dotSize === "md" ? "size-4" : "size-6";

  return (
    <div className="relative flex items-center">
      <Slider
        {...props}
        dotSize={size}
        className={cn("absolute z-50", props.className)}
      />
      <div className="z-0 absolute flex justify-between w-full">
        {Array.from({ length: indicators + 1 }).map((_, i) => (
          <div
            key={`slide-dot-${i + 1}`}
            className={`${size} bg-secondary rounded-full`}
          />
        ))}
      </div>
    </div>
  );
};

export default ModernSlider;
