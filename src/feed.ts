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

  /**
   * `items` is snapshotted (copied) — later `addItem`/`addItems` calls don't affect an
   * already-returned `FeedInput`. `options` is returned by reference, though: mutating the
   * object passed to the constructor after calling `toInput()` (or `serveFeed`) is reflected
   * in the result, since it's the same object, not a copy.
   */
  toInput(): FeedInput {
    return { options: this.#options, items: [...this.#items] }
  }
}
