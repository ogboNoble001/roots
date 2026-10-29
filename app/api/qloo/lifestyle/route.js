import { fetchQlooEndpoint, QLOO_BASE_URL } from '../../../../lib/roots-engine.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location') || 'Enugu';
    const ageGroup = searchParams.get('age') || '24_and_younger';
    const gender = searchParams.get('gender') || 'male';
    const tagQuery = searchParams.get('tagQuery') || 'sport';

    const [placesRes, brandsRes, tagsRes] = await Promise.all([
      fetchQlooEndpoint('/v2/insights', {
        'filter.type': 'urn:entity:place',
        'filter.location.query': location,
        'signal.demographics.age': ageGroup,
        'signal.demographics.gender': gender,
        'take': 6,
      }),
      fetchQlooEndpoint('/v2/insights', {
        'filter.type': 'urn:entity:brand',
        'signal.demographics.age': ageGroup,
        'signal.demographics.gender': gender,
        'take': 6,
      }),
      fetchQlooEndpoint('/v2/tags', {
        'filter.query': tagQuery,
        'feature.typo_tolerance': 'true',
        'take': 6,
      }),
    ]);

    const places = (placesRes?.data?.results?.entities || []).map((e) => ({
      name: e.name,
      id: e.entity_id,
      subtype: e.subtype,
      affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
    }));

    const brands = (brandsRes?.data?.results?.entities || []).map((e) => ({
      name: e.name,
      id: e.entity_id,
      affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
    }));

    const tags = (tagsRes?.data?.results?.tags || []).map((t) => ({
      name: t.name,
      id: t.tag_id || t.id,
    }));

    return Response.json({
      success: true,
      qlooServer: QLOO_BASE_URL,
      places,
      brands,
      tags,
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
