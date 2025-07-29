export const formatMs = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);

  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  if (parseInt(hours) > 0) return `${hours}h:${minutes}m:${seconds}s`;
  else if (parseInt(minutes) > 0) return `${minutes}m:${seconds}s`;

  return `${seconds}s`;
};
