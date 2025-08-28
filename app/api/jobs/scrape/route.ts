import { NextRequest } from 'next/server';
import type { Browser } from 'puppeteer-core';

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

type FetchedJob = {
  title?: string;
  company?: string;
  location?: string;
  link?: string;
  postedDate?: string;
  description?: string;
};

async function runLinkedInQuery(input: QueryInput): Promise<Array<{
  title: string; company: string; location: string; jobUrl: string; date: string | null; description: string;
}>> {
  // If running on Vercel, use puppeteer-core + @sparticuz/chromium. Locally, defer to the package service.
  const isServerless = !!process.env.VERCEL;
  let results: FetchedJob[];
  if (isServerless) {
    type ChromiumCompat = { executablePath: () => Promise<string>; args: string[]; headless: boolean };
    const chromiumMod = await import('@sparticuz/chromium');
    const chromium: ChromiumCompat = (chromiumMod as unknown as { default?: ChromiumCompat })?.default as ChromiumCompat || (chromiumMod as unknown as ChromiumCompat);
    const { launch } = await import('puppeteer-core');
    const launchArgs = chromium.args;
    const executablePath = await chromium.executablePath();
    const headless = chromium.headless;
    const browser: Browser = await launch({ args: [...launchArgs], executablePath, headless });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    const searchUrl = (() => {
      const baseUrl = 'https://www.linkedin.com/jobs/search';
      const params = new URLSearchParams({
        keywords: input.keywords ?? '',
        location: input.location ?? '',
        f_TPR: input.dateSincePosted ?? '',
        position: String(1),
        pageNum: String(0)
      });
      return `${baseUrl}?${params.toString()}`;
    })();
    await page.goto(searchUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.jobs-search__results-list', { timeout: 8000 });
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('.jobs-search__results-list li');
      return Array.from(jobElements).map(element => ({
        title: (element.querySelector('.base-search-card__title')?.textContent || '').trim(),
        company: (element.querySelector('.base-search-card__subtitle')?.textContent || '').trim(),
        location: (element.querySelector('.job-search-card__location')?.textContent || '').trim(),
        link: (element.querySelector('.base-card__full-link')?.getAttribute('href') || ''),
        postedDate: element.querySelector('time')?.getAttribute('datetime') || '',
        description: (element.querySelector('.base-search-card__metadata')?.textContent || '').trim()
      }));
    });
    await browser.close();
    results = jobs.map(j => ({ ...j, link: (j.link || '').split('?')[0], postedDate: j.postedDate ? new Date(j.postedDate).toISOString() : '' }));
  } else {
    const mod: { fetchJobListings: (keywords: string, location: string, dateSincePosted?: string) => Promise<FetchedJob[]> } = await import('@atharvh01/linkedin-jobs-api/src/services/linkedinService.js');
    results = await mod.fetchJobListings(
      input.keywords ?? '',
      input.location ?? '',
      input.dateSincePosted ?? ''
    );
  }
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
  } catch (error: unknown) {
    const message = typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message) : 'Internal error';
    return new Response(JSON.stringify({
      success: false,
      error: { message }
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


