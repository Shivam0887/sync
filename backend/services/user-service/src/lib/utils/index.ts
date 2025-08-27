export const formatSeconds = (totalSeconds: number) => {
  const totalMinutes = Math.floor(totalSeconds / 60);

  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");

  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${hours}h:${minutes}m:${seconds}s`;
};
