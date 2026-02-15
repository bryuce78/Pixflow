export const USER_MAY_PROVIDE_MULTI_REFERENCE = 'USER MAY PROVIDE MORE THAN 1 REFERENCE IMAGE.'

export const REFERENCE_IDENTITY_SOURCE_CRITICAL = `CRITICAL: Use the provided reference image(s) as mandatory identity source. ${USER_MAY_PROVIDE_MULTI_REFERENCE}`

export const REFERENCE_STYLE_PREFIX = `Using the provided reference image(s), preserve identity, facial structure, age, expression, and subject count exactly. ${USER_MAY_PROVIDE_MULTI_REFERENCE} If multiple references are provided, preserve every referenced subject and do not add, remove, replace, or merge people.`

export const GREENBOX_REFERENCE_PROMPT = `Using the provided reference image(s), preserve the face, identity, age, and pose exactly for every referenced subject. ${USER_MAY_PROVIDE_MULTI_REFERENCE} If multiple references are provided, keep each person distinct and do not merge identities. Isolate the subject cleanly and place them on a solid chroma green (#00FF00) background. No extra objects or text. Keep clothing and proportions unchanged. High-quality cutout.`
