import OpenAI from 'openai'
import { isMockProvidersEnabled, recordMockProviderSuccess, runWithRetries } from './providerRuntime.js'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

export interface ScriptGenerationOptions {
  concept: string
  duration: number
  examples?: string[]
  tone?: 'casual' | 'professional' | 'energetic' | 'friendly' | 'dramatic'
  appName?: string
}

export interface ScriptGenerationResult {
  script: string
  wordCount: number
  estimatedDuration: number
}

export interface ScriptTranslationResult {
  translations: Array<{ language: string; script: string }>
}

export interface ScriptLanguageDetectionResult {
  languageCode: string
}

const WORDS_PER_SECOND = 2.5
const AVOID_PHRASES = [
  'game changer',
  'next level',
  'unlock your potential',
  'revolutionary',
  'seamless',
  'transform your life',
  'never look back',
  'in today’s fast-paced world',
]

/**
 * Generate a voiceover script for a mobile app ad using GPT-4o.
 * The script is optimized for the specified duration and tone.
 */
export async function generateVoiceoverScript(options: ScriptGenerationOptions): Promise<ScriptGenerationResult> {
  const targetWords = Math.floor(options.duration * WORDS_PER_SECOND)
  const tolerance = Math.max(4, Math.floor(targetWords * 0.18))
  const minWords = Math.max(8, targetWords - tolerance)
  const maxWords = targetWords + tolerance

  if (isMockProvidersEnabled()) {
    await recordMockProviderSuccess({
      pipeline: 'avatars.script.provider',
      provider: 'openai',
      metadata: {
        duration: options.duration,
        tone: options.tone || 'energetic',
        appName: options.appName || 'generic',
      },
    })
    const words = Array.from({ length: Math.max(8, targetWords) }, () => 'pixflow').join(' ')
    const script = `${options.concept}. ${words}. Try Pixflow today.`
    const wordCount = script.split(/\s+/).filter(Boolean).length
    return {
      script,
      wordCount,
      estimatedDuration: Math.round(wordCount / WORDS_PER_SECOND),
    }
  }

  const toneDescriptions: Record<string, string> = {
    casual: 'casual and conversational, like talking to a friend',
    professional: 'professional and authoritative, building trust',
    energetic: 'energetic and exciting, creating urgency',
    friendly: 'warm and friendly, approachable and relatable',
    dramatic: 'dramatic and impactful, building anticipation',
  }

  const toneDescription = toneDescriptions[options.tone || 'energetic'] || toneDescriptions.energetic
  const targetApp = options.appName?.trim()

  const systemPrompt = `You are a senior short-form video scriptwriter.
Write spoken voiceover copy that sounds like a real human creator talking naturally.

Requirements:
- Word count: ${minWords}-${maxWords} words (target ${targetWords})
- Tone: ${toneDescription}
- Output only spoken text. No stage directions, no labels, no formatting blocks.
- Use natural spoken rhythm: mixed sentence lengths, contractions, and conversational transitions.
- Avoid generic ad cliches and overhyped language.
- Never use these phrases: ${AVOID_PHRASES.map((p) => `"${p}"`).join(', ')}
- Hook early, but do it naturally (not clickbaity).
- Include a call-to-action only if it feels contextually natural.

Product context:
- This is for an AI photo app.
- Primary publishing surface: ${targetApp || 'general short-form social'}.
- Keep wording specific to the concept and avoid reusable template lines.
- Every script must feel distinct from typical "AI ad copy".`

  const userPrompt = `Write one voiceover script for:

Concept: ${options.concept}
Target duration: ${options.duration} seconds
Target words: ${targetWords} (acceptable range ${minWords}-${maxWords})
Publishing surface: ${targetApp || 'general short-form social'}

${options.examples && options.examples.length > 0 ? `Reference examples for tone only (do not copy phrasing):\n${options.examples.join('\n\n')}` : ''}

Quality bar:
- Sound like a person speaking to camera.
- Adapt pacing and phrasing to match the publishing surface.
- No repeated sentence templates.
- No generic "AI magic" wording unless concept explicitly asks for it.`

  const response = await runWithRetries(
    () =>
      getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.95,
        max_completion_tokens: 500,
      }),
    {
      pipeline: 'avatars.script.provider',
      provider: 'openai',
      metadata: {
        duration: options.duration,
        tone: options.tone || 'energetic',
        appName: targetApp || 'generic',
      },
    },
  )

  const script = response.choices[0]?.message?.content?.trim()
  if (!script) {
    throw new Error('OpenAI returned empty script content')
  }
  const wordCount = script.split(/\s+/).filter(Boolean).length
  const estimatedDuration = Math.round(wordCount / WORDS_PER_SECOND)

  return {
    script,
    wordCount,
    estimatedDuration,
  }
}

/**
 * Refine an existing script based on feedback.
 */
export async function refineScript(
  originalScript: string,
  feedback: string,
  targetDuration: number,
): Promise<ScriptGenerationResult> {
  const targetWords = Math.floor(targetDuration * WORDS_PER_SECOND)
  const tolerance = Math.max(4, Math.floor(targetWords * 0.18))
  const minWords = Math.max(8, targetWords - tolerance)
  const maxWords = targetWords + tolerance

  if (isMockProvidersEnabled()) {
    await recordMockProviderSuccess({
      pipeline: 'avatars.script.refine.provider',
      provider: 'openai',
      metadata: { targetDuration },
    })
    const script = `${originalScript} ${feedback}`.trim()
    const wordCount = script.split(/\s+/).filter(Boolean).length
    return {
      script,
      wordCount,
      estimatedDuration: Math.round(wordCount / WORDS_PER_SECOND),
    }
  }

  const response = await runWithRetries(
    () =>
      getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a voiceover script doctor.
Refine the script to sound more natural and human while preserving meaning.

Rules:
- Output only spoken text.
- Keep to ${minWords}-${maxWords} words (target ${targetWords}).
- Remove repetitive AI-style phrasing and generic ad cliches.
- Never use: ${AVOID_PHRASES.map((p) => `"${p}"`).join(', ')}
- Keep tone and intent, but improve flow, cadence, and specificity.
- No stage directions, no labels, no brackets.`,
          },
          {
            role: 'user',
            content: `Original script:\n${originalScript}\n\nFeedback:\n${feedback}\n\nReturn a single improved version.`,
          },
        ],
        temperature: 0.9,
        max_completion_tokens: 500,
      }),
    {
      pipeline: 'avatars.script.refine.provider',
      provider: 'openai',
      metadata: { targetDuration },
    },
  )

  const script = response.choices[0]?.message?.content?.trim()
  if (!script) {
    throw new Error('OpenAI returned empty script content')
  }
  const wordCount = script.split(/\s+/).filter(Boolean).length
  const estimatedDuration = Math.round(wordCount / WORDS_PER_SECOND)

  return {
    script,
    wordCount,
    estimatedDuration,
  }
}

export async function translateVoiceoverScript(script: string, languages: string[]): Promise<ScriptTranslationResult> {
  const targetLanguages = languages.map((lang) => lang.trim()).filter(Boolean)
  if (targetLanguages.length === 0) {
    return { translations: [] }
  }

  if (isMockProvidersEnabled()) {
    await recordMockProviderSuccess({
      pipeline: 'avatars.script.translate.provider',
      provider: 'openai',
      metadata: { languages: targetLanguages.join(',') },
    })
    return {
      translations: targetLanguages.map((language) => ({
        language,
        script: `[${language}] ${script}`,
      })),
    }
  }

  const response = await runWithRetries(
    () =>
      getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator for short spoken voiceover scripts.
Translate the given script into the specified target languages.

Rules:
- Preserve meaning, tone, pacing, and line breaks as much as possible.
- Keep product names and proper nouns unchanged.
- Output JSON only, no extra commentary.
- The JSON shape must be: {"translations":{"Language":"Translated script"}}`,
          },
          {
            role: 'user',
            content: `Script:\n${script}\n\nTarget languages:\n${targetLanguages.join(', ')}`,
          },
        ],
        temperature: 0.4,
        max_completion_tokens: 1200,
      }),
    {
      pipeline: 'avatars.script.translate.provider',
      provider: 'openai',
      metadata: { languages: targetLanguages.join(',') },
    },
  )

  const content = response.choices[0]?.message?.content?.trim()
  if (!content) throw new Error('OpenAI returned empty translation content')

  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Translation response missing JSON payload')
  }
  const jsonText = cleaned.slice(jsonStart, jsonEnd + 1)
  let parsed: { translations?: Record<string, string> } | null = null
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Failed to parse translation JSON')
  }

  const translationsMap = parsed?.translations || {}
  const translations = targetLanguages.map((language) => ({
    language,
    script: translationsMap[language] || '',
  }))

  if (translations.every((item) => !item.script)) {
    throw new Error('No translations returned')
  }

  return { translations }
}

export async function detectScriptLanguage(script: string): Promise<ScriptLanguageDetectionResult> {
  if (!script.trim()) {
    return { languageCode: 'EN' }
  }

  if (isMockProvidersEnabled()) {
    await recordMockProviderSuccess({
      pipeline: 'avatars.script.detect.provider',
      provider: 'openai',
      metadata: {},
    })
    return { languageCode: 'EN' }
  }

  const response = await runWithRetries(
    () =>
      getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Detect the primary language of the input text.
Return JSON only in this exact shape: {"languageCode":"XX"}
Use uppercase ISO-639-1 style codes where possible.
If unsure, return EN.`,
          },
          {
            role: 'user',
            content: script,
          },
        ],
        temperature: 0,
        max_completion_tokens: 80,
      }),
    {
      pipeline: 'avatars.script.detect.provider',
      provider: 'openai',
      metadata: {},
    },
  )

  const content = response.choices[0]?.message?.content?.trim()
  if (!content) return { languageCode: 'EN' }

  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) return { languageCode: 'EN' }

  try {
    const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as { languageCode?: string }
    const languageCode = (parsed.languageCode || 'EN').trim().toUpperCase()
    return { languageCode: languageCode || 'EN' }
  } catch {
    return { languageCode: 'EN' }
  }
}
