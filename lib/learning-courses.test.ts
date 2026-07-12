import { describe, expect, it } from 'vitest'
import { LEARNING_COURSES } from './learning-courses'

const OFFICIAL_HOSTS = new Set([
  'anthropic.skilljar.com',
  'github.com',
  'learn.microsoft.com',
  'academy.openai.com',
])

describe('official learning courses', () => {
  it('uses unique ids and official HTTPS destinations', () => {
    expect(new Set(LEARNING_COURSES.map((course) => course.id)).size).toBe(LEARNING_COURSES.length)

    for (const course of LEARNING_COURSES) {
      const url = new URL(course.url)
      expect(url.protocol).toBe('https:')
      expect(OFFICIAL_HOSTS.has(url.hostname)).toBe(true)
    }
  })

  it('contains courses with a completion credential', () => {
    expect(LEARNING_COURSES.some((course) => course.credential === 'certificate')).toBe(true)
    expect(LEARNING_COURSES.some((course) => course.credential === 'achievement')).toBe(true)
  })
})
