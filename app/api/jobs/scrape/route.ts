import { NextRequest } from 'next/server';

type QueryInput = {
  keywords: string;
  location: string;
  dateSincePosted?: 'past_24h' | 'past_week' | 'past_month' | '';
  limit?: number;
  experienceLevel?: string;
  remoteFilter?: 'remote' | 'on site' | 'hybrid' | '';
  sortBy?: 'recent' | 'relevant' | '';
  page?: number;
};

type NormalizedJob = {
  title: string;
  description: string | null;
  required_skills: string[];
  status: 'Open' | 'Closed';
};

// A conservative list of skills to extract from title/description
const KNOWN_SKILLS = [
  'javascript', 'typescript', 'react', 'next.js', 'node', 'node.js', 'python', 'django', 'flask',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'postgresql', 'postgres', 'sql', 'mongodb',
  'graphql', 'rest', 'tailwind', 'redux', 'vue', 'angular', 'swift', 'kotlin', 'java', 'c#',
  'c++', 'ci/cd', 'terraform', 'ansible', 'scala', 'go', 'rust', 'ml', 'machine learning',
  'nlp', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'spark', 'airflow'
];

function extractSkills(texts: Array<string | null | undefined>): string[] {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  const found = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(text)) {
      found.add(skill);
    }
  }
  return Array.from(found).sort();
}

async function runLinkedInQuery(input: QueryInput) {
  // Import the service function directly from the package's ESM source to avoid starting its server
  const { fetchJobListings }: any = await import('@atharvh01/linkedin-jobs-api/src/services/linkedinService.js');
  const results: any[] = await fetchJobListings(
    input.keywords ?? '',
    input.location ?? '',
    input.dateSincePosted ?? ''
  );
  return results.map(r => ({
    title: r.title ?? '',
    company: r.company ?? '',
    location: r.location ?? '',
    jobUrl: r.link ?? '',
    date: r.postedDate ?? null,
    description: r.description ?? ''
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueryInput | undefined;
    if (!body || !body.keywords || !body.location) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Missing required fields: keywords, location' }
      }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const raw = await runLinkedInQuery(body);

    const normalized: NormalizedJob[] = raw.map(job => {
      const skills = extractSkills([job.title, job.description]);
      return {
        title: job.title,
        description: job.description || null,
        required_skills: skills,
        status: 'Open'
      };
    });

    return new Response(JSON.stringify({
      success: true,
      count: normalized.length,
      jobs: normalized
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: { message: error?.message || 'Internal error' }
    }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function GET(request: NextRequest) {
  // Convenience GET handler to allow simple testing with query params
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get('keywords') || '';
  const location = searchParams.get('location') || '';
  const dateSincePosted = (searchParams.get('dateSincePosted') as QueryInput['dateSincePosted']) || '';
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
  if (!keywords || !location) {
    return new Response(JSON.stringify({ success: false, error: { message: 'Missing required query params: keywords, location' } }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  return POST(new Request(request.url, { method: 'POST', body: JSON.stringify({ keywords, location, dateSincePosted, limit }) }) as unknown as NextRequest);
}


