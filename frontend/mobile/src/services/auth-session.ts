type TokenResolver = (forceRefresh?: boolean) => Promise<string | null>;

let resolver: TokenResolver = async () => null;

export function registerTokenResolver(nextResolver: TokenResolver): () => void {
  resolver = nextResolver;
  return () => {
    resolver = async () => null;
  };
}

export function resolveAccessToken(forceRefresh = false): Promise<string | null> {
  return resolver(forceRefresh);
}
