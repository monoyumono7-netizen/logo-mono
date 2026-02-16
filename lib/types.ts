export interface PostFrontmatter {
  readonly title: string;
  readonly excerpt: string;
  readonly date: string;
  readonly tags: readonly string[];
  readonly cover?: string;
  readonly updatedAt?: string;
}

export interface PostSummary extends PostFrontmatter {
  readonly slug: string;
  readonly readingTimeText: string;
}

export interface TocItem {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

export interface SearchDocument {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly date: string;
}
