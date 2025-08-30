export const redisKeys = {
  tokenBlacklist: (token: string) => `token_blacklist:${token}`,
};
