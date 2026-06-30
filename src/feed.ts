import type { FeedInput, FeedItem, FeedOptions } from './types'

/** Thin builder accepted by `serveFeed` and the low-level serializers. */
export class Feed {
  #options: FeedOptions
  #items: FeedItem[] = []

  constructor(options: FeedOptions) {
    this.#options = options
  }

  addItem(item: FeedItem): this {
    this.#items.push(item)
    return this
  }

  addItems(items: FeedItem[]): this {
    this.#items.push(...items)
    return this
  }

  toInput(): FeedInput {
    return { options: this.#options, items: [...this.#items] }
  }
}
