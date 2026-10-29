import {
  fetchQlooEndpoint,
  extractDynamicQueryTopic,
  queryGeminiClinicalReasoning,
} from '../../../../lib/roots-engine.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const patient = payload.patient || {};
    const isInitial = !payload.message || payload.message === 'initial_briefing';
    const message = isInitial
      ? `Provide a rich, explicit, and summarized lifestyle briefing for ${patient.name}. Detail who people in this cohort are, what their neighborhood and whereabouts are like, and the exact foods, dietary habits, and lifestyle realities they experience daily based on the Qloo graph.`
      : payload.message;

    const location = patient.qlooLocation || 'Enugu';
    const ageGroup = patient.qlooAge || '24_and_younger';
    const gender = patient.qlooGender || 'male';

    const dynamicTopic = isInitial
      ? (patient.qlooTagQuery || 'food')
      : extractDynamicQueryTopic(message, patient.qlooTagQuery || 'food');

    const asksForPlaces = isInitial || /\b(where\s+do\s+they|which\s+(supermarkets?|grocer(y|ies)|markets?|restaurants?|cafes?|eater(y|ies)|spots?|stores?|shops?|venues?)|list\s+places|specific\s+spots|what\s+markets)\b/i.test(message);

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
        'filter.query': dynamicTopic,
        'feature.typo_tolerance': 'true',
        'take': 8,
      }),
    ]);

    const fullQlooPlaces = (placesRes?.data?.results?.entities || []).map((e) => {
      const rawHighlights = [
        ...(e.properties?.keywords || []).map((k) => k.name),
        ...(e.tags || []).map((t) => t.name),
      ];
      const foodDishes = rawHighlights.filter((h) =>
        /soup|ukwa|rice|chicken|beef|meat|dish|stew|vegetable|produce|bakery|butcher|grocer|market|pie|shawarma|salad|yam|swallow/i.test(h)
      );
      return {
        name: e.name,
        id: e.entity_id,
        affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
        address: e.disambiguation || e.properties?.address || '',
        primaryGenre: e.properties?.primary_genre?.name || 'Local Venue',
        dishes: Array.from(new Set(foodDishes)),
        allTags: (e.tags || []).map((t) => t.name).slice(0, 15),
      };
    });

    const brands = (brandsRes?.data?.results?.entities || []).map((e) => ({
      name: e.name,
      id: e.entity_id,
      affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
    }));

    const tags = (tagsRes?.data?.results?.tags || []).map((t) => ({
      name: t.name,
      id: t.tag_id || t.id,
    }));

    const { text: rawOutput, error: aiError } = await queryGeminiClinicalReasoning(patient, message, {
      places: fullQlooPlaces,
      brands,
      tags,
    });

    let text = rawOutput || '';
    let thoughtProcess = null;

    const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/i);
    if (thoughtMatch) {
      thoughtProcess = thoughtMatch[1].trim();
      text = text.replace(/<thought>[\s\S]*?<\/thought>/i, '').trim();
    }

    if (!text) {
      return Response.json(
        { success: false, error: aiError || 'The AI did not respond. Please try again.' },
        { status: 502 }
      );
    }

    const frontendPlaces = asksForPlaces
      ? fullQlooPlaces.map((p) => ({ name: p.name, id: p.id, affinity: p.affinity }))
      : [];
    const frontendBrands = asksForPlaces ? brands : [];

    return Response.json({
      success: true,
      provider: rawOutput ? 'gemini-2.5-flash + qloo' : 'qloo-lifestyle-engine',
      text,
      thoughtProcess,
      places: frontendPlaces,
      brands: frontendBrands,
      tags,
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
