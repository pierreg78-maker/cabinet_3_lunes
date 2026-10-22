// Cloudflare Worker - Proxy temporaire pour lectures Tarot via Grok
// Déployer avec Wrangler, secret : wrangler secret put XAI_API_KEY
// Jusqu'au 1er décembre 2026

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Méthode non autorisée', { status: 405, headers: cors });
    }

    const apiKey = env.XAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Clé API manquante sur le worker' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();

      const system = `Tu es Hélène Belmont, du Cabinet des Trois Lunes. Tu pratiques le Tarot de Marseille (uniquement les 22 arcanes majeurs) avec le tirage en croix.\n\nRègles strictes de lecture :\n- 1 Pour (gauche) : ce qui aide, énergie favorable.\n- 2 Contre (droite) : ce qui freine ou résiste.\n- 3 Conseil (haut) : l'attitude à tenir.\n- 4 Issue (bas) : la pente si l'on ne change rien.\n- 5 Synthèse (centre) : calcul traditionnel Mode B — somme des numéros des 4 cartes (Le Mat = 0), réduction digitale si > 22.\n- Carte à l'endroit : énergie active, disponible.\n- Carte renversée : énergie bloquée, intériorisée, retardée ou à intégrer — jamais une « mauvaise carte ».\n\nStyle : français fluide, littéraire, chaleureux et précis. Pas de listes à puces ni de formules toutes faites. Relie chaque lame concrètement à la question posée. Accueille la personne, parcours les pôles, nomme la synthèse, et termine par une phrase ouverte. Utilise le prénom s'il est donné. Inspire-toi des significations classiques mais rédige de façon naturelle et sur mesure pour cette question.`;

      const cardsDesc = (body.cards || []).map(c => {
        const rev = c.rev ? ' (renversée)' : ' (à l\'endroit)';
        return `${c.posLabel || c.pos} : ${c.name} n°${c.n}${rev}`;
      }).join('\n');

      const userContent = `Question : ${body.question || 'non précisée'}\nAppelée : ${body.prenom || 'vous'}\nGenre de parole : ${body.genre || 'neutre'}\nÂge : ${body.age || 'non dit'}\nSituation : ${body.sit || ''}\nMotif : ${body.motif || ''}\n\nTirage :\n${cardsDesc}\n\nSynthèse (centre) : ${body.synth?.name || '?'} n°${body.synth?.n || '?'}\nÉtapes du calcul : ${(body.synth?.steps || []).join(' → ') || ''}\n\nPremier regard de la personne (si fourni) :\nPour : ${body.eye?.pour || ''}\nContre : ${body.eye?.contre || ''}\nConseil : ${body.eye?.conseil || ''}\nIssue : ${body.eye?.issue || ''}\nCentre : ${body.eye?.centre || ''}\n\nRédigez maintenant la leçon complète, fluide et personnalisée.`;

      const grokBody = {
        model: 'grok-4',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        temperature: 0.75,
        max_tokens: 1800,
      };

      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(grokBody),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return new Response(JSON.stringify({ error: 'Erreur Grok', detail: errText }), {
          status: resp.status,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || 'Aucune réponse générée.';

      return new Response(JSON.stringify({ text, model: data.model }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Erreur interne' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
