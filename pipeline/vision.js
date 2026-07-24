const fs = require('fs');

async function analyzeImage(imagePath, menuItems) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const mime = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const menuSummary = menuItems.slice(0, 80).map(i =>
    `- ${i.id}: ${i.name} (${i.category_name})${i.description ? ' — ' + i.description.slice(0, 80) : ''}`
  ).join('\n');

  const prompt = `You are a restaurant menu photo analyst. Identify the dish in this photo and match it to ONE item from this menu list.
Return ONLY valid JSON:
{"menuItemId":"id or null","dishName":"what you see","ingredients":["..."],"style":"plating style","confidence":0.0-1.0,"reason":"brief"}

If no reasonable match exists, set menuItemId to null and confidence below 0.4.

Menu items:
${menuSummary}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        }],
        max_tokens: 400,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[vision] API error:', err.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('[vision]', err.message);
    return null;
  }
}

async function searchFoodHint(dishName) {
  if (!dishName) return [];
  try {
    const q = encodeURIComponent(`${dishName} restaurant dish ingredients`);
    const res = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1`, {
      headers: { 'User-Agent': 'OBLAKO-MenuBot/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const abstract = data.AbstractText || '';
    const related = (data.RelatedTopics || []).slice(0, 3).map(t => t.Text).filter(Boolean);
    return [abstract, ...related].filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = { analyzeImage, searchFoodHint };
