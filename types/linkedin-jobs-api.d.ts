declare module '@atharvh01/linkedin-jobs-api' {
  // This package exposes an Express handler named searchJobs.
  export function searchJobs(req: any, res: any): void;
}

declare module '@atharvh01/linkedin-jobs-api/src/services/linkedinService.js' {
  export function fetchJobListings(
    keywords: string,
    location: string,
    dateSincePosted?: string
  ): Promise<Array<any>>;
}

declare module 'linkedin-jobs-api' {
  // Fallback package exposing a query function.
  const mod: {
    query: (options: Record<string, unknown>) => Promise<any[]>;
  };
  export = mod;
}


