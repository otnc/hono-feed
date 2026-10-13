import { Hono } from 'hono'
import * as ssg from 'hono/ssg'
import { describe, expect, it } from 'vitest'
import { feedExtensionMap, serveFeed } from './index'

const input = {
  options: {
    title: 'Blog',
    link: 'https://example.com/',
    author: { name: 'Ann' },
    updated: new Date('2026-01-01T00:00:00Z'),
  },
  items: [
    {
      title: 'Hello',
      link: 'https://example.com/1',
      content: '<p>hi</p>',
      updated: new Date('2026-01-01T00:00:00Z'),
    },
  ],
}

async function generate(extensionMap?: Record<string, string>) {
  const app = new Hono()
  app.get('/rss', (c) => serveFeed(c, input, { format: 'rss' }))
  app.get('/atom', (c) => serveFeed(c, input, { format: 'atom' }))
  app.get('/feed', (c) => serveFeed(c, input, { format: 'json' }))
  app.get('/', (c) => c.html('<p>home</p>'))
  const files = new Map<string, string>()
  const fsModule = {
    writeFile: async (path: string, data: string | Uint8Array) => {
      files.set(path, typeof data === 'string' ? data : new TextDecoder().decode(data))
    },
    mkdir: async () => {},
  }
  await ssg.toSSG(app, fsModule, { dir: 'out', extensionMap })
  return files
}

// `toSSG`'s `extensionMap` option (and `defaultExtensionMap`) don't exist in the oldest Hono versions the peer range allows.
const supportsExtensionMap = 'defaultExtensionMap' in ssg

it('maps the OPML MIME type to .opml', () => {
  expect(feedExtensionMap['text/x-opml']).toBe('opml')
})

describe.skipIf(!supportsExtensionMap)('feedExtensionMap with hono/ssg', () => {
  it('writes RSS and Atom as .xml and JSON Feed as .json, keeping HTML as .html', async () => {
    const files = await generate({ ...ssg.defaultExtensionMap, ...feedExtensionMap })
    expect([...files.keys()].sort()).toEqual([
      'out/atom.xml',
      'out/feed.json',
      'out/index.html',
      'out/rss.xml',
    ])
    expect(files.get('out/feed.json')).toContain('"version"')
    expect(files.get('out/rss.xml')).toContain('<rss version="2.0"')
  })

  it('is needed: without it JSON Feed is saved with an .html extension', async () => {
    const files = await generate()
    expect(files.has('out/feed.json')).toBe(false)
    expect(files.has('out/feed.html')).toBe(true)
  })
})
