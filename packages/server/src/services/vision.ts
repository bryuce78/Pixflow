import OpenAI from 'openai'
import fs from 'fs/promises'
import path from 'path'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

export interface AnalyzedPrompt {
  style: string
  pose: {
    framing: string
    body_position: string
    arms: string
    posture: string
    expression: {
      facial: string
      eyes: string
      mouth: string
    }
  }
  lighting: {
    setup: string
    key_light: string
    fill_light: string
    shadows: string
    mood: string
  }
  set_design: {
    backdrop: string
    surface: string
    props: string[]
    atmosphere: string
  }
  outfit: {
    main: string
    accessories: string
    styling: string
  }
  camera: {
    lens: string
    aperture: string
    angle: string
    focus: string
  }
  hairstyle: {
    style: string
    parting: string
    details: string
    finish: string
  }
  makeup: {
    style: string
    skin: string
    eyes: string
    lips: string
  }
  effects: {
    color_grade: string
    grain: string
  }
}

async function imageToBase64(imagePath: string): Promise<string> {
  const buffer = await fs.readFile(imagePath)
  const base64 = buffer.toString('base64')
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mimeType};base64,${base64}`
}

const ANALYSIS_PROMPT = `You are an expert photography and styling analyst. Analyze this image and generate a detailed prompt that could recreate a similar photo.

IMPORTANT RULES:
1. DO NOT describe the person's identity, face shape, ethnicity, skin color, hair color, or age
2. Focus ONLY on: pose, lighting, styling, set design, camera work, and mood
3. Be specific and technical in your descriptions

Return a JSON object with this EXACT structure:
{
  "style": "A single sentence summarizing the overall aesthetic and mood",
  "pose": {
    "framing": "e.g., Medium shot, Close-up, Full body",
    "body_position": "e.g., Seated, Standing, Leaning",
    "arms": "e.g., Crossed, Resting on lap, One hand on face",
    "posture": "e.g., Relaxed, Confident, Dynamic",
    "expression": {
      "facial": "e.g., Soft smile, Serious, Contemplative",
      "eyes": "e.g., Looking at camera, Gazing away, Closed",
      "mouth": "e.g., Slightly parted, Closed, Smiling"
    }
  },
  "lighting": {
    "setup": "e.g., Rembrandt lighting, Butterfly lighting, Natural window light",
    "key_light": "e.g., Soft box from left, Natural sun from behind",
    "fill_light": "e.g., Reflector on right, Ambient room light",
    "shadows": "e.g., Soft and diffused, Deep dramatic shadows",
    "mood": "e.g., Warm and intimate, Cool and moody, Bright and airy"
  },
  "set_design": {
    "backdrop": "Describe the background in detail",
    "surface": "What the subject is on/near",
    "props": ["List", "of", "visible", "props"],
    "atmosphere": "e.g., Cozy, Minimalist, Luxurious"
  },
  "outfit": {
    "main": "Describe the main clothing item",
    "accessories": "Jewelry, bags, etc.",
    "styling": "e.g., Casual chic, Formal elegant, Bohemian"
  },
  "camera": {
    "lens": "e.g., 85mm portrait lens, 35mm wide angle",
    "aperture": "e.g., f/1.8 shallow depth, f/8 sharp throughout",
    "angle": "e.g., Eye level, Slightly above, Low angle",
    "focus": "e.g., Sharp on eyes, Soft focus overall"
  },
  "hairstyle": {
    "style": "Describe the hairstyle WITHOUT color",
    "parting": "e.g., Center part, Side part, No part",
    "details": "e.g., Loose waves, Tight curls, Straight and sleek",
    "finish": "e.g., Glossy, Matte, Natural"
  },
  "makeup": {
    "style": "e.g., Natural, Glam, Editorial",
    "skin": "e.g., Dewy finish, Matte foundation, Natural glow",
    "eyes": "e.g., Smokey eye, Natural lashes, Bold liner",
    "lips": "e.g., Nude gloss, Red matte, Natural pink"
  },
  "effects": {
    "color_grade": "e.g., Warm tones, Cool blue tint, Vintage film look",
    "grain": "e.g., Clean digital, Light film grain, Heavy grain"
  }
}

Return ONLY the JSON object, no other text.`

export async function analyzeImage(imagePath: string): Promise<AnalyzedPrompt> {
  const openai = getOpenAI()
  const imageUrl = await imageToBase64(imagePath)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: ANALYSIS_PROMPT },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from vision model')
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as AnalyzedPrompt
  return parsed
}
