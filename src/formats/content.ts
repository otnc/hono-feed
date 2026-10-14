import type { FeedInput, FeedItem } from '../types'
import { absolutizeHtml } from '../utils/html'

/**
 * With `options.absolutizeContent` set and a base URL known, return the input with each item's HTML `content` and `description` made absolute; otherwise the input itself, untouched.
 */
export function withAbsoluteContent(input: FeedInput, baseUrl: string | undefined): FeedInput {
  if (!input.options.absolutizeContent || !baseUrl) return input
  const rewrite = (item: FeedItem): FeedItem => ({
    ...item,
    content: item.content && absolutizeHtml(item.content, baseUrl),
    description: item.description && absolutizeHtml(item.description, baseUrl),
  })
  return { ...input, items: input.items.map(rewrite) }
}
