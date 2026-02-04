import OpenAI from 'openai'
import type { PromptOutput, ResearchBrief, SubTheme, VarietyScore } from '../utils/prompts.js'
import { validatePrompt, calculateVarietyScore } from '../utils/prompts.js'

let openaiClient: OpenAI | null = null
let clientInitializing = false

async function getOpenAI(): Promise<OpenAI> {
  if (openaiClient) return openaiClient
  if (clientInitializing) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return getOpenAI()
  }
  clientInitializing = true
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000,
    maxRetries: 2,
  })
  clientInitializing = false
  return openaiClient
}

function safeJsonParse<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T
  } catch {
    console.error('[JSON Parse Error] Failed to parse prompt response:', content.substring(0, 200))
    return fallback
  }
}

const PROMPT_SCHEMA_EXAMPLE = `{
  "style": "15-30 word single sentence summary that captures the entire mood and look",
  "pose": {
    "framing": "e.g., Three-quarter portrait, seated",
    "body_position": "specific position description",
    "arms": "arm positioning",
    "posture": "overall posture",
    "expression": {
      "facial": "emotional description, NO identity terms",
      "eyes": "eye expression",
      "mouth": "mouth expression"
    }
  },
  "lighting": {
    "setup": "overall lighting description",
    "key_light": "main light source and direction",
    "fill_light": "secondary light",
    "shadows": "shadow quality",
    "mood": "emotional quality of light"
  },
  "set_design": {
    "backdrop": "CRITICAL: detailed background description",
    "surface": "what subject is on/in",
    "props": ["prop1", "prop2"],
    "atmosphere": "overall vibe"
  },
  "outfit": {
    "main": "primary clothing",
    "accessories": "jewelry, hats, etc",
    "styling": "overall style description"
  },
  "camera": {
    "lens": "lens choice with reasoning",
    "aperture": "f-stop",
    "angle": "camera angle",
    "focus": "focus point"
  },
  "hairstyle": {
    "style": "NO COLOR - shape and texture only",
    "parting": "parting style",
    "details": "additional details",
    "finish": "overall look"
  },
  "makeup": {
    "style": "overall makeup approach",
    "skin": "skin finish",
    "eyes": "eye makeup",
    "lips": "lip color/finish"
  },
  "effects": {
    "color_grade": "color treatment",
    "grain": "film grain or clean"
  }
}`

function createFallbackPrompt(theme: SubTheme, concept: string): PromptOutput {
  return {
    style: `${theme.aesthetic} ${concept} portrait with ${theme.mood.toLowerCase()} mood featuring ${theme.key_elements.slice(0, 2).join(' and ')}`,
    pose: {
      framing: 'Three-quarter portrait',
      body_position: 'Standing naturally',
      arms: 'Relaxed at sides',
      posture: 'Confident and relaxed',
      expression: { facial: 'Warm genuine expression', eyes: 'Engaged and present', mouth: 'Natural soft smile' },
    },
    lighting: {
      setup: 'Soft natural lighting',
      key_light: 'Main light from front-left',
      fill_light: 'Ambient fill',
      shadows: 'Soft and flattering',
      mood: theme.mood,
    },
    set_design: {
      backdrop: `CRITICAL: ${theme.key_elements[0] || 'Clean backdrop'} environment`,
      surface: 'Natural surface',
      props: theme.key_elements.slice(1),
      atmosphere: `${theme.aesthetic} atmosphere`,
    },
    outfit: {
      main: 'Stylish attire matching the concept',
      accessories: 'Minimal elegant accessories',
      styling: theme.aesthetic,
    },
    camera: {
      lens: '85mm portrait lens',
      aperture: 'f/2.8',
      angle: 'Eye level',
      focus: 'Sharp on eyes',
    },
    hairstyle: {
      style: 'Styled appropriately for the concept',
      parting: 'Natural parting',
      details: 'Well-groomed',
      finish: 'Polished',
    },
    makeup: {
      style: 'Enhancing natural features',
      skin: 'Natural healthy glow',
      eyes: 'Subtle enhancement',
      lips: 'Natural tone',
    },
    effects: {
      color_grade: 'Balanced and natural',
      grain: 'Clean digital',
    },
  }
}

export async function generatePrompts(
  concept: string,
  count: number,
  researchBrief: ResearchBrief
): Promise<{ prompts: PromptOutput[]; varietyScore: VarietyScore }> {
  const client = await getOpenAI()
  const prompts: PromptOutput[] = []
  const subThemesToUse = distributeSubThemes(researchBrief.sub_themes, count)

  const batchSize = 3
  for (let i = 0; i < count; i += batchSize) {
    const batchThemes = subThemesToUse.slice(i, Math.min(i + batchSize, count))
    const batchPrompts = await generatePromptBatch(client, concept, batchThemes, researchBrief, i)
    prompts.push(...batchPrompts)
  }

  const varietyScore = calculateVarietyScore(prompts)

  return { prompts: prompts.slice(0, count), varietyScore }
}

function distributeSubThemes(subThemes: SubTheme[], count: number): SubTheme[] {
  const result: SubTheme[] = []
  let idx = 0
  for (let i = 0; i < count; i++) {
    result.push(subThemes[idx % subThemes.length])
    idx++
  }
  return result
}

async function generatePromptBatch(
  client: OpenAI,
  concept: string,
  themes: SubTheme[],
  research: ResearchBrief,
  startIndex: number
): Promise<PromptOutput[]> {
  const fallbackPrompts = themes.map((theme) => createFallbackPrompt(theme, concept))

  try {
    const themeDescriptions = themes
      .map((t, i) => `${startIndex + i + 1}. "${t.name}" (${t.aesthetic}, ${t.mood}) - Key elements: ${t.key_elements.join(', ')}`)
      .join('\n')

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'developer',
          content: `You are an expert prompt engineer for AI image generation, specifically for Clone AI's image-to-image model. You create detailed JSON prompts that preserve user identity while transforming their photos into themed concepts.

CRITICAL RULES:
1. NEVER mention hair color, skin tone, ethnicity, age, or identity descriptors
2. NEVER use words like "beautiful", "pretty", "gorgeous", "young", "old"
3. Use "CRITICAL:" prefix for must-have elements (backdrop, key props)
4. Technical choices (lens, lighting) must be justified by the concept
5. Each prompt must be visually distinct`,
        },
        {
          role: 'user',
          content: `Generate ${themes.length} prompts for "${concept}" based on this research:

TECHNICAL RECOMMENDATIONS:
- Lens options: ${research.technical_recommendations.lens_options.join('; ')}
- Lighting styles: ${research.technical_recommendations.lighting_styles.join('; ')}
- Color grades: ${research.technical_recommendations.color_grades.join('; ')}
- Notes: ${research.technical_recommendations.notes}

TREND INSIGHTS:
- Aesthetics: ${research.trend_findings.trending_aesthetics.join(', ')}
- Color palettes: ${research.trend_findings.color_palettes.join(', ')}
- Outfits: ${research.trend_findings.outfit_trends.join(', ')}
- Set designs: ${research.trend_findings.set_design_trends.join(', ')}

SUB-THEMES TO GENERATE:
${themeDescriptions}

Return a JSON object with this exact structure:
{
  "prompts": [
    ${PROMPT_SCHEMA_EXAMPLE}
  ]
}

Generate exactly ${themes.length} complete prompts. Each must follow the schema exactly. Use CRITICAL: for backdrop and 1-2 other essential elements per prompt.`,
        },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return fallbackPrompts

    const parsed = safeJsonParse<{ prompts?: PromptOutput[] }>(content, { prompts: fallbackPrompts })
    return parsed.prompts ?? fallbackPrompts
  } catch (error) {
    console.error('[Prompts] Batch generation failed:', error)
    return fallbackPrompts
  }
}

export function validateVariety(prompts: PromptOutput[]): VarietyScore {
  return calculateVarietyScore(prompts)
}

export function validateAllPrompts(prompts: PromptOutput[]): {
  allValid: boolean
  results: Array<{ index: number; valid: boolean; errors: string[] }>
} {
  const results = prompts.map((prompt, index) => {
    const { valid, errors } = validatePrompt(prompt)
    return { index, valid, errors }
  })

  return {
    allValid: results.every((r) => r.valid),
    results,
  }
}

export async function textToPrompt(textDescription: string): Promise<PromptOutput> {
  const openai = await getOpenAI()

  console.log(`[TextToPrompt] Converting: "${textDescription.substring(0, 50)}..."`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert at converting natural language descriptions into structured image generation prompts.

IMPORTANT RULES:
- NEVER mention age, ethnicity, skin color, or identity features
- Hair COLOR comes from the reference image - only describe style/texture
- Focus on: mood, lighting, environment, outfit, pose, camera settings
- Use "CRITICAL:" prefix for the most important elements

Output a single JSON prompt object with this exact structure:
${PROMPT_SCHEMA_EXAMPLE}`,
      },
      {
        role: 'user',
        content: `Convert this description into a detailed JSON prompt:

"${textDescription}"

Return only the JSON object, no markdown or explanation.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  const parsed = safeJsonParse<PromptOutput>(content, {
    style: textDescription,
    pose: { framing: '', body_position: '', arms: '', posture: '', expression: { facial: '', eyes: '', mouth: '' } },
    lighting: { setup: '', key_light: '', fill_light: '', shadows: '', mood: '' },
    set_design: { backdrop: '', surface: '', props: [], atmosphere: '' },
    outfit: { main: '', accessories: '', styling: '' },
    camera: { lens: '', aperture: '', angle: '', focus: '' },
    hairstyle: { style: '', parting: '', details: '', finish: '' },
    makeup: { style: '', skin: '', eyes: '', lips: '' },
    effects: { color_grade: '', grain: '' },
  })

  console.log(`[TextToPrompt] Generated style: "${parsed.style?.substring(0, 50)}..."`)

  return parsed
}
