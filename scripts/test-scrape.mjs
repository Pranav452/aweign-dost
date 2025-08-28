// Quick test script to query LinkedIn jobs and print normalized results

const KNOWN_SKILLS = [
  'javascript', 'typescript', 'react', 'next.js', 'node', 'node.js', 'python', 'django', 'flask',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'postgresql', 'postgres', 'sql', 'mongodb',
  'graphql', 'rest', 'tailwind', 'redux', 'vue', 'angular', 'swift', 'kotlin', 'java', 'c#',
  'c++', 'ci/cd', 'terraform', 'ansible', 'scala', 'go', 'rust', 'ml', 'machine learning',
  'nlp', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'spark', 'airflow'
];

function extractSkills(texts) {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  const found = new Set();
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(text)) found.add(skill);
  }
  return Array.from(found).sort();
}

async function run() {
  const keywords = process.env.KEYWORDS || 'react developer';
  const location = process.env.LOCATION || 'remote';
  const dateSincePosted = process.env.DATE || 'past_24h';

  const { fetchJobListings } = await import('@atharvh01/linkedin-jobs-api/src/services/linkedinService.js');
  const raw = await fetchJobListings(keywords, location, dateSincePosted);
  const results = raw.map(r => ({ title: r.title ?? '', description: r.description ?? '' }));

  const normalized = results.map(job => ({
    title: job.title,
    description: job.description || null,
    required_skills: extractSkills([job.title, job.description]),
    status: 'Open'
  }));

  console.log(JSON.stringify({ success: true, count: normalized.length, jobs: normalized.slice(0, 5) }, null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


